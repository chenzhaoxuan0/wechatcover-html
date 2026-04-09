const path = require('path');
const fs = require('fs');
const os = require('os');
const { getArticleAnalysisPrompt, parseAnalysisResult, getImageAnalysisPrompt, parseImageAnalysisResult, generateBackgroundImage, downloadImage, fallbackExtract } = require('./ai-extractor');

/**
 * 使用 canvas 检测图像平均亮度（同时支持 PNG 和 JPEG）
 * @param {string} filePath - 图片路径
 * @returns {Promise<number>} - 平均亮度 0-255
 */
async function getImageBrightness(filePath) {
  try {
    const { createCanvas, loadImage } = require('canvas');
    const img = await loadImage(filePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;

    // 采样策略：每隔 N 个像素取一个
    const step = Math.max(1, Math.floor(data.length / 4 / 2000));
    let total = 0, count = 0;
    for (let i = 0; i < data.length; i += 4 * step) {
      const a = data[i + 3];
      if (a < 128) continue; // 跳过透明像素
      const r = data[i], g = data[i + 1], b = data[i + 2];
      total += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
    return count > 0 ? total / count : 128;
  } catch (e) {
    console.warn('[getImageBrightness] 分析失败:', e.message);
    return 128;
  }
}

/**
 * 获取文章分析的 Prompt（供外部 Agent 解析）
 * @param {string} title - 文章标题
 * @param {string} content - 文章正文
 * @returns {{ systemPrompt, userPrompt }}
 */
function getArticlePrompt(title, content) {
  return getArticleAnalysisPrompt(title, content);
}

/**
 * 解析文章分析结果
 * @param {string} text - Agent 返回的原始文本
 * @returns {{summary, visualPrompt, keywords}}
 */
function parseArticleResult(text) {
  return parseAnalysisResult(text);
}

/**
 * 获取图片分析的 Prompt（供外部 Agent 解析）
 * @param {string} imageUrl - 图片 URL
 * @returns {{ systemPrompt, userPrompt }}
 */
function getImagePrompt(imageUrl) {
  return getImageAnalysisPrompt(imageUrl);
}

/**
 * 解析图片分析结果
 * @param {string} text - Agent 返回的原始文本
 * @returns {{textColor, mode, tone, reason}}
 */
function parseImageResult(text) {
  return parseImageAnalysisResult(text);
}

/**
 * 生成背景图并分析，返回背景图路径 + 文字颜色
 *
 * @param {string} title - 文章标题
 * @param {string} content - 文章正文（可选，仅用于生成 Prompt）
 * @param {object} options
 * @param {string} options.backgroundImage - 外部指定背景图 URL 或本地路径
 * @param {string} options.textColor - 手动指定文字色
 * @param {string} options.outputDir - 输出目录
 * @param {object} options.aiResult - 外部已解析的 AI 结果 {summary, visualPrompt, keywords, textColor}
 * @returns {Promise<{bgImagePath: string, textColor: string, aiResult: object}>}
 */
async function prepareBackground(title, content, options = {}) {
  const outputDir = options.outputDir || os.tmpdir();
  const bgImagePath = path.join(outputDir, `bg_${Date.now()}.png`);

  // 如果外部已传入 aiResult，直接使用
  let aiResult = options.aiResult || {};
  let textColor = options.textColor || aiResult.textColor || '#111111';

  // Step 1: 如果没有外部传入 aiResult，使用兜底（优先 MiniMax API 从文章内容提取）
  if (!aiResult.keywords && !aiResult.visualPrompt) {
    aiResult = await fallbackExtract(title, content);
  }

  // Step 2: 生成背景图
  let bgUrl;
  if (options.backgroundImage) {
    if (options.backgroundImage.startsWith('http')) {
      await downloadImage(options.backgroundImage, bgImagePath);
    } else {
      fs.copyFileSync(options.backgroundImage, bgImagePath);
    }
    bgUrl = options.backgroundImage;
  } else if (aiResult.visualPrompt) {
    try {
      const generatedPath = await generateBackgroundImage(aiResult.visualPrompt, bgImagePath);
      bgUrl = `file://${generatedPath.replace(/\\/g, '/')}`;
    } catch (e) {
      console.warn('背景图生成失败，使用纯色背景:', e.message);
      await createSolidColorBg(bgImagePath, '#888888');
      bgUrl = `file://${bgImagePath.replace(/\\/g, '/')}`;
    }
  } else {
    await createSolidColorBg(bgImagePath, '#888888');
    bgUrl = `file://${bgImagePath.replace(/\\/g, '/')}`;
  }

  // Step 3: 文字颜色
  // 如果没有指定，根据背景图亮度自动选择：暗背景用白色文字，亮背景用黑色文字
  if (!options.textColor && !aiResult.textColor) {
    const brightness = await getImageBrightness(bgImagePath);
    textColor = brightness < 128 ? '#FFFFFF' : '#111111';
    console.log(`[prepareBackground] 背景亮度=${Math.round(brightness)} → 文字颜色=${textColor}`);
  }

  return {
    bgImagePath,
    textColor,
    aiResult,
  };
}

/**
 * 创建纯色背景图（降级用）
 */
async function createSolidColorBg(outputPath, color) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:1920px;height:640px;background:${color};"></body></html>`;
  const { captureFromHtml } = require('./screenshot');
  const buf = await captureFromHtml(html, 1920, 640, outputPath);
  return buf;
}

module.exports = {
  prepareBackground,
  getImageBrightness,
  getArticlePrompt,
  parseArticleResult,
  getImagePrompt,
  parseImageResult,
};
