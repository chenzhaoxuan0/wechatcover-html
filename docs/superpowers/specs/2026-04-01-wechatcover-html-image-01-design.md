# WechatCoverHTML + image-01 Background Design

## Overview

Integrate MiniMax image-01 (T2I) into wechatcover-html to generate contextual background images from article content, with AI-determined adaptive text color for high contrast readability.

**Architecture Change**: This Skill no longer calls any LLM directly. Instead, it provides Prompt generation functions (`getArticlePrompt`, `getImagePrompt`) and JSON parsing functions (`parseArticleResult`, `parseImageResult`). The Agent (caller) uses its own LLM to parse the prompts and passes the results back.

## Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  Agent (Caller)                                             │
│                                                              │
│  ① getArticlePrompt(title, content)                         │
│                    ↓                                         │
│  ② Agent calls its own LLM to parse                         │
│                    ↓                                         │
│  ③ parseArticleResult(llmResult) ──→ aiResult               │
│                    ↓                                         │
│  ④ generateCover(title, { aiResult })                       │
│                    ↓                                         │
│  ⑤ image-01 generates background (MiniMax API)              │
│                    ↓                                         │
│  ⑥ Agent optionally calls getImagePrompt() to analyze bg    │
│                    ↓                                         │
│  ⑦ Screenshot + Stitch → PNG                                │
└─────────────────────────────────────────────────────────────┘
```

## Step Details

### Step ① & ② — Agent Self LLM Parsing (No Skill LLM Calls)

**Input:** title + article content
**Output:** `aiResult = { summary, visualPrompt, keywords }`

The Skill provides `getArticlePrompt()` which returns `{ systemPrompt, userPrompt }`. The Agent uses its own LLM to parse and returns the raw text result. The Skill then parses it with `parseArticleResult()`.

```javascript
// Skill side
const { getArticlePrompt, parseArticleResult } = require('./src/index');

const { systemPrompt, userPrompt } = getArticlePrompt(title, content);
// Agent uses its own LLM to process systemPrompt + userPrompt
const llmRawText = await agentLLM(systemPrompt, userPrompt);
const aiResult = parseArticleResult(llmRawText);
```

### Step ⑤ — image-01 Background Generation

- Uses `MINIMAX_API_KEY` environment variable
- Prompt = `visualPrompt + "，抽象背景，无文字，高清，适合作为封面背景"`
- Aspect ratio: 16:9
- Output: PNG file for HTML generation

### Step ⑥ — Image Analysis (Optional, Agent Self LLM)

Similar to Step ①, the Skill provides `getImagePrompt()` and `parseImageResult()`. The Agent uses its own LLM to analyze the background image.

```javascript
const { getImagePrompt, parseImageResult } = require('./src/index');

const { systemPrompt, userPrompt } = getImagePrompt(bgImageUrl);
const llmRawText = await agentLLM(systemPrompt, userPrompt);
const { textColor } = parseImageResult(llmRawText);
```

### Step ⑦ — HTML Generation + Screenshot + Stitch

No changes from original design.

## Module Changes

### New Exports

| File | Exports |
|------|---------|
| `src/index.js` | `getArticlePrompt`, `parseArticleResult`, `getImagePrompt`, `parseImageResult` |

### Modified Files

| File | Changes |
|------|---------|
| `src/ai-extractor.js` | Removed all LLM API calls. Now only provides Prompt generation + JSON parsing. |
| `src/image-background.js` | Removed `analyzeImageColor()` LLM call. Now provides `getImagePrompt()` for Agent self-analysis. |
| `src/index.js` | Exports Prompt/Parse functions. Falls back to `fallbackExtract()` when no `aiResult` provided. |

### Dependencies

- MiniMax API for image-01 only (background generation)
- Agent's own LLM for article/image analysis (not this Skill)
- Existing puppeteer + canvas dependencies

## Edge Cases

| Scenario | Handling |
|----------|---------|
| No `aiResult` provided | Falls back to `fallbackExtract()` using title keywords |
| Article content empty | Falls back to `fallbackExtract()` |
| image-01 generation fails | Falls back to solid color background (#888888) |
| Agent LLM parse fails | Falls back to `fallbackExtract()` |

## API Changes

### `generateCover()` Signature

```javascript
generateCover(title, options = {}) {
  // options.articleContent: string — article content (for Prompt generation)
  // options.aiResult: object — pre-parsed result { summary, visualPrompt, keywords, textColor }
  // options.backgroundImage: string — external background image URL or local path
  // options.textColor: string — manually specified text color
  // options.logoPath: string — optional
  // options.outputPath: string — output path
}
```

### Return Value

```javascript
{
  imagePath: string,       // stitched PNG path
  preview1to1: Buffer,    // 1:1 preview
  preview235to1: Buffer,  // 2.35:1 preview
  html1Path: string,      // 1:1 HTML
  html235Path: string,    // 2.35:1 HTML
  aiResult: object,        // { summary, visualPrompt, keywords }
  bgImagePath: string,     // background image path
}
```

## Fallback Logic

The Skill always has a fallback:

1. If `options.aiResult` is provided → use it directly
2. If `articleContent` is provided but `aiResult` is not → still uses `fallbackExtract()` (Agent should parse first)
3. If `articleContent` is empty → uses `fallbackExtract()`

**Note**: For full AI-powered results, the Agent should:
```javascript
const { systemPrompt, userPrompt } = getArticlePrompt(title, content);
const llmResult = await agentLLM(systemPrompt, userPrompt);
const aiResult = parseArticleResult(llmResult);
generateCover(title, { articleContent, aiResult });
```
