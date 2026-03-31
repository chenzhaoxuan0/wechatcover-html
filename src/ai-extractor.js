const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
const GENERATE_IMAGE_SCRIPT = path.join(SKILL_DIR, 'scripts', 'image', 'generate_image.sh');

function getApiHost() {
  return process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com';
}

function getApiKey() {
  return process.env.MINIMAX_API_KEY || '';
}

/**
 * 调用 MiniMax Chat API
 */
async function chatCompletion(messages, temperature = 0.7) {
  const apiHost = getApiHost();
  const apiKey = getApiKey();

  const response = await fetch(`${apiHost}/v1/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat API 错误: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Chat API 未返回内容');
  }
  return content;
}

/**
 * 从文章内容中提取摘要、视觉描述、关键词
 * @param {string} title - 文章标题
 * @param {string} content - 文章正文
 * @returns {Promise<{summary, visualPrompt, keywords}>}
 */
async function extractFromArticle(title, content) {
  const prompt = `你是一个微信公众号封面设计师。请根据以下文章内容，提取三个信息：

1. 一句话摘要（不超过30字，用于封面副标题参考）
2. 视觉风格描述（用于AI生成背景图，2-3句话，描述色调、氛围、风格，避免具体形状描述）
3. 3个精准关键词（用于封面主视觉大字，要具体精准，不要泛词）

文章标题：${title}
文章正文：${content.slice(0, 3000)}

请以JSON格式输出（只输出JSON，不要其他内容）：
{
  "summary": "...",
  "visualPrompt": "...",
  "keywords": ["...", "...", "..."]
}`;

  const content_text = await chatCompletion([
    { role: 'user', content: prompt }
  ]);

  // 解析 JSON
  let jsonStr = content_text.trim();
  // 去掉可能的 markdown 代码块
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```[a-z]*\n?/g, '').trim();
  }

  const parsed = JSON.parse(jsonStr);
  return {
    summary: parsed.summary || '',
    visualPrompt: parsed.visualPrompt || '',
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 3) : [],
  };
}

/**
 * 分析图片亮度/色调，返回高对比文字色
 * @param {string} imageUrl - 图片 URL
 * @returns {Promise<{textColor: string, mode: string}>}
 */
async function analyzeImageColor(imageUrl) {
  const prompt = `你是一个图像分析专家。请分析这张图片的视觉特征：

1. 判断图片整体亮度：偏亮还是偏暗？
2. 判断图片主色调：冷色调（蓝/紫/绿）还是暖色调（红/橙/黄）？
3. 选择最适合在这张图片上叠加文字的颜色（高对比度原则）

请以JSON格式输出（只输出JSON，不要其他内容）：
{
  "brightness": "light" | "dark" | "medium",
  "tone": "cool" | "warm" | "neutral",
  "textColor": "#111111" | "#FFFFFF",
  "reason": "简要说明原因"
}`;

  const content_text = await chatCompletion([
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }
  ]);

  let jsonStr = content_text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```[a-z]*\n?/g, '').trim();
  }

  const parsed = JSON.parse(jsonStr);
  return {
    textColor: parsed.textColor || '#111111',
    mode: parsed.brightness || 'medium',
    tone: parsed.tone || 'neutral',
    reason: parsed.reason || '',
  };
}

/**
 * 用 image-01 生成横版背景图
 * @param {string} visualPrompt - 视觉描述
 * @param {string} outputPath - 输出路径
 * @returns {Promise<string>} - 图片文件路径
 */
async function generateBackgroundImage(visualPrompt, outputPath) {
  const apiKey = getApiKey();
  const apiHost = getApiHost();

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
  // 用标题前6个字作为关键词
  const rawTitle = title.trim();
  const first6 = rawTitle.slice(0, 6);
  return {
    summary: rawTitle.slice(0, 30),
    visualPrompt: '抽象渐变背景，简洁大气',
    keywords: [first6],
  };
}

module.exports = {
  extractFromArticle,
  analyzeImageColor,
  generateBackgroundImage,
  downloadImage,
  fallbackExtract,
};
