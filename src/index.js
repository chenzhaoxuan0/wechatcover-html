const path = require('path');
const fs = require('fs');
const os = require('os');
const { prepareBackground } = require('./image-background');
const { GeometryPool } = require('./geometry-pool');
const LayoutEngine = require('./layout-engine');
const HtmlGenerator = require('./html-generator');
const { captureFromHtml } = require('./screenshot');
const { stitchImages } = require('./stitcher');

async function generateCover(title, options = {}) {
  if (!title || title.trim() === '') {
    throw new Error('标题不能为空');
  }

  const outputPath = options.outputPath || path.join(os.tmpdir(), `wechatcover_${Date.now()}.png`);
  const logoPath = options.logoPath || null;
  const articleContent = options.articleContent || null;

  // Step 1: 准备背景图 + AI 分析文字颜色
  const { bgImagePath, textColor, aiResult } = await prepareBackground(
    title,
    articleContent,
    {
      backgroundImage: options.backgroundImage || null,
      textColor: options.textColor || null,
      outputDir: os.tmpdir(),
    }
  );

  // Step 2: 提取关键词（来自 AI 结果）
  const keywords = aiResult.keywords && aiResult.keywords.length > 0
    ? aiResult.keywords
    : [title.slice(0, 6)]; //兜底：用标题前6字

  // 尺寸规格
  const W1 = 600;    // 1:1 宽高
  const W235 = 1410; // 2.35:1 宽
  const H = 600;     // 统一高度

  // 创建图形池（seed 保证两图一致）
  const pool = new GeometryPool(title, 'default');
  pool.setTextColor(textColor);

  // 2.35:1 布局
  const engine235 = new LayoutEngine(W235, H);
  const layout235 = engine235.computeLayout(keywords, logoPath);
  const shapes235 = engine235.computeShapePositions(pool, layout235);

  // 1:1 布局（关键字只取第一个）
  const engine1 = new LayoutEngine(W1, H);
  const layout1 = engine1.computeLayout(keywords.slice(0, 1), logoPath);
  // 方图关键字字号放大
  layout1.keywords.fontSize = Math.round(W1 * 0.20);
  layout1.keywords.lineHeight = Math.round(W1 * 0.22);
  layout1.keywords.maxWidth = W1 - 60;
  layout1.shapes.offsetX = Math.round(W1 * 0.4);
  layout1.title.maxWidth = W1 - 60;
  const shapes1 = engine1.computeShapePositions(pool, layout1);

  // HTML 生成（传入背景图和文字色）
  const gen235 = new HtmlGenerator(W235, H, textColor, { bgImage: bgImagePath });
  const gen1 = new HtmlGenerator(W1, H, textColor, { bgImage: bgImagePath });

  const html235 = gen235.generate({ title, keywords, shapes: shapes235, layout: layout235, logoPath });
  const html1 = gen1.generate({ title, keywords: keywords.slice(0, 1), shapes: shapes1, layout: layout1, logoPath });

  // 截图（重试 2 次）
  let buf235, buf1;
  let retries = 0;
  while (retries < 2) {
    try {
      buf235 = await captureFromHtml(html235, W235, H);
      buf1 = await captureFromHtml(html1, W1, H);
      break;
    } catch (e) {
      retries++;
      if (retries >= 2) {
        throw new Error(`截图失败: ${e.message}`);
      }
    }
  }

  // 拼接
  const finalBuf = await stitchImages(buf1, buf235, W1, H, outputPath);

  // 保存过程 HTML 文件
  const html1Path = outputPath.replace('.png', '_1x1.html');
  const html235Path = outputPath.replace('.png', '_235x1.html');
  fs.writeFileSync(html1Path, html1, 'utf8');
  fs.writeFileSync(html235Path, html235, 'utf8');

  return {
    imagePath: outputPath,
    preview1to1: buf1,
    preview235to1: buf235,
    html1Path,
    html235Path,
    aiResult,
    bgImagePath,
  };
}

module.exports = { generateCover };
