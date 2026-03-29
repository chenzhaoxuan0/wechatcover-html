const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

async function stitchImages(buf1to1, buf235to1, width1to1, height, outputPath) {
  const totalWidth = width1to1 + 1410; // 1:1(600) + 2.35:1(1410) = 2010
  const canvas = createCanvas(totalWidth, height);
  const ctx = canvas.getContext('2d');

  // 白色背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidth, height);

  // 绘制 1:1 图（左侧）
  const img1 = await loadImage(buf1to1);
  ctx.drawImage(img1, 0, 0, width1to1, height);

  // 绘制 2.35:1 图（右侧）
  const img2 = await loadImage(buf235to1);
  ctx.drawImage(img2, width1to1, 0, 1410, height);

  const buffer = canvas.toBuffer('image/png');
  if (outputPath) {
    fs.writeFileSync(outputPath, buffer);
  }
  return buffer;
}

module.exports = { stitchImages };
