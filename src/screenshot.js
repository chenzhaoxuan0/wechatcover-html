const puppeteer = require('puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 自动检测系统 Chromium 路径
 * 优先级：环境变量 > 系统命令 > 常见路径
 */
function findSystemChrome() {
  // 1. 优先用环境变量指定的
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
  }

  // 2. 用 which 命令查找
  const cmdPaths = [
    'chromium-browser',
    'chromium',
    'google-chrome',
    'google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ];
  for (const cmd of cmdPaths) {
    try {
      const resolved = execSync(`which ${cmd}`, { encoding: 'utf8' }).trim();
      if (resolved && fs.existsSync(resolved)) {
        return resolved;
      }
    } catch (_) {}
  }

  return null;
}

/**
 * 获取可靠的临时目录（WSL2 下避免用 /tmp，改用用户家目录）
 * WSL2 的 /tmp 是 Windows 路径映射，Puppeteer 无法通过 file:// 访问
 */
function getTempDir() {
  const homeTmp = path.join(os.homedir(), '.tmp');
  if (!fs.existsSync(homeTmp)) {
    fs.mkdirSync(homeTmp, { recursive: true });
  }
  return homeTmp;
}

async function captureFromHtml(html, width, height, outputPath) {
  const tempDir = getTempDir();
  const tmpHtml = path.join(tempDir, `cover_${Date.now()}.html`);
  const tmpPng = outputPath
    ? path.resolve(outputPath)
    : path.join(tempDir, `cover_${Date.now()}.png`);

  fs.writeFileSync(tmpHtml, html, 'utf8');

  const isTempPng = !outputPath;
  const chromePath = findSystemChrome();

  const launchOptions = {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--allow-file-access-from-files',
      '--disable-gpu',
    ]
  };

  // 找到系统 Chrome 则指定其路径，避免自带 Chromium 缺库
  if (chromePath) {
    launchOptions.executablePath = chromePath;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.goto('file://' + tmpHtml, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.screenshot({ path: tmpPng, type: 'png', fullPage: false });
  await browser.close();

  fs.unlinkSync(tmpHtml);
  const buffer = fs.readFileSync(tmpPng);
  if (isTempPng) {
    fs.unlinkSync(tmpPng);
  }
  return buffer;
}

module.exports = { captureFromHtml };
