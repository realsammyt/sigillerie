#!/usr/bin/env node
/**
 * scripts/screenshot-demo.mjs
 *
 * Fast Playwright screenshot harness for design review iterations.
 * Hits a local dev URL at four viewport aspects, writes PNGs.
 *
 * Usage:
 *   node scripts/screenshot-demo.mjs <url> <out-dir>
 *
 * Example:
 *   node scripts/screenshot-demo.mjs \
 *     http://localhost:5174/demos3d/d6-holo-ui/ \
 *     I:/GithubI/claude/sigillerie/_review/iter-1/
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL_ARG = process.argv[2];
const OUT_DIR = process.argv[3];

if (!URL_ARG || !OUT_DIR) {
  console.error('usage: node screenshot-demo.mjs <url> <out-dir>');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const ASPECTS = [
  { name: 'wide',      width: 1920, height: 1080 },
  { name: 'square',    width: 1080, height: 1080 },
  { name: 'portrait',  width: 1080, height: 1920 },
  { name: 'ultrawide', width: 3440, height: 1440 },
];

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    process.platform === 'win32' ? '--use-angle=d3d11' : '--use-angle=vulkan',
    '--enable-unsafe-webgpu',
    '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

for (const aspect of ASPECTS) {
  const ctx = await browser.newContext({
    viewport: { width: aspect.width, height: aspect.height },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => console.error(`[${aspect.name}] page error:`, err.message));

  await page.goto(URL_ARG, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for the page contract __ready signal so we capture the real scene.
  try {
    await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
  } catch {
    console.warn(`[${aspect.name}] __ready timeout; capturing anyway`);
  }

  // Let any boot animation settle
  await page.waitForTimeout(500);

  const outPath = path.join(OUT_DIR, `${aspect.name}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`✓ ${aspect.name}: ${outPath}`);
  await ctx.close();
}

await browser.close();
console.log(`\n✓ all aspects captured at: ${OUT_DIR}`);
