const { generateCover } = require('./index');
const path = require('path');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const title = args.find(a => !a.startsWith('--')) || '默认标题';
  const outputArg = args.find(a => a.startsWith('--output='));
  const output = outputArg ? outputArg.split('=')[1] : path.join(__dirname, '..', 'output.png');
  const logoPath = path.join(__dirname, '..', 'asset', 'inkspacebitbase200png.png');

  // 读取文章正文（--content=@filename 或 --content=直接内容）
  const contentArg = args.find(a => a.startsWith('--content='));
  let articleContent = null;
  if (contentArg) {
    const contentValue = contentArg.split('=')[1];
    if (contentValue.startsWith('@')) {
      const filePath = contentValue.slice(1);
      articleContent = fs.readFileSync(filePath, 'utf8');
    } else {
      articleContent = contentValue;
    }
  }

  try {
    const result = await generateCover(title, {
      outputPath: output,
      logoPath,
      articleContent,
    });
    console.log('封面已生成:', result.imagePath);
    if (result.aiResult) {
      console.log('AI 提取关键词:', result.aiResult.keywords);
      console.log('文字颜色:', result.aiResult.colorAnalysis?.textColor || '默认深色');
    }
  } catch (e) {
    console.error('生成失败:', e.message);
    process.exit(1);
  }
}

main();
