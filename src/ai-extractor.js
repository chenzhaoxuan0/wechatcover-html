const path = require('path');
const fs = require('fs');
const os = require('os');

const SKILL_DIR = path.resolve(__dirname, '..');
const GENERATE_IMAGE_SCRIPT = path.join(SKILL_DIR, 'scripts', 'image', 'generate_image.sh');

/**
 * 关键词截断函数（按语义完整词截取）
 * 英文词保留完整，中文词保留完整2字符
 * @param {string} keyword
 * @param {number} maxChars
 * @returns {string}
 */
function truncateKeyword(keyword, maxChars = 10) {
  const trimmed = String(keyword).trim();
  if (trimmed.length <= maxChars) return trimmed;

  // 英文词：保留完整英文词，不在中途切断
  if (/[a-zA-Z]/.test(trimmed)) {
    const lastSpace = trimmed.lastIndexOf(' ', maxChars);
    const lastDash = trimmed.lastIndexOf('-', maxChars);
    const cut = Math.max(lastSpace, lastDash);
    if (cut > 0) return trimmed.slice(0, cut);
  }

  // 中文词：尽量保留完整2字符
  let cut = maxChars;
  if (cut < trimmed.length && /[\u4e00-\u9fff]/.test(trimmed[cut - 1])) {
    for (let i = cut - 2; i >= Math.max(0, cut - 4); i--) {
      if (/[\u4e00-\u9fff]/.test(trimmed[i]) && /[\u4e00-\u9fff]/.test(trimmed[i + 1])) {
        cut = i + 2;
        break;
      }
    }
  }
  return trimmed.slice(0, cut);
}

function getMiniMaxApiKey() {
  return process.env.MINIMAX_API_KEY || '';
}

function getMiniMaxApiHost() {
  return process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com';
}

/**
 * MiniMax API 串行锁（MiniMax 免费账户限制 1 并发）
 * 所有调用 MiniMax 的 API 请求必须经过此锁，确保串行执行
 */
let miniMaxLock = Promise.resolve();
function acquireMiniMaxLock() {
  let release;
  const ticket = new Promise(resolve => { release = resolve; });
  miniMaxLock = miniMaxLock.then(() => ticket);
  return release;
}

/**
 * 获取文章分析的 Prompt（供外部 Agent 解析）
 * @param {string} title - 文章标题
 * @param {string} content - 文章正文
 * @returns {{ systemPrompt, userPrompt }}
 */
function getArticleAnalysisPrompt(title, content) {
  return {
    systemPrompt: `你是一个微信公众号封面设计师。请根据以下文章内容，提取三个信息：

1. 一句话摘要（不超过30字，用于封面副标题参考）
2. 视觉风格描述（用于AI生成背景图，2-3句话，描述色调、氛围、风格，避免具体形状描述）
3. 3个精准关键词（用于封面主视觉大字，要具体精准，不要泛词）

请以JSON格式输出（只输出JSON，不要其他内容）：
{
  "summary": "...",
  "visualPrompt": "...",
  "keywords": ["...", "...", "..."]
}`,
    userPrompt: `文章标题：${title}\n文章正文：${content.slice(0, 3000)}`,
  };
}

/**
 * 解析 LLM 返回的 JSON 结果
 * @param {string} text - LLM 返回的原始文本
 * @returns {{summary, visualPrompt, keywords}}
 */
function parseAnalysisResult(text) {
  let jsonStr = text.trim();
  // 去掉可能的 markdown 代码块
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```[a-z]*\n?/g, '').trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      summary: parsed.summary || '',
      visualPrompt: parsed.visualPrompt || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 3) : [],
    };
  } catch (e) {
    throw new Error(`解析 AI 结果失败: ${e.message}, 原始内容: ${text.slice(0, 200)}`);
  }
}

/**
 * 获取图片分析的 Prompt（供外部 Agent 解析）
 * @param {string} imageUrl - 图片 URL
 * @returns {{ systemPrompt, userPrompt }}
 */
function getImageAnalysisPrompt(imageUrl) {
  return {
    systemPrompt: `你是一个图像分析专家。请分析这张图片的视觉特征：

1. 判断图片整体亮度：偏亮还是偏暗？
2. 判断图片主色调：冷色调（蓝/紫/绿）还是暖色调（红/橙/黄）？
3. 选择最适合在这张图片上叠加文字的颜色（高对比度原则）

请以JSON格式输出（只输出JSON，不要其他内容）：
{
  "brightness": "light" | "dark" | "medium",
  "tone": "cool" | "warm" | "neutral",
  "textColor": "#111111" | "#FFFFFF",
  "reason": "简要说明原因"
}`,
    userPrompt: `请分析这张图片的视觉特征并返回JSON格式的分析结果（图片URL: ${imageUrl}）`,
  };
}

/**
 * 解析图片分析结果
 * @param {string} text - LLM 返回的原始文本
 * @returns {{textColor, mode, tone, reason}}
 */
function parseImageAnalysisResult(text) {
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```[a-z]*\n?/g, '').trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      textColor: parsed.textColor || '#111111',
      mode: parsed.brightness || 'medium',
      tone: parsed.tone || 'neutral',
      reason: parsed.reason || '',
    };
  } catch (e) {
    throw new Error(`解析图片分析结果失败: ${e.message}, 原始内容: ${text.slice(0, 200)}`);
  }
}

/**
 * 用 image-01 生成横版背景图（优先直接 API，失败则用 mmx CLI 兜底）
 * @param {string} visualPrompt - 视觉描述
 * @param {string} outputPath - 输出路径
 * @returns {Promise<string>} - 图片文件路径
 */
async function generateBackgroundImage(visualPrompt, outputPath) {
  const fullPrompt = `${visualPrompt}，抽象背景，无文字，高清，适合作为封面背景`;
  const tmpDir = os.tmpdir();
  const tmpOutput = outputPath || path.join(tmpDir, `bg_${Date.now()}.png`);

  // 优先尝试 mmx CLI（WSL 等环境兼容性更好）
  if (await isMmxAvailable()) {
    try {
      return await generateViaMmx(fullPrompt, tmpOutput);
    } catch (mmxErr) {
      console.warn(`[generateBackgroundImage] mmx CLI failed (${mmxErr.message}), trying direct API...`);
    }
  }

  // 直接 API 兜底
  return await generateViaApi(fullPrompt, tmpOutput);
}

/**
 * 检测 mmx CLI 是否可用
 */
async function isMmxAvailable() {
  try {
    const { execSync } = require('child_process');
    execSync('mmx --version', { encoding: 'utf-8', timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 直接调用 MiniMax image-01 API 生成图片
 */
async function generateViaApi(fullPrompt, tmpOutput) {
  const release = await acquireMiniMaxLock();
  try {
    return await _generateViaApiImpl(fullPrompt, tmpOutput);
  } finally {
    release();
  }
}

async function _generateViaApiImpl(fullPrompt, tmpOutput) {
  const apiKey = getMiniMaxApiKey();
  const apiHost = getMiniMaxApiHost();

  if (!apiKey) {
    throw new Error('未配置 MINIMAX_API_KEY');
  }

  const requestBody = {
    model: 'image-01',
    prompt: fullPrompt,
    aspect_ratio: '16:9',
    response_format: 'base64',
    n: 1,
  };

  const response = await fetch(`${apiHost}/v1/image_generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`API 错误: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const base64Data = data.data?.image_urls?.[0];

  if (!base64Data) {
    throw new Error('图片生成未返回数据');
  }

  // base64 格式直接写入，无须二次请求
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(tmpOutput, buffer);
  return tmpOutput;
}

/**
 * 通过 mmx CLI 生成图片（兜底方案）
 */
async function generateViaMmx(fullPrompt, tmpOutput) {
  const { execSync } = require('child_process');
  const outputDir = path.dirname(tmpOutput);
  const outputFile = path.basename(tmpOutput, path.extname(tmpOutput));

  // mmx 默认生成 jpg，输出前缀用 bg_
  const cmd = [
    'mmx', 'image', 'generate',
    '--prompt', fullPrompt,
    '--aspect-ratio', '16:9',
    '--out-dir', outputDir,
    '--out-prefix', outputFile || 'bg',
    '--output', 'json',
    '--quiet',
  ].join(' ');

  let output;
  try {
    output = execSync(cmd, { encoding: 'utf-8', timeout: 300000 });
  } catch (e) {
    throw new Error(`mmx CLI 执行失败: ${e.message}`);
  }

  let savedFile;
  try {
    const parsed = JSON.parse(output);
    savedFile = parsed.saved?.[0];
  } catch {
    // mmx 在非交互模式下直接输出文件路径（去掉 [Model: xxx] 前缀）
    const trimmed = output.trim().replace(/^\[Model:[^\]]*\]\s*/, '');
    const lines = trimmed.split('\n').filter(l => l.trim());
    if (lines.length > 0 && lines[0].match(/\.(jpg|png|jpeg)$/i)) {
      savedFile = lines[0].trim();
    } else {
      throw new Error(`mmx 输出解析失败: ${output.slice(0, 200)}`);
    }
  }

  if (!savedFile) {
    throw new Error('mmx 未返回生成文件');
  }

  // 如果 mmx 返回的是绝对路径，直接使用；否则与 outputDir 拼接
  const mmxOutputPath = path.isAbsolute(savedFile)
    ? savedFile
    : path.join(outputDir, savedFile);

  // 始终复制到 tmpOutput：调用者期望的输出路径由调用者决定
  // mmx 可能生成 jpg，tmpOutput 可能是 png；扩展名不同也照常复制（浏览器按内容识别 MIME）
  fs.copyFileSync(mmxOutputPath, tmpOutput);

  // 清理 mmx 原始输出（如果与 tmpOutput 不是同一路径）
  if (path.resolve(mmxOutputPath) !== path.resolve(tmpOutput)) {
    try { fs.unlinkSync(mmxOutputPath); } catch { /* ignore cleanup err */ }
  }

  return tmpOutput;
}

/**
 * 下载图片到本地
 * @param {string} imageUrl - 图片 URL
 * @param {string} outputPath - 输出路径
 * @returns {Promise<string>}
 */
async function downloadImage(imageUrl, outputPath) {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`图片下载失败: ${imageResponse.status}`);
  }
  const buffer = await imageResponse.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  return outputPath;
}

/**
 * 兜底提取：当 AI 提取失败时使用（优先 MiniMax API 从文章内容提取，失败则用标题切字）
 * @param {string} title
 * @param {string} content - 文章正文（可选）
 * @returns {Promise<{summary, visualPrompt, keywords}>}
 */
async function fallbackExtract(title, content) {
  const rawTitle = title.trim();

  // 如果没有文章内容或内容过短，用标题作为内容尝试 API 提取
  const apiContent = (!content || content.trim().length < 20) ? rawTitle : content;

  // 优先尝试从文章内容提取（MiniMax chat API），最多重试 2 次（间隔 3s）
  const maxRetries = 2;
  const retryDelay = 3000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.warn(`[fallbackExtract] API 第 ${attempt} 次重试，等待 ${retryDelay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    try {
      const result = await extractViaMiniMaxApi(rawTitle, apiContent);
      if (result && result.keywords && result.keywords.length > 0) {
        if (attempt > 0) {
          console.warn(`[fallbackExtract] 第 ${attempt} 次重试成功`);
        }
        return result;
      }
    } catch (e) {
      console.warn(`[fallbackExtract] API 调用失败（${attempt + 1}/${maxRetries + 1}）: ${e.message}`);
    }
  }

  // 所有重试均失败后，才使用标题兜底（按语义完整词截断，不强行截前6字）
  console.warn(`[fallbackExtract] 所有重试失败，使用标题兜底`);
  return titleFallback(rawTitle);
}

/**
 * 标题兜底：按语义完整词截断关键词，尽量保留完整词
 * @param {string} rawTitle
 * @returns {{summary, visualPrompt, keywords}}
 */
function titleFallback(rawTitle) {
  const MAX_KEYWORD_LEN = 8; // 每个关键词最多 8 字符
  let keywords = [];

  if (rawTitle.length <= MAX_KEYWORD_LEN) {
    keywords = [rawTitle];
  } else {
    // 按常见分隔符切分，尽量保留完整词
    const segments = rawTitle.split(/[,，、和与及为的是有:：、。.]/).filter(s => s.trim().length >= 2);
    if (segments.length >= 2) {
      // 取前 3 个片段，每个按完整词截断
      keywords = segments.slice(0, 3).map(s => truncateKeyword(s.trim(), MAX_KEYWORD_LEN));
    } else {
      // 无法切分，直接用 truncateKeyword 截断（保留英文词边界）
      keywords = [truncateKeyword(rawTitle, MAX_KEYWORD_LEN)];
    }
  }

  return {
    summary: rawTitle.slice(0, 30),
    visualPrompt: '抽象渐变背景，简洁大气',
    keywords: keywords.length > 0 ? keywords : [truncateKeyword(rawTitle, MAX_KEYWORD_LEN)],
  };
}

/**
 * 通过 MiniMax chat API 从文章内容提取关键词（优先 mmx CLI，失败则直接 API）
 * @param {string} title
 * @param {string} content
 * @returns {Promise<{summary, visualPrompt, keywords}>}
 */
async function extractViaMiniMaxApi(title, content) {
  // 优先尝试 mmx CLI（WSL 等环境兼容性更好）
  if (await isMmxAvailable()) {
    try {
      return await extractViaMmxCli(title, content);
    } catch (mmxErr) {
      // mmx 失败，继续用直接 API
    }
  }

  // 直接 API 兜底
  return await extractViaDirectApi(title, content);
}

/**
 * 通过 mmx CLI 提取文章关键词
 */
async function extractViaMmxCli(title, content) {
  const { execSync } = require('child_process');
  const fs = require('fs');
  const os = require('os');

  const systemPrompt = `你是一个微信公众号文章分析专家。从文章中提取：
1. 三个关键词（最能概括文章的词或短语，每个不超过10字）
2. 一句话总结（不超过30字）
3. 适合做封面背景的视觉描述（抽象、简洁、无文字）

只返回 JSON，不要有其他内容。格式：
{"keywords":["关键词1","关键词2","关键词3"],"summary":"总结","visualPrompt":"视觉描述"}`;

  const userPrompt = `标题：${title}\n\n内容：${content.slice(0, 2000)}`;

  // 写入临时 JSON 文件，避免 shell 转义问题
  const tmpFile = path.join(os.tmpdir(), `mmx_chat_${Date.now()}.json`);
  const messagesJson = JSON.stringify([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);
  fs.writeFileSync(tmpFile, messagesJson, 'utf8');

  try {
    const cmd = [
      'mmx', 'text', 'chat',
      '--model', 'MiniMax-M2.7',
      '--messages-file', tmpFile,
      '--max-tokens', '512',
      '--output', 'json',
      '--quiet',
    ].join(' ');

    let rawOutput = execSync(cmd, { encoding: 'utf-8', timeout: 60000 }).trim();
    // 去除 markdown code fences（LLM 可能返回 ```json ... ``` 格式）
    if (rawOutput.startsWith('```')) {
      rawOutput = rawOutput.replace(/```[a-z]*\n?/g, '').trim();
    }
    // 支持从混合文本中提取 JSON（截取第一个 { 到最后一个 }）
    let jsonStr = rawOutput;
    const firstBrace = rawOutput.indexOf('{');
    const lastBrace = rawOutput.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = rawOutput.slice(firstBrace, lastBrace + 1);
    }
    const parsed = JSON.parse(jsonStr);

    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 3).map(k => truncateKeyword(k, 12)) : [],
      summary: (parsed.summary || title.slice(0, 30)),
      visualPrompt: parsed.visualPrompt || '抽象渐变背景，简洁大气',
    };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * 直接调用 MiniMax Chat API 提取文章关键词
 */
async function extractViaDirectApi(title, content) {
  const release = await acquireMiniMaxLock();
  try {
    return await _extractViaDirectApiImpl(title, content);
  } finally {
    release();
  }
}

async function _extractViaDirectApiImpl(title, content) {
  const apiKey = getMiniMaxApiKey();
  const apiHost = getMiniMaxApiHost();

  if (!apiKey) {
    throw new Error('未配置 MINIMAX_API_KEY');
  }

  const systemPrompt = `你是一个微信公众号文章分析专家。从文章中提取：
1. 三个关键词（最能概括文章的词或短语，每个不超过10字）
2. 一句话总结（不超过30字）
3. 适合做封面背景的视觉描述（抽象、简洁、无文字）

只返回 JSON，不要有其他内容。格式：
{"keywords":["关键词1","关键词2","关键词3"],"summary":"总结","visualPrompt":"视觉描述"}`;

  const userPrompt = `标题：${title}\n\n内容：${content.slice(0, 2000)}`;

  const response = await fetch(`${apiHost}/v1/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat API 错误: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(`Chat API 未返回内容: ${JSON.stringify(data).slice(0, 100)}`);
  }

  // 去除 markdown code fences
  let jsonStr = text.replace(/```json\n?|```\n?/g, '').trim();
  // 支持从混合文本中提取 JSON（截取第一个 { 到最后一个 }）
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(jsonStr);
  return {
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 3).map(k => truncateKeyword(k, 12)) : [],
    summary: parsed.summary || title.slice(0, 30),
    visualPrompt: parsed.visualPrompt || '抽象渐变背景，简洁大气',
  };
}

module.exports = {
  getArticleAnalysisPrompt,
  parseAnalysisResult,
  getImageAnalysisPrompt,
  parseImageAnalysisResult,
  generateBackgroundImage,
  downloadImage,
  fallbackExtract,
};
