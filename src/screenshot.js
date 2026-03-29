const puppeteer = require('puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function captureFromHtml(html, width, height, outputPath) {
  const tmpDir = os.tmpdir();
  const tmpHtml = path.join(tmpDir, `cover_${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, html, 'utf8');

  const isTempPng = !outputPath;
  const tmpPng = outputPath || path.join(tmpDir, `cover_${Date.now()}.png`);

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
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
