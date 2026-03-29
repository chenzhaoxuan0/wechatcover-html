const COLOR_SCHEMES = {
  '黑白': { bg: '#FFFFFF', fg: '#111111' },
  '米色': { bg: '#F5F0E8', fg: '#7A5230' },
  '浅粉': { bg: '#FADADD', fg: '#B83A50' },
  '天空蓝': { bg: '#BFDCEF', fg: '#1A4E8A' },
  '翠鸟绿': { bg: '#C8E6C9', fg: '#1E5E2E' },
  '清华紫': { bg: '#DDD0E8', fg: '#5A3E7A' },
};

const SCHEME_KEYS = Object.keys(COLOR_SCHEMES);

const KEYWORD_MAP = {
  '天空蓝': ['科技', '技术', 'AI', '数据', '智能', '理性', '系统', '代码', '互联网', '产品', '分析'],
  '翠鸟绿': ['增长', '自然', '绿色', '环保', '健康', '创业', '商业', '市场', '运营', '营销'],
  '浅粉': ['情感', '女性', '心理', '爱情', '心情', '感悟', '心灵'],
  '清华紫': ['创意', '学术', '设计', '艺术', '研究', '论文', '思想', '文化', '人文'],
  '米色': ['生活', '温暖', '家居', '美食', '旅行', '日常', '记录', '生活方式'],
  '黑白': ['商务', '企业', '管理', '职场', '会议', '报告', '新闻', '公告', '官方'],
};

function inferScheme(title) {
  for (const [scheme, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(k => title.includes(k))) {
      return scheme;
    }
  }
  return '黑白';
}

// 精准关键词词典（不取大而泛的词，要具体精准）
const PRECISE_KEYWORD_DICT = [
  // 科技/AI
  '神经网络', '大模型', 'LLM', 'AGI', 'AIGC', 'ChatGPT', 'GPT-4', 'Stable Diffusion', 'Midjourney',
  'RAG', '向量数据库', 'Embedding', 'Token', 'Prompt', 'Agent', 'RPA', '低代码',
  '私有化部署', '云原生', 'Docker', 'Kubernetes', 'K8s', '微服务', 'Service Mesh',
  '数据挖掘', '机器学习', '深度学习', '计算机视觉', 'NLP', '语音识别', '知识图谱',
  // 增长/运营
  '私域流量', '公域引流', '裂变', '拼团', '分销', '社群运营', 'SOP', '转化率',
  'GMV', 'ARPU', 'LTV', 'CAC', 'ROI', '复购', '留存', '促活', '拉新',
  '用户画像', '标签体系', 'AB测试', '灰度发布', '增长黑客', '北极星指标',
  // 商业/创业
  '商业模式', 'MVP', 'PMF', '壁垒', '护城河', '差异化', '垂直整合', '平台化',
  'SaaS', 'PaaS', 'IaaS', '订阅制', '增值服务', '生态位', '估值',
  '股权融资', '天使投资', 'VC', 'PE', '并购', 'IPO', '上市',
  // 产品/设计
  'PRD', 'MRD', 'BRD', '用户旅程', '信息架构', '交互设计', '可用性测试', '原型图',
  '设计系统', '组件库', 'Design Token', 'MVP产品', '产品迭代', '需求管理', '敏捷开发', 'Scrum',
  // 学术/研究
  '实证研究', '因子分析', '回归分析', '结构方程', 'SEM', '中介效应', '调节效应',
  '文献综述', 'meta分析', '随机对照', '双盲实验', '样本量', '显著性',
  // 情感/心理
  '依恋类型', '原生家庭', '认知偏差', '心流', '内啡肽', '多巴胺', '血清素',
  '情绪劳动', '情感勒索', '煤气灯', 'PUA', '讨好型', '高敏感', '回避型', '焦虑型',
  // 生活/旅行
  '极简主义', '断舍离', '露营', '自驾游', '深度游', '小众目的地', '攻略',
  '咖啡探店', '美食探店', '早午餐', '仪式感', '生活方式博主',
];

function extractKeywords(title) {
  const found = PRECISE_KEYWORD_DICT.filter(kw => title.includes(kw));
  return found.slice(0, 3); // 最多3个精准词
}

module.exports = { COLOR_SCHEMES, SCHEME_KEYS, inferScheme, extractKeywords };
