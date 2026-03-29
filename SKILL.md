---
name: wechatcover-html
description: |
  微信公众号封面图生成工具。当用户提到"生成微信公众号封面"、"公众号封面图"、"封面设计"、"生成封面"、"文章配图"时触发。
  根据文章标题自动推断配色方案，提取精准关键词作为主视觉大字，输出 3.35:1 拼接图（左侧 1:1 转发图 + 右侧 2.35:1 信息流图），两图共享几何图形元素保持视觉一致性。
---

# WechatCoverHTML Skill

根据文章标题生成微信公众号封面图，输出 3.35:1 拼接图（左侧 1:1 转发图 + 右侧 2.35:1 信息流图）。

## 使用方式

### Node.js API

```javascript
const { generateCover } = require('./src/index');

const result = await generateCover('你的文章标题', {
  colorScheme: '天空蓝',  // 可选，不传则自动推断
  outputPath: './output.png',  // 输出路径
  logoPath: './asset/inkspacebitbase200png.png',  // 可选 logo
});
// result.imagePath  — 拼接后 3.35:1 PNG 路径
// result.html1Path   — 1:1 HTML 过程文件（用于调试）
// result.html235Path — 2.35:1 HTML 过程文件（用于调试）
```

### 命令行

```bash
node src/main.js "文章标题" [输出路径]
```

## 输入参数

| 参数 | 类型 | 说明 |
|------|------|------|
| title | string | 文章标题（必填） |
| colorScheme | string | 配色档位，不填则自动推断 |
| outputPath | string | 输出 PNG 路径 |
| logoPath | string | 吉祥物 logo 路径 |

## 配色方案

共 6 档，**单色为主，禁止撞色**：

| 档位 | 背景色 | 图形/文字色 | 适用主题 |
|------|--------|-------------|----------|
| 黑白 | #FFFFFF | #111111 | 商务/技术 |
| 米色 | #F5F0E8 | #7A5230 | 温暖/生活 |
| 浅粉 | #FADADD | #B83A50 | 女性/情感 |
| 天空蓝 | #BFDCEF | #1A4E8A | 科技/理性 |
| 翠鸟绿 | #C8E6C9 | #1E5E2E | 增长/自然 |
| 清华紫 | #DDD0E8 | #5A3E7A | 创意/学术 |

## 精准关键词

从标题中自动提取精准关键词（不取大而泛的词），作为主视觉大字显示在左上角。支持以下精准词：

私域流量、神经网络、裂变、SaaS、Prompt、极简主义、用户旅程、回归分析、高敏感、股权融资、公域引流、拼团、分销、NLP、机器学习、深度学习、计算机视觉、RAG、向量数据库、Prompt工程、GPT-4、AIGC、ChatGPT、Stable Diffusion、MVP、PMF、护城河、差异化、私有化部署、云原生、Docker、Kubernetes、微服务、AB测试、灰度发布、增长黑客、北极星指标、标签体系、用户画像、实证研究、因子分析、回归分析、结构方程、SEM、中介效应、调节效应、文献综述、meta分析、随机对照、双盲实验、依恋类型、原生家庭、认知偏差、心流、内啡肽、多巴胺、血清素、情绪劳动、情感勒索、煤气灯、讨好型、高敏感、回避型、焦虑型、断舍离、露营、自驾游、深度游、小众目的地、攻略、咖啡探店、美食探店、早午餐、仪式感 等。

## 布局规格

所有图高度统一为 **600px**：

- **2.35:1 信息流图**：1410 × 600 px
- **1:1 转发图**：600 × 600 px
- **拼接总图**：2010 × 600 px（3.35:1）

**左侧 1:1 转发图**：关键字大字（占图面 40%+）在左上，标题小字在左下，logo 在右下
**右侧 2.35:1 信息流图**：关键字大字在左上，标题小字在左下，几何装饰图形在右侧，logo 在右下

背景：左深右浅渐变 + 白色颗粒纹理叠加

## 项目结构

```
wechatcoverHTML/
├── SKILL.md
├── package.json
├── src/
│   ├── index.js           # generateCover() 主入口
│   ├── color-schemes.js   # 配色方案 + 关键词推断
│   ├── geometry-pool.js   # 基于 seed 的几何图形池
│   ├── layout-engine.js   # 布局计算
│   ├── html-generator.js  # HTML 生成（渐变+颗粒+图形+文字）
│   ├── screenshot.js      # Puppeteer 截图
│   ├── stitcher.js        # Canvas 左右拼接
│   └── main.js           # CLI 入口
└── asset/
    └── inkspacebitbase200png.png  # 吉祥物 logo
```

## 安装依赖

```bash
cd wechatcoverHTML
npm install
```

## 依赖

- Node.js
- puppeteer
- canvas
- html2canvas
