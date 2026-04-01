---
name: wechatcover-html
description: |
  微信公众号封面图生成工具。当用户提到"生成微信公众号封面"、"公众号封面图"、"封面设计"、"生成封面"、"文章配图"时触发。
  不调用 LLM，由调用者（Agent）自行用 LLM 解析关键词和视觉描述，Skill 只负责生成背景图、布局、截图等纯计算任务。
  背景图使用 MiniMax image-01 生成，输出 3.35:1 拼接图（左侧 1:1 转发图 + 右侧 2.35:1 信息流图），两图共享几何图形元素保持视觉一致性。

onLaunch:
  - prompt: |
      即将使用微信公众号封面图生成工具。
      如果你有吉祥物 logo 图片（建议尺寸 200×200px 或更高），请提供完整路径（如 ./asset/inkspacebitbase200png.png），生成时将自动嵌入封面右下角。
      如果没有 logo，或不确定，请回复"无"，封面将不带 logo。
      请提供 logo 路径（或回复"无"）：
    memoryKey: wechatcover_logo_path
    saveToMemory: true
    ifUnanswered: skip
---

# WechatCoverHTML Skill

根据文章内容生成微信公众号封面图，输出 3.35:1 拼接图（左侧 1:1 转发图 + 右侧 2.35:1 信息流图）。

**架构原则**：Skill 不调用任何 LLM。LLM 解析由调用者（Agent）自行完成，Skill 只负责纯计算任务（生成背景图、布局、截图）。

## 核心流程

```
┌─────────────────────────────────────────────────────────────┐
│  调用者（Agent）                                              │
│                                                              │
│  方式 A：无 LLM（兜底）                                       │
│  generateCover(title) ────────────────────────────→ 兜底结果  │
│                                                              │
│  方式 B：先 LLM 解析，再生成封面                               │
│  1. getArticlePrompt(title, content)                         │
│                    ↓                                         │
│  2. Agent 自行调用自己的 LLM 解析                             │
│                    ↓                                         │
│  3. parseArticleResult(llmResult) ──→ aiResult              │
│                    ↓                                         │
│  4. generateCover(title, { aiResult }) ─────────→ 封面图片   │
└─────────────────────────────────────────────────────────────┘
```

## 使用方式

### 方式 1：Agent 自行 LLM 解析（推荐）

```javascript
const { generateCover, getArticlePrompt, parseArticleResult, getImagePrompt, parseImageResult } = require('./src/index');

// 1. Agent 自行用 LLM 解析文章
const prompt = getArticlePrompt(title, content);
const llmResult = await agentLLM(prompt.systemPrompt, prompt.userPrompt);  // Agent 自己的 LLM
const aiResult = parseArticleResult(llmResult);

// 2. 传入已解析结果
const result = await generateCover(title, {
  articleContent: content,
  aiResult,  // { summary, visualPrompt, keywords }
  logoPath: './asset/inkspacebitbase200png.png',
  outputPath: './output.png',
});
```

### 方式 2：直接用（兜底关键词）

```javascript
const { generateCover } = require('./src/index');

// 使用兜底关键词（标题前6字），背景图使用默认渐变
const result = await generateCover(title, {
  logoPath: './asset/inkspacebitbase200png.png',
});
```

## 导出函数

| 函数 | 说明 |
|------|------|
| `generateCover(title, options)` | 主入口，生成封面图 |
| `getArticlePrompt(title, content)` | 获取文章分析 Prompt，供 Agent 自行 LLM 解析 |
| `parseArticleResult(text)` | 解析 LLM 返回的文章分析 JSON |
| `getImagePrompt(imageUrl)` | 获取图片分析 Prompt |
| `parseImageResult(text)` | 解析 LLM 返回的图片分析 JSON |

## 输入参数

| 参数 | 类型 | 说明 |
|------|------|------|
| title | string | 文章标题（必填） |
| articleContent | string | 文章正文（用于生成 Prompt） |
| outputPath | string | 输出 PNG 路径 |
| logoPath | string | 吉祥物 logo 路径 |
| backgroundImage | string | 可选，外部指定背景图 URL 或本地路径 |
| textColor | string | 可选，手动指定文字色（#111111 或 #FFFFFF） |
| aiResult | object | 可选，预解析结果 `{ summary, visualPrompt, keywords, textColor }` |

## 返回值

```javascript
{
  imagePath: string,      // 拼接后 3.35:1 PNG 路径
  preview1to1: Buffer,     // 1:1 图 Buffer
  preview235to1: Buffer,  // 2.35:1 图 Buffer
  html1Path: string,      // 1:1 HTML 过程文件
  html235Path: string,     // 2.35:1 HTML 过程文件
  aiResult: object,       // AI 提取结果 { summary, visualPrompt, keywords }
  bgImagePath: string,    // 背景图路径
}
```

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
│   ├── index.js            # generateCover() 主入口 + Prompt 导出
│   ├── ai-extractor.js    # Prompt 生成 + JSON 解析（不调用 LLM）
│   ├── image-background.js # 背景图处理（仅 generateBackgroundImage 用 MiniMax）
│   ├── geometry-pool.js    # 几何图形池
│   ├── layout-engine.js    # 布局计算
│   ├── html-generator.js   # HTML 生成
│   ├── screenshot.js       # Puppeteer 截图
│   ├── stitcher.js         # Canvas 左右拼接
│   └── main.js            # CLI 入口
└── asset/
    └── inkspacebitbase200png.png  # 吉祥物 logo
```

## 安装依赖

```bash
cd wechatcoverHTML
npm install
```

## 环境变量

生成背景图需要 MiniMax API Key：

```bash
export MINIMAX_API_KEY="sk-..."
export MINIMAX_API_HOST="https://api.minimaxi.com"  # 中国大陆
# 或
export MINIMAX_API_HOST="https://api.minimax.io"    # 全球
```

**注意**：Skill 本身不调用任何 LLM。LLM 解析由 Agent 自行完成（使用 Agent 自己的 API Key）。

## 依赖

- Node.js
- puppeteer
- canvas
