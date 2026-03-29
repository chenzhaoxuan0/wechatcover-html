const { generateCover } = require('./index');
const path = require('path');

async function main() {
  const title = process.argv[2] || '默认标题';
  const output = process.argv[3] || path.join(__dirname, '..', 'output.png');
  const logoPath = path.join(__dirname, '..', 'asset', 'inkspacebitbase200png.png');
  try {
    const result = await generateCover(title, {
      outputPath: output,
      logoPath,
    });
    console.log('封面已生成:', result.imagePath);
  } catch (e) {
    console.error('生成失败:', e.message);
    process.exit(1);
  }
}

main();
