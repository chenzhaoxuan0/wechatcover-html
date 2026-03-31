// 配色方案（保留备用，不再强制使用）
const COLOR_SCHEMES = {
  '黑白': { bg: '#FFFFFF', fg: '#111111' },
  '米色': { bg: '#F5F0E8', fg: '#7A5230' },
  '浅粉': { bg: '#FADADD', fg: '#B83A50' },
  '天空蓝': { bg: '#BFDCEF', fg: '#1A4E8A' },
  '翠鸟绿': { bg: '#C8E6C9', fg: '#1E5E2E' },
  '清华紫': { bg: '#DDD0E8', fg: '#5A3E7A' },
};

const SCHEME_KEYS = Object.keys(COLOR_SCHEMES);

/**
 * 根据标题推断配色（备用方案，当没有文章内容时使用）
 */
function inferScheme(title) {
  const KEYWORD_MAP = {
    '天空蓝': ['科技', '技术', 'AI', '数据', '智能', '理性', '系统', '代码', '互联网', '产品', '分析'],
    '翠鸟绿': ['增长', '自然', '绿色', '环保', '健康', '创业', '商业', '市场', '运营', '营销'],
    '浅粉': ['情感', '女性', '心理', '爱情', '心情', '感悟', '心灵'],
    '清华紫': ['创意', '学术', '设计', '艺术', '研究', '论文', '思想', '文化', '人文'],
    '米色': ['生活', '温暖', '家居', '美食', '旅行', '日常', '记录', '生活方式'],
    '黑白': ['商务', '企业', '管理', '职场', '会议', '报告', '新闻', '公告', '官方'],
  };

  for (const [scheme, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(k => title.includes(k))) {
      return scheme;
    }
  }
  return '黑白';
}

module.exports = { COLOR_SCHEMES, SCHEME_KEYS, inferScheme };
