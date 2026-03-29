function shapeToCSS(shape) {
  const { type, px, py, size, opacity, rotation, variant } = shape;
  const style = `position:absolute;left:${px}px;top:${py}px;opacity:${opacity};transform:rotate(${rotation}deg);`;

  switch (type) {
    case 'circle':
      return `<div style="${style}width:${size}px;height:${size}px;border-radius:50%;background:${variant === 'filled' ? 'currentColor' : 'none'};border:${variant === 'outline' ? '2px solid currentColor' : 'none'};"></div>`;
    case 'triangle':
      return `<div style="${style}width:0;height:0;border-left:${size/2}px solid transparent;border-right:${size/2}px solid transparent;border-bottom:${size}px solid ${variant === 'filled' ? 'currentColor' : 'none'};"></div>`;
    case 'rect':
      return `<div style="${style}width:${size}px;height:${size}px;background:${variant === 'filled' ? 'currentColor' : 'none'};border:${variant === 'outline' ? '2px solid currentColor' : 'none'};"></div>`;
    case 'line':
      return `<div style="${style}width:${size}px;height:2px;background:currentColor;"></div>`;
    default:
      return '';
  }
}

class HtmlGenerator {
  constructor(width, height, bg, fg) {
    this.width = width;
    this.height = height;
    this.bg = bg;
    this.fg = fg;
  }

  generate({ title, keywords, shapes, layout, logoPath }) {
    // 渐变背景：左深右浅
    const gradientBg = this._buildGradient();

    // SVG 颗粒纹理
    const noiseSvg = this._buildNoiseSvg();

    // 关键字 HTML（绝对定位在左侧区域）
    const keywordsHTML = keywords && keywords.length > 0
      ? `<div style="position:absolute;left:${layout.keywords.x}px;top:${layout.keywords.y}px;max-width:${layout.keywords.maxWidth}px;">${
          keywords.map((kw, i) =>
            `<div style="font-size:${layout.keywords.fontSize}px;font-weight:900;color:${this.fg};font-family:system-ui,-apple-system,sans-serif;line-height:${layout.keywords.lineHeight}px;letter-spacing:-1px;">${this._escapeHtml(kw)}</div>`
          ).join('')
        }</div>`
      : '';

    // 标题 HTML（小字，左下角）
    const titleHTML = title
      ? `<div style="position:absolute;left:${layout.title.x}px;bottom:${layout.title.y}px;font-size:${layout.title.fontSize}px;color:${this.fg};font-family:system-ui,-apple-system,sans-serif;opacity:0.7;max-width:${layout.title.maxWidth}px;line-height:1.4;white-space:nowrap;">${this._escapeHtml(title)}</div>`
      : '';

    // 图形 HTML
    const shapesHTML = shapes.map(shapeToCSS).join('\n');

    // Logo HTML（右下角）
    const logoHTML = logoPath
      ? `<div style="position:absolute;left:${layout.logo.x}px;top:${layout.logo.y}px;height:${layout.logo.height}px;"><img src="file://${logoPath.replace(/\\/g, '/')}" style="height:100%;width:auto;display:block;" /></div>`
      : '';

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;overflow:hidden;width:${this.width}px;height:${this.height}px;">
${gradientBg}
${noiseSvg}
${shapesHTML}
${keywordsHTML}
${titleHTML}
${logoHTML}
</body>
</html>`;
  }

  _buildGradient() {
    const gradId = 'g1';
    return `<svg width="${this.width}" height="${this.height}" style="position:absolute;top:0;left:0;z-index:0;">
  <defs>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${this.fg}" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="${this.fg}" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="${this.bg}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${this.width}" height="${this.height}" fill="url(#${gradId})"/>
</svg>`;
  }

  _buildNoiseSvg() {
    return `<svg width="${this.width}" height="${this.height}" style="position:absolute;top:0;left:0;z-index:1;pointer-events:none;opacity:0.035;" xmlns="http://www.w3.org/2000/svg">
  <filter id="noise">
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#noise)" fill="white"/>
</svg>`;
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
