#!/usr/bin/env node
/**
 * launch/scripts/render-video-local.mjs
 *
 * Local video recorder for launch posts that use the Stage component
 * (assets/animations.jsx). The upstream Stage UI shows a controls bar
 * (Pause / Restart / scrubber) and reserves 56px of viewport for it via
 * fit() — meaning recordings come out with controls visible and the
 * canvas letterboxed at scale<1.
 *
 * This renderer fixes both problems with addInitScript overrides, without
 * editing the upstream component or the post HTML:
 *   - window.__recording = true (turns off Stage looping)
 *   - window.innerHeight getter returns realHeight + 56, so fit() math
 *     resolves scale to 1.0
 *   - DOMContentLoaded hook injects CSS that hides the controls bar
 *
 * After Playwright finishes recording, ffmpeg transcodes WebM -> MP4 +
 * optionally GIF via the repo's convert-formats.sh.
 *
 * Usage:
 *   node launch/scripts/render-video-local.mjs <post-id>
 *   e.g. node launch/scripts/render-video-local.mjs p2
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// This script lives at launch/<name>.mjs in the repo (the private workspace keeps
// it under launch/scripts/), so the launch dir is __dirname itself.
const LAUNCH_DIR = __dirname;
const REPO_DIR = path.resolve(LAUNCH_DIR, '..');
const POSTS_DIR = path.join(LAUNCH_DIR, 'posts');
const RENDERS_DIR = path.join(LAUNCH_DIR, 'renders');
const SERVE_ROOT = REPO_DIR;

const playwrightEntry = path.join(REPO_DIR, 'node_modules', 'playwright', 'index.mjs');
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const SLATE = {
  p2: { aspect: { w: 1920, h: 1080 }, dir: 'p2-hero-wide',         duration: 8 },
  p4: { aspect: { w: 1080, h: 1080 }, dir: 'p4-matrix-square',     duration: 9 },
  p5: { aspect: { w: 1080, h: 1920 }, dir: 'p5-vertical-short',    duration: 7 },
};

const id = process.argv[2];
if (!id || !SLATE[id]) {
  console.error('usage: node render-video-local.mjs <p2|p4|p5>');
  process.exit(1);
}
const post = SLATE[id];

fs.mkdirSync(RENDERS_DIR, { recursive: true });

// ─── static server (so importmap quirks don't bite) ─────────────────────────
function startServer(root) {
  const MIME = {
    '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
    '.jsx': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2', '.woff': 'font/woff',
  };
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqPath = req.url.split('?')[0];
      let filePath = path.join(root, reqPath);
      if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
      } catch { res.writeHead(404); res.end(); return; }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    server.on('error', reject);
  });
}

const { server, port } = await startServer(SERVE_ROOT);
const url = `http://127.0.0.1:${port}/launch/posts/${post.dir}/index.html`;
console.log(`▸ ${id}: ${url}`);

const tmpDir = path.join(os.tmpdir(), `sigillerie-launch-${Date.now()}-${process.pid}`);
fs.mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    process.platform === 'win32' ? '--use-angle=d3d11' : '--use-angle=vulkan',
    '--enable-unsafe-webgpu',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--allow-file-access-from-files',
    '--disable-web-security',
  ],
});

// ─── warmup pass (JIT + font cache) ─────────────────────────────────────────
{
  const warmCtx = await browser.newContext({
    viewport: { width: post.aspect.w, height: post.aspect.h },
  });
  const warmPage = await warmCtx.newPage();
  try {
    await warmPage.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await warmPage.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await warmPage.waitForTimeout(800);
  } catch (e) {
    console.error(`warmup failed: ${e.message}`);
  }
  await warmCtx.close();
}

// ─── recording pass ─────────────────────────────────────────────────────────
const ctx = await browser.newContext({
  viewport: { width: post.aspect.w, height: post.aspect.h },
  deviceScaleFactor: 2,
  recordVideo: {
    dir: tmpDir,
    size: { width: post.aspect.w, height: post.aspect.h },
  },
});

// Init script BEFORE navigation. Runs in every frame.
await ctx.addInitScript(({ realHeight }) => {
  window.__recording = true;

  // The Stage component's fit() does:
  //   const vh = window.innerHeight - 56;
  //   const s = Math.min(vw / width, vh / height);
  // We want s === 1 so the canvas fills the recorded viewport at native size.
  // Trick: lie about innerHeight, return realHeight + 56 so the math cancels.
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    get() { return realHeight + 56; },
  });

  // Hide the Stage controls bar once DOM is ready.
  function inject() {
    const css = document.createElement('style');
    css.textContent = `
      /* Hide Stage controls bar — matched by inline style "z-index: 100" */
      div[style*="z-index: 100"] { display: none !important; }
      /* Ensure the stage canvas background stays transparent / native */
      body, html { background: #0A0A0A !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
    `;
    (document.head || document.documentElement).appendChild(css);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
}, { realHeight: post.aspect.h });

const T_REC = Date.now();
const page = await ctx.newPage();

const consoleMsgs = [];
page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => consoleMsgs.push(`[error] ${e.message}`));

try {
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
} catch (e) {
  console.error(`page load failed: ${e.message}`);
  await ctx.close(); await browser.close(); server.close();
  process.exit(1);
}

try {
  await page.waitForFunction(() => window.__ready === true, { timeout: 30_000 });
} catch {
  console.error(`__ready timeout. console tail:`);
  consoleMsgs.slice(-10).forEach(m => console.error('  ' + m));
}

const headOffset = (Date.now() - T_REC) / 1000;
console.log(`  __ready @ ${headOffset.toFixed(2)}s`);

await page.evaluate(() => { if (typeof window.__seek === 'function') window.__seek(0); }).catch(() => {});
await page.waitForTimeout(post.duration * 1000 + 200);

await page.close();
await ctx.close();
await browser.close();
server.close();

// ─── encode ──────────────────────────────────────────────────────────────────
const webms = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
if (webms.length === 0) { console.error('no webm written'); process.exit(3); }
const webmPath = path.join(tmpDir, webms[0]);
const outMp4 = path.join(RENDERS_DIR, `${id}.mp4`);

// Accurate seek: -ss AFTER -i decodes from start then trims precisely.
// (Keyframe-aligned -ss before -i was slipping by 0.5s+ vs the __ready moment.)
const ffArgs = [
  '-y',
  '-i', webmPath,
  '-ss', headOffset.toFixed(3),
  '-t', post.duration.toFixed(3),
  '-c:v', 'h264_nvenc',
  '-preset', 'p7',
  '-tune', 'hq',
  '-rc', 'vbr',
  '-cq', '19',
  '-b:v', '0',
  '-maxrate', '50M',
  '-bufsize', '100M',
  '-pix_fmt', 'yuv420p',
  '-color_primaries', 'bt709',
  '-colorspace', 'bt709',
  '-color_trc', 'bt709',
  '-movflags', '+faststart',
  '-an',
  outMp4,
];
const r = spawnSync('ffmpeg', ffArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
if (r.status !== 0) {
  console.error('ffmpeg failed:', r.stderr ? r.stderr.toString().slice(-1500) : '');
  process.exit(4);
}
console.log(`  ✓ ${outMp4}`);

// ─── GIF derivative ──────────────────────────────────────────────────────────
const conv = path.join(REPO_DIR, 'scripts', 'convert-formats.sh');
if (fs.existsSync(conv)) {
  const g = spawnSync('bash', [conv, outMp4, '--gif', `--output-dir=${RENDERS_DIR}`], { stdio: 'inherit' });
  if (g.status === 0) console.log(`  ✓ ${path.join(RENDERS_DIR, id + '.gif')}`);
}

// ─── Poster (frame at 70% of duration) ───────────────────────────────────────
const posterT = (post.duration * 0.7).toFixed(2);
const posterPng = path.join(RENDERS_DIR, `${id}-poster.png`);
const p = spawnSync('ffmpeg', ['-y', '-ss', posterT, '-i', outMp4, '-frames:v', '1', '-q:v', '2', posterPng], { stdio: 'ignore' });
if (p.status === 0) console.log(`  ✓ ${posterPng}`);

// cleanup tmp
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
