const SHAPE_TYPES = ['circle', 'triangle', 'rect', 'line'];

function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

class GeometryPool {
  /**
   * @param {string} title - 文章标题（用于 seed）
   * @param {string} schemeKey - 保留参数（兼容旧代码），但不再使用
   * @param {string} textColor - 文字色（来自 AI 分析）
   */
  constructor(title, schemeKey, textColor = '#111111') {
    this.textColor = textColor;
    this.seed = hashString(title + (schemeKey || 'default'));
    this.rng = seededRandom(this.seed);
    this.shapes = this._generateShapes();
  }

  setTextColor(textColor) {
    this.textColor = textColor;
  }

  _generateShapes() {
    const count = 4 + Math.floor(this.rng() * 2); // 4-5 个图形
    const shapes = [];
    for (let i = 0; i < count; i++) {
      const type = SHAPE_TYPES[Math.floor(this.rng() * SHAPE_TYPES.length)];
      shapes.push({
        type,
        size: 30 + Math.floor(this.rng() * 80), // 30-110px
        x: this.rng(),
        y: this.rng(),
        opacity: 0.15 + this.rng() * 0.5, // 0.15-0.65
        rotation: Math.floor(this.rng() * 360),
        variant: this.rng() > 0.5 ? 'filled' : 'outline',
      });
    }
    return shapes;
  }

  getShapes() {
    return this.shapes;
  }

  getColors() {
    return { textColor: this.textColor };
  }
}

module.exports = { GeometryPool };
