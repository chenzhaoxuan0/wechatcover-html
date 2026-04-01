const path = require('path');
const fs = require('fs');
const os = require('os');
const { getArticleAnalysisPrompt, parseAnalysisResult, getImageAnalysisPrompt, parseImageAnalysisResult, generateBackgroundImage, downloadImage, fallbackExtract } = require('./ai-extractor');

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

  // Step 1: 如果没有外部传入 aiResult，使用兜底
  if (!aiResult.keywords && !aiResult.visualPrompt) {
    if (content && content.trim()) {
      // 内容存在但无 aiResult：尝试用 getArticlePrompt 解析（如果调用者传入了 aiResult 就跳过）
      // 注意：Skill 本身不调用 LLM，这里只是用兜底
    }
    aiResult = fallbackExtract(title);
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
  // 如果没有指定且 aiResult 没有，提供默认值
  if (!options.textColor && !aiResult.textColor) {
    textColor = '#111111';
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
  getArticlePrompt,
  parseArticleResult,
  getImagePrompt,
  parseImageResult,
};
