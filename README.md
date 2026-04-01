# WechatCoverHTML

<div align="center">

![封面预览](https://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com/ccv2%2F2026-04-01%2FMiniMax-M2.7%2F2022235502865813945%2Fc307d7c4720d899676b8537c370d9ee7526b6a2bd26be62828229fd4023de4b2..png?Expires=1775068198&OSSAccessKeyId=LTAI5tGLnRTkBjLuYPjNcKQ8&Signature=GGfJXvrU0RqGM4NmH%2BJ%2FnHGQwEY%3D)

**微信公众号封面图生成工具 — Claude Code Skill**

根据文章标题自动生成专业的公众号封面图，支持 3.35:1 拼接图（左侧 1:1 转发图 + 右侧 2.35:1 信息流图）

</div>

---

## 中文

### 项目简介

WechatCoverHTML 是一个 Claude Code Skill，可根据文章标题自动生成微信公众号封面图。

**核心功能：**
- Agent 自行 LLM 解析文章关键词和视觉描述（Skill 不调用 LLM）
- MiniMax image-01 生成横版背景图
- AI 分析图片色调后自动选择高对比度文字色
- 输出 3.35:1 拼接图，同时适配转发场景（1:1）和信息流场景（2.35:1）
- 左右两图共享几何图形元素，保持视觉一致性
- 支持自定义吉祥物 Logo

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

### 配色方案

共 6 档，**单色为主，禁止撞色**：

| 档位 | 背景色 | 图形/文字色 | 适用主题 |
|------|--------|-------------|----------|
| 黑白 | #FFFFFF | #111111 | 商务/技术 |
| 米色 | #F5F0E8 | #7A5230 | 温暖/生活 |
| 浅粉 | #FADADD | #B83A50 | 女性/情感 |
| 天空蓝 | #BFDCEF | #1A4E8A | 科技/理性 |
| 翠鸟绿 | #C8E6C9 | #1E5E2E | 增长/自然 |
| 清华紫 | #DDD0E8 | #5A3E7A | 创意/学术 |

### 布局规格

所有图高度统一为 **600px**：

- **2.35:1 信息流图**：1410 × 600 px
- **1:1 转发图**：600 × 600 px
- **拼接总图**：2010 × 600 px（3.35:1）

**左侧 1:1 转发图**：关键字大字（占图面 40%+）在左上，标题小字在左下，logo 在右下

**右侧 2.35:1 信息流图**：关键字大字在左上，标题小字在左下，几何装饰图形在右侧，logo 在右下

背景：左深右浅渐变 + 白色颗粒纹理叠加

### 实现原理

整体 pipeline 分为 6 个步骤：

```
标题输入
    ↓
① Agent 自行 LLM 解析：提取摘要 + 视觉描述 + 关键词
    ↓
② MiniMax image-01 生成横版背景图
    ↓
③ Agent 自行 LLM 分析图片色调 → 高对比文字色
    ↓
④ 几何图形生成（seed 一致性）
    ↓
⑤ Puppeteer 截图 × 2
    ↓
⑥ Canvas 拼接 → 最终 PNG
```

**① LLM 解析（由 Agent 自行完成）**

Skill 本身不调用 LLM，而是提供 `getArticlePrompt()` 函数，供调用者（Agent）自行用 LLM 解析。Agent 调用自己的 LLM 后，用 `parseArticleResult()` 解析 JSON 结果，得到 `{ summary, visualPrompt, keywords }`。

**③ 图片色调分析（由 Agent 自行完成）**

类似地，Skill 提供 `getImagePrompt()` 和 `parseImageResult()`，Agent 自行用 LLM 分析背景图色调，返回 `{ textColor }`。

**② 几何图形池（Seed 一致性）**

用 `hash(title + schemeKey)` 作为种子，驱动伪随机数生成器，生成 4-5 个几何图形（圆形/三角形/矩形/线条）。关键点：**同一标题生成的两张图，seed 相同，几何图形完全一致**，保证左右视觉统一。图形只出现在右侧 62% 区域，左侧 38% 纯文字。

**③ HTML 生成**

每张图由 SVG + CSS 构建：
- **渐变背景**：SVG linearGradient，左侧深（fg 色 22% 透明度）→ 右侧浅（7% 透明度）→ 边缘 0
- **颗粒纹理**：SVG feTurbulence 噪声滤镜，3.5% 透明度叠加，增加质感
- **关键字大字**：占图面 40%+，使用 system-ui 无衬线字体，左上角
- **标题小字**：18-45px，左下角，70% 透明度，不换行
- **几何图形**：绝对定位在右侧，填充/描边两种变体，15-65% 透明度
- **Logo**：右下角，高度 30%

**④ Puppeteer 截图**

将 HTML 写入临时文件，用 Puppeteer 打开 `file://` URL，设置精确 viewport（1410×600 或 600×600），截图输出 PNG。失败重试 2 次。

**⑤ Canvas 拼接**

用 `canvas` 库创建 2010×600 的画布，左侧贴 1:1 图（600px），右侧贴 2.35:1 图（1410px），白色背景，输出最终 PNG。

---

### 项目结构

```
wechatcover-html/
├── SKILL.md                      # Skill 定义文件（Claude Code 自动读取）
├── README.md                     # 本文件
├── package.json
├── cover.png                     # 生成示例
├── src/
│   ├── index.js                  # generateCover() 主入口 + Prompt 函数导出
│   ├── ai-extractor.js           # Prompt 生成 + JSON 解析（不调用 LLM）
│   ├── image-background.js        # 背景图处理（仅 image-01 生成用 MiniMax）
│   ├── geometry-pool.js           # 基于 seed 的几何图形池
│   ├── layout-engine.js           # 布局计算
│   ├── html-generator.js          # HTML 生成（渐变+颗粒+图形+文字）
│   ├── screenshot.js              # Puppeteer 截图
│   ├── stitcher.js                # Canvas 左右拼接
│   └── main.js                    # CLI 入口
└── asset/
    └── inkspacebitbase200png.png # 吉祥物 logo
```

### 开发者选项

如需直接通过命令行或 Node.js API 调用：

**方式 1：Agent 自行 LLM 解析（推荐）**
```javascript
const { generateCover, getArticlePrompt, parseArticleResult } = require('./src/index');

// 1. Agent 自行用 LLM 解析
const prompt = getArticlePrompt(title, content);
const llmResult = await agentLLM(prompt.systemPrompt, prompt.userPrompt);
const aiResult = parseArticleResult(llmResult);

// 2. 生成封面
const result = await generateCover(title, {
  articleContent: content,
  aiResult,  // 传入预解析结果
  outputPath: './output.png',
  logoPath: './asset/inkspacebitbase200png.png',
});
```

**方式 2：直接用（兜底关键词）**
```javascript
const { generateCover } = require('./src/index');

const result = await generateCover('你的文章标题', {
  outputPath: './output.png',  // 输出路径
  logoPath: './asset/inkspacebitbase200png.png',  // 可选 logo
});
```

```bash
# 命令行调用
node src/main.js "文章标题" [输出路径]
```

```bash
# 安装依赖（如需开发者模式）
npm install
```

---

## English

### Overview

WechatCoverHTML is a Claude Code Skill that automatically generates WeChat public account cover images from article titles.

**Key Features:**
- Auto-detect keywords from titles and match professional color schemes
- Output 3.35:1 stitched image (1:1 forward image on left + 2.35:1 feed image on right)
- Both images share geometric elements for visual consistency
- Support custom mascot/logo

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

> **Note**: Claude Code automatically scans `~/.claude/skills/` for Skills. No additional configuration needed after cloning.

### Usage

Simply describe your request in conversation:

```
Generate a WeChat public account cover image with the title "Using AI Agents well is essentially a UX problem"
```

Claude Code will automatically invoke this Skill.

### Color Schemes

6 schemes available, **monochromatic with no color clashing**:

| Scheme | Background | Text/Graphics | Best For |
|--------|-----------|---------------|----------|
| B&W | #FFFFFF | #111111 | Business/Tech |
| Beige | #F5F0E8 | #7A5230 | Warmth/Lifestyle |
| Pink | #FADADD | #B83A50 | Female/Emotion |
| Sky Blue | #BFDCEF | #1A4E8A | Tech/Rational |
| Kingfisher | #C8E6C9 | #1E5E2E | Growth/Nature |
| Tsinghua Purple | #DDD0E8 | #5A3E7A | Creative/Academic |

### Layout Specs

All images share a uniform height of **600px**:

- **2.35:1 Feed Image**: 1410 × 600 px
- **1:1 Forward Image**: 600 × 600 px
- **Stitched Total**: 2010 × 600 px (3.35:1)

**Left 1:1 Forward Image**: Large keyword text (40%+ of image) at top-left, title text at bottom-left, logo at bottom-right

**Right 2.35:1 Feed Image**: Large keyword text at top-left, title text at bottom-left, geometric decorations on right, logo at bottom-right

Background: left-dark-to-right-light gradient + white grain texture overlay

### Implementation Principles

The pipeline has 5 stages:

```
Title Input
    ↓
① Keyword Extraction + Color Inference
    ↓
② Geometric Shape Generation (seeded consistency)
    ↓
③ Layout Calculation + HTML Generation
    ↓
④ Puppeteer Screenshot × 2
    ↓
⑤ Canvas Stitch → Final PNG
```

**① Keyword Extraction**

Instead of generic words, it matches **precise keywords** from a dictionary (e.g. "AIGC", "Private Traffic", "AB Test"). Max 3 keywords, ordered by appearance. Keywords also determine the color scheme.

**② Geometry Pool (Seed Consistency)**

Uses `hash(title + schemeKey)` as the seed for a PRNG to generate 4-5 geometric shapes (circle/triangle/rect/line). Key point: **same title = same seed = same shapes on both images**, ensuring visual consistency. Shapes only appear in the right 62% area.

**③ HTML Generation**

Each image is built from SVG + CSS:
- **Gradient background**: SVG linearGradient, dark on left (fg at 22% opacity) → light on right (7% opacity) → edge 0
- **Grain texture**: SVG feTurbulence noise filter at 3.5% opacity for texture
- **Keyword text**: 40%+ of image area, system-ui sans-serif, top-left
- **Title text**: 18-45px, bottom-left, 70% opacity, no wrap
- **Geometric shapes**: absolutely positioned on right, filled/outline variants, 15-65% opacity
- **Logo**: bottom-right, 30% height

**④ Puppeteer Screenshot**

Writes HTML to temp file, opens via `file://` URL with Puppeteer, sets precise viewport (1410×600 or 600×600), screenshots to PNG. Retries 2 times on failure.

**⑤ Canvas Stitch**

Creates a 2010×600 canvas with the `canvas` library, pastes 1:1 image on left (600px) and 2.35:1 image on right (1410px), white background, outputs final PNG.

### Project Structure

```
wechatcover-html/
├── SKILL.md                      # Skill definition (auto-read by Claude Code)
├── README.md
├── package.json
├── cover.png
├── src/
│   ├── index.js                  # generateCover() main entry + Prompt exports
│   ├── ai-extractor.js            # Prompt generation + JSON parsing (no LLM calls)
│   ├── image-background.js         # Background handling (only image-01 uses MiniMax)
│   ├── geometry-pool.js           # Seed-based geometric shapes
│   ├── layout-engine.js           # Layout calculation
│   ├── html-generator.js          # HTML generation (gradient+grain+shapes+text)
│   ├── screenshot.js              # Puppeteer screenshot
│   ├── stitcher.js               # Canvas left-right stitching
│   └── main.js                    # CLI entry
└── asset/
    └── inkspacebitbase200png.png # Mascot logo
```

### Developer Options

For direct CLI or Node.js API usage:

**Method 1: Agent self LLM parsing (recommended)**
```javascript
const { generateCover, getArticlePrompt, parseArticleResult } = require('./src/index');

// 1. Agent self parses with LLM
const prompt = getArticlePrompt(title, content);
const llmResult = await agentLLM(prompt.systemPrompt, prompt.userPrompt);
const aiResult = parseArticleResult(llmResult);

// 2. Generate cover
const result = await generateCover(title, {
  articleContent: content,
  aiResult,  // pass pre-parsed result
  outputPath: './output.png',
  logoPath: './asset/inkspacebitbase200png.png',
});
```

**Method 2: Direct use (fallback keywords)**
```javascript
const { generateCover } = require('./src/index');

const result = await generateCover('Your article title', {
  outputPath: './output.png',
  logoPath: './asset/inkspacebitbase200png.png',  // optional logo
});
```

```bash
# CLI
node src/main.js "Article Title" [output path]
```

```bash
# Install dependencies (developer mode)
npm install
```

---

## License

ISC
