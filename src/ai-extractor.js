const path = require('path');
const fs = require('fs');
const os = require('os');

const SKILL_DIR = path.resolve(__dirname, '..');
const GENERATE_IMAGE_SCRIPT = path.join(SKILL_DIR, 'scripts', 'image', 'generate_image.sh');

function getMiniMaxApiKey() {
  return process.env.MINIMAX_API_KEY || '';
}

function getMiniMaxApiHost() {
  return process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com';
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
 * 用 image-01 生成横版背景图
 * @param {string} visualPrompt - 视觉描述
 * @param {string} outputPath - 输出路径
 * @returns {Promise<string>} - 图片文件路径
 */
async function generateBackgroundImage(visualPrompt, outputPath) {
  const apiKey = getMiniMaxApiKey();
  const apiHost = getMiniMaxApiHost();

  if (!apiKey) {
    throw new Error('未配置 MINIMAX_API_KEY，无法生成背景图');
  }

  // 构造完整 prompt
  const fullPrompt = `${visualPrompt}，抽象背景，无文字，高清，适合作为封面背景`;
  const tmpDir = os.tmpdir();
  const tmpOutput = outputPath || path.join(tmpDir, `bg_${Date.now()}.png`);

  const requestBody = {
    model: 'image-01',
    prompt: fullPrompt,
    aspect_ratio: '16:9',
    response_format: 'url',
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
    throw new Error(`图片生成 API 错误: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.image_urls?.[0];

  if (!imageUrl) {
    throw new Error('图片生成未返回 URL');
  }

  // 下载图片到本地
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`图片下载失败: ${imageResponse.status}`);
  }

  const buffer = await imageResponse.arrayBuffer();
  fs.writeFileSync(tmpOutput, Buffer.from(buffer));

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
 * 兜底提取：当 AI 提取失败时使用
 * @param {string} title
 * @returns {{summary, visualPrompt, keywords}}
 */
function fallbackExtract(title) {
  // 用标题前6个字作为关键词（但尽量保持词的完整性）
  const rawTitle = title.trim();
  let keywords = [];
  if (rawTitle.length <= 6) {
    keywords = [rawTitle];
  } else {
    // 尝试按常见模式切分
    const segments = rawTitle.split(/[,，、和与及为的是有]/).filter(s => s.length >= 2);
    if (segments.length >= 3) {
      keywords = segments.slice(0, 3).map(s => s.trim().slice(0, 6));
    } else if (segments.length > 0) {
      keywords = [segments[0].trim().slice(0, 6)];
    } else {
      keywords = [rawTitle.slice(0, 6)];
    }
  }
  return {
    summary: rawTitle.slice(0, 30),
    visualPrompt: '抽象渐变背景，简洁大气',
    keywords: keywords.length > 0 ? keywords : [rawTitle.slice(0, 6)],
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
