const fs = require('fs');
const pathModule = require('path');

function shapeToCSS(shape, color) {
  const { type, px, py, size, opacity, rotation, variant } = shape;
  const style = `position:absolute;left:${px}px;top:${py}px;opacity:${opacity};transform:rotate(${rotation}deg);color:${color};`;

  switch (type) {
    case 'circle':
      return `<div style="${style}width:${size}px;height:${size}px;border-radius:50%;background:${variant === 'filled' ? 'currentColor' : 'none'};border:${variant === 'outline' ? `2px solid ${color}` : 'none'};"></div>`;
    case 'triangle':
      return `<div style="${style}width:0;height:0;border-left:${size/2}px solid transparent;border-right:${size/2}px solid transparent;border-bottom:${size}px solid ${variant === 'filled' ? 'currentColor' : 'none'};"></div>`;
    case 'rect':
      return `<div style="${style}width:${size}px;height:${size}px;background:${variant === 'filled' ? 'currentColor' : 'none'};border:${variant === 'outline' ? `2px solid ${color}` : 'none'};"></div>`;
    case 'line':
      return `<div style="${style}width:${size}px;height:2px;background:${color};"></div>`;
    default:
      return '';
  }
}

class HtmlGenerator {
  /**
   * @param {number} width - 画布宽度
   * @param {number} height - 画布高度
   * @param {string} textColor - 文字颜色（来自 AI 分析，#111111 或 #FFFFFF）
   * @param {object} options
   * @param {string} options.bgImage - 背景图文件路径（本地路径）
   */
  constructor(width, height, textColor, options = {}) {
    this.width = width;
    this.height = height;
    this.textColor = textColor;
    this.bgImage = options.bgImage || null;
  }

  generate({ title, keywords, shapes, layout, logoPath }) {
    // 背景图：优先内嵌 base64（避免 file:// 跨域问题），退化为 file:// URL
    let bgStyle = '';
    if (this.bgImage) {
      try {
        const imgData = fs.readFileSync(this.bgImage);
        // 按内容检测 MIME 类型，避免扩展名与实际格式不符（如 mmx 输出 jpg 但命名为 png）
        const magic = imgData[0];
        const mime = (magic === 0xFF && imgData[1] === 0xD8) ? 'image/jpeg'
                  : (magic === 0x89 && imgData[2] === 0x50 && imgData[3] === 0x4E) ? 'image/png'
                  : 'image/png';
        const dataUri = `data:${mime};base64,${imgData.toString('base64')}`;
        bgStyle = `background-image:url('${dataUri}');background-size:cover;background-position:center;`;
      } catch (e) {
        // 文件读取失败，降级为 file:// URL
        bgStyle = `background-image:url('file://${this.bgImage.replace(/\\/g, '/')}');background-size:cover;background-position:center;`;
      }
    }

    // 关键字 HTML
    const keywordsHTML = keywords && keywords.length > 0
      ? `<div style="position:absolute;left:${layout.keywords.x}px;top:${layout.keywords.y}px;max-width:${layout.keywords.maxWidth}px;z-index:10;">${
          keywords.map((kw, i) =>
            `<div style="font-size:${layout.keywords.fontSize}px;font-weight:900;color:${this.textColor};font-family:system-ui,-apple-system,sans-serif;line-height:${layout.keywords.lineHeight}px;letter-spacing:-1px;">${this._escapeHtml(kw)}</div>`
          ).join('')
        }</div>`
      : '';

    // 标题 HTML
    const titleHTML = title
      ? `<div style="position:absolute;left:${layout.title.x}px;bottom:${layout.title.y}px;font-size:${layout.title.fontSize}px;color:${this.textColor};font-family:system-ui,-apple-system,sans-serif;opacity:0.85;max-width:${layout.title.maxWidth}px;line-height:1.4;white-space:nowrap;z-index:10;">${this._escapeHtml(title)}</div>`
      : '';

    // 图形 HTML
    const shapesHTML = shapes && shapes.length > 0
      ? shapes.map(shape => shapeToCSS(shape, this.textColor)).join('\n')
      : '';

    // Logo HTML - 嵌入 base64 Data URI（跨计算机兼容）
    let logoDataUri = '';
    if (logoPath) {
      try {
        const ext = pathModule.extname(logoPath).slice(1);
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const base64 = fs.readFileSync(logoPath).toString('base64');
        logoDataUri = `data:${mime};base64,${base64}`;
      } catch (e) {
        console.warn('Logo file read failed:', e.message);
      }
    }
    const logoHTML = logoDataUri
      ? `<div style="position:absolute;left:${layout.logo.x}px;top:${layout.logo.y}px;height:${layout.logo.height}px;z-index:20;"><img src="${logoDataUri}" style="height:100%;width:auto;display:block;" /></div>`
      : '';

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;overflow:hidden;width:${this.width}px;height:${this.height}px;">
<div style="width:${this.width}px;height:${this.height}px;${bgStyle}position:relative;overflow:hidden;">
${shapesHTML}
${keywordsHTML}
${titleHTML}
${logoHTML}
</div>
</body>
</html>`;
  }

  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

module.exports = HtmlGenerator;
