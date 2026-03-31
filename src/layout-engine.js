class LayoutEngine {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  computeLayout(keywords, logoPath) {
    const leftWidth = Math.round(this.width * 0.38);

    return {
      keywords: {
        x: Math.round(this.width * 0.05),
        y: Math.round(this.height * 0.06),
        maxWidth: 1085, // x=71 到 x=1156
        lineHeight: Math.round(this.width * 0.105), // 1.5倍行高（约127px for 1410宽）
        fontSize: Math.round(this.width * 0.075),
      },
      title: {
        x: Math.round(this.width * 0.05),
        y: 35,
        maxWidth: leftWidth - 60,
        fontSize: Math.round(this.width * 0.032), // 标题字号再加大
        nowrap: true,                             // 不换行
      },
      shapes: {
        offsetX: leftWidth,
      },
      logo: {
        x: this.width - Math.round(this.height * 0.33) + 50, // 往右移50px
        y: this.height - Math.round(this.height * 0.33),
        height: Math.round(this.height * 0.30),
      },
    };
  }

  computeShapePositions(pool, layout) {
    const shapes = pool.getShapes();
    return shapes.map(shape => ({
      ...shape,
      px: layout.shapes.offsetX + shape.x * (this.width - layout.shapes.offsetX),
      py: shape.y * this.height,
    }));
  }
}

module.exports = LayoutEngine;
