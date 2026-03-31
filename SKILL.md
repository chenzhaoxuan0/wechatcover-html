---
name: wechatcover-html
description: |
  微信公众号封面图生成工具。当用户提到"生成微信公众号封面"、"公众号封面图"、"封面设计"、"生成封面"、"文章配图"时触发。
  根据文章正文自动提取关键词和视觉描述，调用 MiniMax image-01 生成横版背景图，AI 分析图片色调后自动选择高对比度文字色，输出 3.35:1 拼接图（左侧 1:1 转发图 + 右侧 2.35:1 信息流图），两图共享几何图形元素保持视觉一致性。
---

# WechatCoverHTML Skill

根据文章内容生成微信公众号封面图，输出 3.35:1 拼接图（左侧 1:1 转发图 + 右侧 2.35:1 信息流图）。

## 核心流程

```
标题 + 文章正文
    ↓
① AI 提取摘要 + 视觉描述 + 关键词（Chat API）
    ↓
② image-01 生成横版背景图
    ↓
③ AI 分析图片色调 → 自动选择高对比文字色（#111111 或 #FFFFFF）
    ↓
④ HTML 生成（背景图 + 关键词 + 标题 + Logo）
    ↓
⑤ Puppeteer 截图 × 2 → Canvas 拼接 → 最终 PNG
```

## 使用方式

### Node.js API

```javascript
const { generateCover } = require('./src/index');

const result = await generateCover('你的文章标题', {
  articleContent: '文章正文内容...',  // 必填，用于 AI 提取关键词和视觉描述
  outputPath: './output.png',        // 输出路径
  logoPath: './asset/inkspacebitbase200png.png',  // 可选 logo
  backgroundImage: 'https://...',    // 可选，外部指定背景图（跳过 AI 生成）
  textColor: '#111111',             // 可选，手动指定文字色
});
// result.imagePath  — 拼接后 3.35:1 PNG 路径
// result.html1Path   — 1:1 HTML 过程文件（用于调试）
// result.html235Path — 2.35:1 HTML 过程文件（用于调试）
// result.aiResult    — AI 提取结果 { summary, visualPrompt, keywords, colorAnalysis }
// result.bgImagePath — 背景图路径
```

### 命令行

```bash
node src/main.js "文章标题" --content=@article.txt --output=./output.png
# --content=@file.txt  从文件读取文章正文
# --content=直接文字   直接传入文章正文
```

## 输入参数

| 参数 | 类型 | 说明 |
|------|------|------|
| title | string | 文章标题（必填） |
| articleContent | string | 文章正文（用于 AI 提取关键词和视觉描述） |
| outputPath | string | 输出 PNG 路径 |
| logoPath | string | 吉祥物 logo 路径 |
| backgroundImage | string | 可选，外部指定背景图 URL 或本地路径 |
| textColor | string | 可选，手动指定文字色（#111111 或 #FFFFFF） |

## 文字颜色决策

由 AI 分析背景图自动决定：

| 背景图色调 | 文字颜色 |
|-----------|----------|
| 明亮背景 | #111111（深色） |
| 暗色背景 | #FFFFFF（浅色） |
| 中间调 | 根据冷/暖色调判断 |

## 布局规格

所有图高度统一为 **600px**：

- **2.35:1 信息流图**：1410 × 600 px
- **1:1 转发图**：600 × 600 px
- **拼接总图**：2010 × 600 px（3.35:1）

背景图：`background-size: cover`，保持比例裁剪，两图共享同一张。

## 项目结构

```
wechatcoverHTML/
├── SKILL.md
├── package.json
├── src/
│   ├── index.js           # generateCover() 主入口（新 pipeline）
│   ├── ai-extractor.js    # Chat API：提取摘要+视觉描述+关键词
│   ├── image-background.js # image-01 生成 + 颜色分析
│   ├── color-schemes.js   # 配色方案（备用）
│   ├── geometry-pool.js   # 几何图形池
│   ├── layout-engine.js   # 布局计算
│   ├── html-generator.js  # HTML 生成（支持背景图）
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

## 环境变量

需要设置 MiniMax API Key：

```bash
export MINIMAX_API_KEY="sk-..."
export MINIMAX_API_HOST="https://api.minimaxi.com"  # 中国大陆
# 或
export MINIMAX_API_HOST="https://api.minimax.io"    # 全球
```

## 依赖

- Node.js
- puppeteer
- canvas
