# WechatCoverHTML + image-01 Background Design

## Overview

Integrate MiniMax image-01 (T2I) into wechatcover-html to generate contextual background images from article content, with AI-determined adaptive text color for high contrast readability.

## Pipeline

```
标题 + 文章正文
    ↓
① AI 提取摘要 + 视觉描述 + 关键词（chat API，一次调用返回三个字段）
    ↓
② image-01 生成横版背景图（image-01 T2I）
    ↓
③ vision API 分析图片亮度+色调 → 返回 { textColor }
    ↓
④ HTML 生成（背景图 + 关键词 + 标题 + logo，文字颜色来自步骤③）
    ↓
⑤ Puppeteer 截图 × 2
    ↓
⑥ Canvas 拼接 → 最终 PNG
```

## Step Details

### Step ① — AI Extractor (Chat API)

**输入:** 标题 + 文章正文
**输出:** JSON

```json
{
  "summary": "一句话摘要（≤30字）",
  "visualPrompt": "用于背景图生成的视觉描述，如'冷色调抽象渐变，蓝紫光穿梭，适合科技主题'",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}
```

**Prompt 设计:**

```
你是一个微信公众号封面设计师。请根据以下文章内容，提取三个信息：

1. 一句话摘要（不超过30字，用于封面副标题参考）
2. 视觉风格描述（用于AI生成背景图，2-3句话，描述色调、氛围、风格，避免具体形状描述）
3. 3个精准关键词（用于封面主视觉大字，不取泛词，要具体精准）

文章标题：{title}
文章正文：{content}

请以JSON格式输出：
{
  "summary": "...",
  "visualPrompt": "...",
  "keywords": ["...", "...", "..."]
}
```

### Step ② — image-01 Background Generation

- 使用 `scripts/image/generate_image.sh t2i`
- Prompt = `visualPrompt + "，抽象背景，无文字，高清，适合作为封面背景"`
- Aspect ratio: 横版（16:9 或自适应）
- 输出: PNG 文件，供步骤③和④使用

### Step ③ — Vision API 分析

**输入:** 背景图
**输出:** `{ textColor: '#111111' | '#FFFFFF', mode: 'dark' | 'light' }`

**判断逻辑:**
- 调用 vision API 分析图片主色调和亮度
- 明亮背景 → 深色文字（#111111）
- 暗色背景 → 浅色文字（#FFFFFF）
- 中间调根据色调冷暖判断

### Step ④ — HTML 生成

**变化：**
- 移除 `linearGradient` 渐变遮罩层（用户选择：纯背景）
- 移除颗粒纹理叠加
- 背景图通过 CSS `background-image` 注入，`background-size: cover`
- 文字颜色由步骤③的 `textColor` 决定（不再使用固定配色档位）

**HTML 结构:**
```html
<div style="width:{width}px;height:{height}px;background-image:url(...);background-size:cover;position:relative;">
  <!-- 关键词大字 -->
  <!-- 标题小字 -->
  <!-- Logo -->
</div>
```

### Step ⑤ & ⑥ — 截图 + 拼接

同现有逻辑，无变化。

## Module Changes

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/ai-extractor.js` | 调用 chat API，提取摘要+视觉描述+关键词 |
| `src/image-background.js` | 封装 image-01 生成 + vision 分析 |
| `src/color-ai.js` | vision API 亮度/色调分析，返回高对比文字色 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/html-generator.js` | 支持 `backgroundImage` 参数，移除渐变遮罩，文字色由外部注入 |
| `src/index.js` | 新 pipeline，调用 ai-extractor → image-background → html-generator |
| `src/color-schemes.js` | 删除词典逻辑，删除 `extractKeywords`，保留 `inferScheme` 备用或删除 |
| `SKILL.md` | 更新 API 参数，增加 `articleContent` 参数 |

### 删除文件/逻辑

- `src/color-schemes.js` 中的 `PRECISE_KEYWORD_DICT` 和 `extractKeywords()` → 改由 AI 提取
- 渐变遮罩相关代码
- 颗粒纹理相关代码

## API Changes

### `generateCover()` 新签名

```javascript
generateCover(title, options = {}) {
  // options.articleContent: string — 文章正文（必填，用于AI提取）
  // options.backgroundImage: string — 可选，外部指定背景图（跳过AI生成）
  // options.textColor: string — 可选，手动指定文字色
  // options.colorScheme: string — 删除，不再使用
  // options.logoPath: string — 可选
  // options.outputPath: string — 输出路径
}
```

### 返回值变化

```javascript
{
  imagePath: string,      // 拼接后 PNG 路径
  preview1to1: Buffer,    // 1:1 预览图
  preview235to1: Buffer,  // 2.35:1 预览图
  html1Path: string,      // 过程 HTML
  html235Path: string,    // 过程 HTML
  aiResult: {             // 新增：AI 提取结果
    summary: string,
    visualPrompt: string,
    keywords: string[],
    textColor: string,
  }
}
```

## Edge Cases

| 场景 | 处理 |
|------|------|
| 文章正文为空 | 降级到纯标题模式，仅用标题生成背景图 prompt |
| AI 提取失败 | 降级：summary=标题，visualPrompt=通用抽象背景，keywords=[标题前5字] |
| image-01 生成失败 | 降级：使用纯色背景（用户指定或默认灰） |
| vision API 分析失败 | 默认使用深色文字（#111111），保守策略 |
| 网络超时 | 重试2次，超时后降级 |

## Error Handling

所有 AI 调用添加重试逻辑（2次），失败后有明确的降级路径。不阻塞整体流程。

## Dependencies

- MiniMax Chat API（摘要+视觉描述+关键词提取）
- MiniMax image-01（背景图生成）
- MiniMax Vision API（图片亮度/色调分析）
- 现有 puppeteer + canvas 依赖不变
