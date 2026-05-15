import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:8080/demos3d/d6-holo-ui/';
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
const errors = [];
const logs = [];
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
console.log('--- pageerrors ---');
errors.forEach((e) => console.log(e));
console.log('--- console (filtered: errors / warnings / info containing relevant keywords) ---');
logs.filter((l) =>
  /error|warn|fail|uikit|SigilleriePresets|panel|text/i.test(l)
).slice(0, 50).forEach((l) => console.log(l));
await browser.close();
