#!/usr/bin/env node
/**
 * launch/scripts/render-all.mjs
 *
 * Renders the full Sigillerie launch slate (6 posts):
 *   - static posts -> PNG at native aspect
 *   - video posts  -> MP4 at native aspect + GIF derivative
 *
 * Uses Playwright directly for the static PNG path and shells out to
 * the repo's scripts/render-video.js for the video path so we inherit
 * the page-contract + warmup + ffmpeg encode pipeline.
 *
 * Usage:
 *   node launch/scripts/render-all.mjs
 *   node launch/scripts/render-all.mjs --only=p2,p4
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LAUNCH_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(LAUNCH_DIR, '../repo');

// Resolve playwright from the repo's node_modules (launch/ has none).
const playwrightEntry = path.join(REPO_DIR, 'node_modules', 'playwright', 'index.mjs');
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const POSTS_DIR = path.join(LAUNCH_DIR, 'posts');
const RENDERS_DIR = path.join(LAUNCH_DIR, 'renders');

const SLATE = [
  { id: 'p1', kind: 'static', aspect: { w: 1080, h: 1080 }, dir: 'p1-announcement-square' },
  { id: 'p2', kind: 'video',  aspect: { w: 1920, h: 1080 }, dir: 'p2-hero-wide', duration: 8 },
  { id: 'p3', kind: 'static', aspect: { w: 1920, h: 1080 }, dir: 'p3-capability-grid-wide' },
  { id: 'p4', kind: 'video',  aspect: { w: 1080, h: 1080 }, dir: 'p4-matrix-square', duration: 9 },
  { id: 'p5', kind: 'video',  aspect: { w: 1080, h: 1920 }, dir: 'p5-vertical-short', duration: 7 },
  { id: 'p6', kind: 'static', aspect: { w: 1080, h: 1080 }, dir: 'p6-install-square' },
];

const onlyArg = process.argv.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',')) : null;

fs.mkdirSync(RENDERS_DIR, { recursive: true });

// ─── tiny static server (so file:// importmap quirks don't bite videos) ─────
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

// SERVE_ROOT = the sigillerie project root so posts can reference ../../repo/assets/
const SERVE_ROOT = path.resolve(LAUNCH_DIR, '..');
const { server, port } = await startServer(SERVE_ROOT);
console.log(`▸ static server on http://127.0.0.1:${port} (root: ${SERVE_ROOT})`);

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    process.platform === 'win32' ? '--use-angle=d3d11' : '--use-angle=vulkan',
    '--enable-unsafe-webgpu',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

async function renderStaticPng(post) {
  const outPng = path.join(RENDERS_DIR, `${post.id}.png`);
  const ctx = await browser.newContext({
    viewport: { width: post.aspect.w, height: post.aspect.h },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const pageErrs = [];
  page.on('pageerror', e => pageErrs.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') pageErrs.push(`[console] ${m.text()}`);
  });

  const url = `http://127.0.0.1:${port}/launch/posts/${post.dir}/index.html`;
  console.log(`▸ ${post.id} static: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  try {
    await page.waitForFunction(() => window.__ready === true, { timeout: 15_000 });
  } catch {
    console.warn(`  ! ${post.id}: __ready timeout, capturing anyway`);
  }
  await page.waitForTimeout(800);

  await page.screenshot({ path: outPng, fullPage: false });
  if (pageErrs.length) {
    console.warn(`  ! ${post.id} page errors:\n    ${pageErrs.slice(0, 5).join('\n    ')}`);
  }
  await ctx.close();
  console.log(`  ✓ ${outPng}`);
}

function renderVideo(post) {
  const inputHtml = path.join(POSTS_DIR, post.dir, 'index.html');
  const outMp4 = path.join(RENDERS_DIR, `${post.id}.mp4`);
  console.log(`▸ ${post.id} video: ${inputHtml}`);

  const args = [
    path.join(REPO_DIR, 'scripts', 'render-video.js'),
    inputHtml,
    `--mode=html`,
    `--width=${post.aspect.w}`,
    `--height=${post.aspect.h}`,
    `--duration=${post.duration}`,
    `--fps=30`,
    `--base-fps=30`,
    `--output=${outMp4}`,
    `--gif`,
    `--verbose`,
  ];
  const r = spawnSync('node', args, { stdio: 'inherit', cwd: REPO_DIR });
  if (r.status !== 0) {
    console.error(`  ✗ ${post.id}: render-video.js exit ${r.status}`);
  } else {
    console.log(`  ✓ ${outMp4}`);
    // ALSO grab a poster PNG for the README
    return renderStaticPosterFromVideo(post, outMp4);
  }
}

async function renderStaticPosterFromVideo(post, mp4Path) {
  const posterPng = path.join(RENDERS_DIR, `${post.id}-poster.png`);
  // grab a frame near the peak (~70% of duration) for the README thumbnail
  const t = (post.duration * 0.7).toFixed(2);
  const r = spawnSync('ffmpeg', [
    '-y', '-ss', t, '-i', mp4Path,
    '-frames:v', '1',
    '-q:v', '2',
    posterPng,
  ], { stdio: 'ignore' });
  if (r.status === 0) console.log(`  ✓ ${posterPng}`);
  else console.warn(`  ! ${post.id}: poster grab failed`);
}

// ─── main loop ──────────────────────────────────────────────────────────────
try {
  for (const post of SLATE) {
    if (ONLY && !ONLY.has(post.id)) continue;
    const indexPath = path.join(POSTS_DIR, post.dir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      console.warn(`  ! ${post.id}: ${indexPath} missing, skipping`);
      continue;
    }
    if (post.kind === 'static') {
      await renderStaticPng(post);
    } else {
      // video render is sync (spawns child); browser stays for posters
      await renderVideo(post);
    }
  }
} finally {
  await browser.close();
  server.close();
  console.log(`\n▸ done. renders -> ${RENDERS_DIR}`);
}
