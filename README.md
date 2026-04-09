# WechatCoverHTML

<div align="center">

![封面预览](https://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com/ccv2%2F2026-04-01%2FMiniMax-M2.7%2F2022235502865813945%2Fc307d7c4720d899676b8537c370d9ee7526b6a2bd26be62828229fd4023de4b2..png?Expires=1775068198&OSSAccessKeyId=LTAI5tGLnRTkBjLuYPjNcKQ8&Signature=GGfJXvrU0RqGM4NmH%2BJ%2FnHGQwEY%3D)

**微信公众号封面图生成工具 — Claude Code Skill**

根据文章标题或正文自动生成公众号封面图，支持 3.35:1 拼接图（左侧 1:1 转发图 + 右侧 2.35:1 信息流图）

</div>

---

## 中文

### 项目简介

WechatCoverHTML 是一个 Claude Code Skill，可根据文章标题自动生成微信公众号封面图。

**核心功能：**
- MiniMax text API 智能提取关键词和视觉描述（内部完成，无需外部 LLM）
- MiniMax image-01 生成横版 AI 背景图
- Canvas 分析背景图亮度，自动选择高对比度文字色（白字或黑字）
- 输出 3.35:1 拼接图，同时适配转发场景（1:1）和信息流场景（2.35:1）
- 左右两图共享几何图形元素，保持视觉一致性
- 支持自定义吉祥物 Logo（右下角嵌入）

**使用方式：** 当你在 Claude Code 中提到"生成微信公众号封面"、"公众号封面图"等关键词时，此 Skill 会自动激活。

### 封面效果示例

![封面预览](https://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com/ccv2%2F2026-04-01%2FMiniMax-M2.7%2F2022235502865813945%2Fc307d7c4720d899676b8537c370d9ee7526b6a2bd26be62828229fd4023de4b2..png?Expires=1775068198&OSSAccessKeyId=LTAI5tGLnRTkBjLuYPjNcKQ8&Signature=GGfJXvrU0RqGM4NmH%2BJ%2FnHGQwEY%3D)

> 示例封面：「用好AI Agent，本质上是个 UX 问题」

### 安装

将此仓库克隆到 Claude Code 的 skills 目录：

```bash
# 克隆到 skills 目录
git clone https://github.com/chenzhaoxuan0/wechatcover-html.git ~/.claude/skills/wechatcover-html

# 安装依赖（仅 Node.js 项目依赖）
cd ~/.claude/skills/wechatcover-html
npm install
```

> **注意**：Claude Code 会自动扫描 `~/.claude/skills/` 目录下的 Skill，克隆后无需额外配置即可使用。

### 使用方法

直接在对话中描述需求即可：

```
帮我生成一个微信公众号封面，标题是「用好AI Agent，本质上是个UX问题」
```

Claude Code 会自动调用此 Skill 生成封面图。

### 文字配色策略

**自动亮度检测** — 无需手动指定配色：

| 背景亮度 | 文字颜色 | 原理 |
|----------|----------|------|
| 亮度 < 128（暗色背景） | #FFFFFF（白色） | 暗背景 + 白字，高对比度 |
| 亮度 ≥ 128（亮色背景） | #111111（黑色） | 亮背景 + 黑字，高对比度 |

背景亮度通过 Canvas 加载图片，逐像素计算 RGB 加权亮度（0.299R + 0.587G + 0.114B），取平均值。

### 布局规格

所有图高度统一为 **600px**：

- **2.35:1 信息流图**：1410 × 600 px
- **1:1 转发图**：600 × 600 px
- **拼接总图**：2010 × 600 px（3.35:1）

**左侧 1:1 转发图**：关键字大字在左上，标题小字在左下，logo 在右下

**右侧 2.35:1 信息流图**：关键字大字在左上，标题小字在左下，几何装饰图形在右侧，logo 在右下

### 实现原理

整体 pipeline 分为 5 个步骤：

```
标题输入（+ 文章正文，可选）
    ↓
① MiniMax text API 提取关键词 + 视觉描述（内部完成）
    ↓
② MiniMax image-01 生成 AI 背景图
    ↓
③ Canvas 分析背景亮度 → 自动选白/黑文字色
    ↓
④ 几何图形生成 + HTML 布局 + Puppeteer 截图
    ↓
⑤ Canvas 拼接 → 最终 3.35:1 PNG
```

**① 关键词提取（MiniMax text API，内部完成）**

调用 MiniMax-Text-01 API，从标题和正文中提取：
- 三个关键词（每个不超过10字）
- 一句话摘要（不超过30字）
- 视觉描述（用于 AI 生成背景图）

关键词经过 `truncateKeyword()` 截断（保留词边界，中文按2字符切分，英文按空格/短横线切分），最终保留完整词。

**② AI 背景图（MiniMax image-01）**

调用 MiniMax image-01 API 生成横版背景图（16:9），prompt 追加"抽象背景，无文字，高清"。优先使用 mmx CLI，失败则直连 API（响应格式 base64）。

**③ 亮度检测（Canvas）**

用 `canvas` 库加载背景图，逐像素计算亮度，透明像素跳过。亮度 < 128 选白字，≥ 128 选黑字。

**④ HTML 生成 + 截图**

背景图以 base64 Data URI 内嵌（避免 file:// 跨域），配合 CSS 渐变、几何图形、文字叠加。Puppeteer 设置精确 viewport 截图，失败重试 2 次。

**⑤ Canvas 拼接**

用 `canvas` 库将 1:1 图（左侧600px）和 2.35:1 图（右侧1410px）拼接为 2010×600 最终 PNG。

---

### 项目结构

```
wechatcover-html/
├── SKILL.md                      # Skill 定义文件（Claude Code 自动读取）
├── README.md                     # 本文件
├── package.json
├── src/
│   ├── index.js                  # generateCover() 主入口 + Prompt 函数导出
│   ├── ai-extractor.js           # MiniMax API 调用、Prompt 生成、JSON 解析
│   ├── image-background.js       # 背景图处理 + 亮度检测
│   ├── geometry-pool.js          # 基于 seed 的几何图形池
│   ├── layout-engine.js          # 布局计算
│   ├── html-generator.js         # HTML 生成
│   ├── screenshot.js             # Puppeteer 截图
│   ├── stitcher.js               # Canvas 左右拼接
│   └── main.js                   # CLI 入口
└── asset/
    └── inkspacebitbase200png.png # 吉祥物 logo（可选）
```

### 开发者选项

如需直接通过 Node.js API 调用：

```javascript
const { generateCover } = require('./src/index');

const result = await generateCover('你的文章标题', {
  articleContent: '文章正文（可选，传入会提高关键词质量）',
  outputPath: './output.png',
  logoPath: './asset/inkspacebitbase200png.png', // 可选
});
// result.imagePath      // 最终 3.35:1 PNG 路径
// result.aiResult       // { summary, visualPrompt, keywords }
// result.bgImagePath    // AI 背景图路径
```

```bash
# 命令行调用
node src/main.js "文章标题" [输出路径]
```

---

## English

### Overview

WechatCoverHTML is a Claude Code Skill that automatically generates WeChat public account cover images from article titles.

**Key Features:**
- MiniMax text API extracts keywords + visual prompts internally (no external LLM needed)
- MiniMax image-01 generates AI background images
- Canvas-based brightness detection auto-selects white or black text for high contrast
- Output 3.35:1 stitched image (1:1 forward + 2.35:1 feed)
- Both images share geometric elements for visual consistency
- Support custom mascot/logo (bottom-right)

**Usage:** This Skill activates automatically when you mention "WeChat cover", "公众号封面", etc. in Claude Code conversations.

### Example Output

![Cover Preview](https://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com/ccv2%2F2026-04-01%2FMiniMax-M2.7%2F2022235502865813945%2Fc307d7c4720d899676b8537c370d9ee7526b6a2bd26be62828229fd4023de4b2..png?Expires=1775068198&OSSAccessKeyId=LTAI5tGLnRTkBjLuYPjNcKQ8&Signature=GGfJXvrU0RqGM4NmH%2BJ%2FnHGQwEY%3D)

> Example: "Using AI Agents well is essentially a UX problem"

### Installation

Clone this repo into your Claude Code skills directory:

```bash
# Clone to skills directory
git clone https://github.com/chenzhaoxuan0/wechatcover-html.git ~/.claude/skills/wechatcover-html

# Install dependencies
cd ~/.claude/skills/wechatcover-html
npm install
```

### Usage

Simply describe your request in conversation:

```
Generate a WeChat public account cover image with the title "Using AI Agents well is essentially a UX problem"
```

Claude Code will automatically invoke this Skill.

### Text Color Strategy

**Automatic brightness detection:**

| Background Brightness | Text Color | Principle |
|-----------------------|------------|-----------|
| < 128 (dark bg) | #FFFFFF (white) | Dark bg + white text, high contrast |
| ≥ 128 (light bg) | #111111 (black) | Light bg + black text, high contrast |

Brightness is computed pixel-by-pixel using weighted RGB (0.299R + 0.587G + 0.114B), skipping transparent pixels.

### Layout Specs

All images share a uniform height of **600px**:

- **2.35:1 Feed Image**: 1410 × 600 px
- **1:1 Forward Image**: 600 × 600 px
- **Stitched Total**: 2010 × 600 px (3.35:1)

### Implementation Principles

5-stage pipeline:

```
Title Input (+ article body, optional)
    ↓
① MiniMax text API extracts keywords + visual prompt (internal)
    ↓
② MiniMax image-01 generates AI background image
    ↓
③ Canvas brightness detection → auto white/black text
    ↓
④ Geometry + HTML layout + Puppeteer screenshot × 2
    ↓
⑤ Canvas stitch → Final 3.35:1 PNG
```

### Project Structure

```
wechatcover-html/
├── SKILL.md
├── README.md
├── package.json
├── src/
│   ├── index.js                  # generateCover() main entry + Prompt exports
│   ├── ai-extractor.js          # MiniMax API calls, prompts, JSON parsing
│   ├── image-background.js       # Background handling + brightness detection
│   ├── geometry-pool.js         # Seed-based geometric shapes
│   ├── layout-engine.js         # Layout calculation
│   ├── html-generator.js        # HTML generation
│   ├── screenshot.js            # Puppeteer screenshot
│   ├── stitcher.js              # Canvas left-right stitching
│   └── main.js                  # CLI entry
└── asset/
    └── inkspacebitbase200png.png # Mascot logo (optional)
```

### Developer Options

```javascript
const { generateCover } = require('./src/index');

const result = await generateCover('Your article title', {
  articleContent: 'Article body (optional, improves keyword quality)',
  outputPath: './output.png',
  logoPath: './asset/inkspacebitbase200png.png', // optional
});
```

```bash
# CLI
node src/main.js "Article Title" [output path]
```

---

## License

ISC
