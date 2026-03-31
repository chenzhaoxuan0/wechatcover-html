const path = require('path');
const fs = require('fs');
const os = require('os');
const { extractFromArticle, analyzeImageColor, generateBackgroundImage, downloadImage, fallbackExtract } = require('./ai-extractor');

/**
 * 生成背景图并分析，返回背景图路径 + 文字颜色
 * @param {string} title - 文章标题
 * @param {string} content - 文章正文（可选，用于 AI 提取视觉描述）
 * @param {object} options
 * @param {string} options.backgroundImage - 外部指定背景图 URL 或本地路径（跳过 AI 生成）
 * @param {string} options.textColor - 手动指定文字色（跳过 AI 分析）
 * @param {string} options.outputDir - 输出目录
 * @returns {Promise<{bgImagePath: string, textColor: string, aiResult: object}>}
 */
async function prepareBackground(title, content, options = {}) {
  const outputDir = options.outputDir || os.tmpdir();
  const bgImagePath = path.join(outputDir, `bg_${Date.now()}.png`);

  let aiResult = {};
  let textColor = options.textColor || '#111111';

  try {
    // Step 1: AI 提取（如果提供了文章内容）
    if (content && content.trim()) {
      try {
        aiResult = await extractFromArticle(title, content);
      } catch (e) {
        console.warn('AI 提取失败，使用兜底方案:', e.message);
        aiResult = fallbackExtract(title);
      }
    } else {
      aiResult = fallbackExtract(title);
    }

    // Step 2: 生成背景图
    let bgUrl;
    if (options.backgroundImage) {
      // 外部指定背景图
      if (options.backgroundImage.startsWith('http')) {
        await downloadImage(options.backgroundImage, bgImagePath);
      } else {
        fs.copyFileSync(options.backgroundImage, bgImagePath);
      }
      bgUrl = options.backgroundImage;
    } else {
      // AI 生成
      try {
        const generatedPath = await generateBackgroundImage(aiResult.visualPrompt, bgImagePath);
        bgUrl = `file://${generatedPath.replace(/\\/g, '/')}`;
      } catch (e) {
        console.warn('背景图生成失败，使用纯色背景:', e.message);
        // 降级：创建纯色背景图（灰色）
        await createSolidColorBg(bgImagePath, '#888888');
        bgUrl = `file://${bgImagePath.replace(/\\/g, '/')}`;
      }
    }

    // Step 3: 分析图片颜色（如果没有手动指定）
    if (!options.textColor) {
      try {
        const analysis = await analyzeImageColor(bgUrl);
        textColor = analysis.textColor;
        aiResult.colorAnalysis = analysis;
      } catch (e) {
        console.warn('图片颜色分析失败，使用默认深色文字:', e.message);
        textColor = '#111111';
      }
    }

    return {
      bgImagePath,
      textColor,
      aiResult,
    };
  } catch (e) {
    console.error('背景处理失败:', e.message);
    // 降级：纯色背景 + 深色文字
    await createSolidColorBg(bgImagePath, '#888888');
    return {
      bgImagePath,
      textColor: '#111111',
      aiResult: fallbackExtract(title),
    };
  }
}

/**
 * 创建纯色背景图（降级用）
 * 使用 Puppeteer 截图一个纯色 HTML 来生成
 */
async function createSolidColorBg(outputPath, color) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:1920px;height:640px;background:${color};"></body></html>`;
  const { captureFromHtml } = require('./screenshot');
  const buf = await captureFromHtml(html, 1920, 640, outputPath);
  return buf;
}

module.exports = { prepareBackground };
