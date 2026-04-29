#!/usr/bin/env node
/**
 * Sigillerie · render-video.js
 *
 * HTML capture pipeline for --mode=html (Producer mode).
 *
 *   Playwright headless Chromium (GPU on)
 *     -> warmup context (JIT + font cache)
 *     -> recording context, recordVideo (Playwright native rate)
 *     -> wait window.__ready, hold for duration
 *     -> ffmpeg WebM -> H.264 MP4 at output fps
 *     -> optional minterpolate when --fps differs from --base-fps
 *     -> optional GIF via convert-formats.sh
 *     -> optional Tone.js audio mux
 *
 * 3D mode (--mode=3d) drives modes/three3d/page-contract.md via CDP
 * HeadlessExperimental.beginFrame against a virtualized clock. Page exposes
 * window.__renderFrame(t_ms); recorder owns time, captures PNG sequence,
 * encodes via pickEncoder(). Falls back to page.screenshot() if the CDP
 * domain is missing.
 *
 * Reference: huashu-design/scripts/render-video.js (parity, re-implemented).
 * See modes/producer/animation-pitfalls.md §5, §12 for the warmup + __ready
 * + __seek triad these defenses are built around.
 *
 * Hard rules:
 *   - No SDK / API-key deps. Pure render pipeline.
 *   - Don't reinvent capture. Playwright recordVideo is the source of truth.
 *
 * CLI:
 *   node scripts/render-video.js <input.html> [options]
 *
 * Options: see usage() below or --help.
 */

'use strict';

// Playwright is required lazily after arg parsing so --help works without
// node_modules installed.
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawnSync } = require('child_process');
const { parseArgs } = require('node:util');

// ─── LOCAL HTTP SERVER ───────────────────────────────────────────────────────
// 3D mode pages use CDN importmaps with bare specifiers. Chromium resolves
// CDN sub-imports relative to the CDN host, which only works when the page
// is served over http://. file:// treats any absolute path (/foo) as local
// filesystem, breaking transitive CDN deps like tw-to-css, @preact/signals,
// etc. This server serves the repo root so demos can load ../../assets/ and
// the browser resolves CDN imports correctly.

function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function startStaticServer(root) {
  const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.jsx': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.wasm': 'application/wasm',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
  };
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(root, req.url.split('?')[0]);
      // Prevent path traversal outside root.
      if (!filePath.startsWith(root)) {
        res.writeHead(403); res.end(); return;
      }
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
      } catch {
        res.writeHead(404); res.end(); return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
    server.on('error', reject);
  });
}

// ─── ARGS ────────────────────────────────────────────────────────────────────

function usage() {
  console.log(`Sigillerie render-video.js

Usage:
  node scripts/render-video.js <input.html> [options]

Options:
  --mode=html|3d|tone   default: auto (3d if window.__renderFrame exists)
  --duration=<sec>      default: read window.__duration, fallback 10
  --width=<px>          default: 1920
  --height=<px>         default: 1080
  --fps=<n>             output fps, default: 30 (matches base, no interp)
  --base-fps=<n>        capture fps, default: 30
  --output=<path>       default: <input>.mp4
  --no-interp           force skip interp, output at base-fps
  --60fps               shorthand for --fps=60 (engages minterpolate)
  --gpu-encode          force NVENC encode (fails if unavailable)
  --cpu-encode          force libx264 (default if NVENC absent)
  --ssaa=<n>            super-sample factor 1-4, default 2 (1=off, 3=hero, 4=print)
  --frame-interval=<ms> 3d mode: override per-frame interval (default 1000/fps)
  --audio-tail-buffer=<ms>  3d mode: extra audio capture past last frame (default 200)
  --4k                  shorthand for --width=3840 --height=2160
  --1440p               shorthand for --width=2560 --height=1440
  --720p                shorthand for --width=1280 --height=720
  --vertical            shorthand for 1080x1920 (Reels / TikTok / Shorts)
  --square              shorthand for 1080x1080 (Instagram feed)
  --audio=tone          mux runtime Tone.js MediaRecorder audio
  --gif                 also emit GIF via convert-formats.sh
  --no-gpu              disable GPU flags (CI / debug)
  --verbose             log timing, sizes, ffmpeg invocation
  --help

Exit codes:
  0 ok · 1 page load · 2 __ready timeout · 3 empty recording · 4 ffmpeg fail
`);
}

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      mode:        { type: 'string' },
      duration:    { type: 'string' },
      width:       { type: 'string' },
      height:      { type: 'string' },
      fps:         { type: 'string' },
      'base-fps':  { type: 'string' },
      '60fps':     { type: 'boolean' },
      output:      { type: 'string' },
      'no-interp': { type: 'boolean' },
      audio:       { type: 'string' },
      gif:         { type: 'boolean' },
      'no-gpu':    { type: 'boolean' },
      'gpu-encode': { type: 'boolean' },
      'cpu-encode': { type: 'boolean' },
      ssaa:        { type: 'string' },
      'frame-interval':    { type: 'string' },
      'audio-tail-buffer': { type: 'string' },
      '4k':        { type: 'boolean' },
      '1440p':     { type: 'boolean' },
      '720p':      { type: 'boolean' },
      vertical:    { type: 'boolean' },
      square:      { type: 'boolean' },
      verbose:     { type: 'boolean' },
      help:        { type: 'boolean' },
    },
  });
} catch (e) {
  console.error('arg error: ' + e.message);
  usage();
  process.exit(1);
}

if (parsed.values.help || parsed.positionals.length === 0) {
  usage();
  process.exit(parsed.values.help ? 0 : 1);
}

const INPUT      = parsed.positionals[0];
const MODE_ARG   = parsed.values.mode || 'auto';

// Resolution presets. Explicit --width / --height beats presets.
function resolveDimensions() {
  if (parsed.values.width || parsed.values.height) {
    return [parseInt(parsed.values.width || '1920', 10), parseInt(parsed.values.height || '1080', 10)];
  }
  if (parsed.values['4k'])    return [3840, 2160];
  if (parsed.values['1440p']) return [2560, 1440];
  if (parsed.values['720p'])  return [1280, 720];
  if (parsed.values.vertical) return [1080, 1920];
  if (parsed.values.square)   return [1080, 1080];
  return [1920, 1080];
}
const [WIDTH, HEIGHT] = resolveDimensions();
// Default 30/30: matches Playwright's native rate well, skips minterpolate.
// Use --60fps or --fps=60 to engage interp for hero / cinematic deliverables.
const FPS_OUT    = parseInt(parsed.values.fps    || (parsed.values['60fps'] ? '60' : '30'), 10);
const FPS_BASE   = parseInt(parsed.values['base-fps'] || '30', 10);
const NO_INTERP  = parsed.values['no-interp'] === true;
const NO_GPU     = parsed.values['no-gpu']    === true;
const FORCE_GPU_ENCODE = parsed.values['gpu-encode'] === true;
const FORCE_CPU_ENCODE = parsed.values['cpu-encode'] === true;
// SSAA: render at SSAA× the output resolution, downsample with lanczos at encode.
// Defaults to 2× for crisp text and edges. Set --ssaa=1 to disable, --ssaa=3 for hero render.
const SSAA = Math.max(1, Math.min(4, parseInt(parsed.values.ssaa || '2', 10)));
const VERBOSE    = parsed.values.verbose      === true;
const WANT_GIF   = parsed.values.gif          === true;
const AUDIO_MODE = parsed.values.audio || null;   // 'tone' or null
const DURATION_OVERRIDE = parsed.values.duration ? parseFloat(parsed.values.duration) : null;
const FRAME_INTERVAL_OVERRIDE = parsed.values['frame-interval']
  ? parseFloat(parsed.values['frame-interval'])
  : null;
const AUDIO_TAIL_BUFFER_MS = parsed.values['audio-tail-buffer']
  ? parseInt(parsed.values['audio-tail-buffer'], 10)
  : 200;

// ─── VALIDATE ────────────────────────────────────────────────────────────────

if (!fs.existsSync(INPUT)) {
  console.error(`✗ input not found: ${INPUT}`);
  process.exit(1);
}
if (path.extname(INPUT).toLowerCase() !== '.html') {
  console.error(`✗ input must be .html, got: ${path.extname(INPUT)}`);
  process.exit(1);
}

const HTML_ABS = path.resolve(INPUT);
const HTML_DIR = path.dirname(HTML_ABS);
const HTML_BASE = path.basename(HTML_ABS, path.extname(HTML_ABS));
const URL = 'file://' + HTML_ABS.replace(/\\/g, '/');

const OUTPUT = parsed.values.output
  ? path.resolve(parsed.values.output)
  : path.join(HTML_DIR, HTML_BASE + '.mp4');

const TMP_DIR = path.join(
  os.tmpdir(),
  `sigillerie-render-${Date.now()}-${process.pid}`,
);

// ─── LAUNCH ──────────────────────────────────────────────────────────────────

function gpuArgs() {
  if (NO_GPU) return [];
  // Per modes/producer/video-export.md GPU flags. ANGLE backend per platform.
  const angleBackend =
    process.platform === 'win32'  ? 'd3d11' :
    process.platform === 'darwin' ? 'metal' :
                                    'vulkan';
  return [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    `--use-angle=${angleBackend}`,
    '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    // allow fetch() of sibling files when input is a file:// URL
    '--allow-file-access-from-files',
    '--disable-web-security',
  ];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function log(...args) {
  console.log('▸', ...args);
}
function vlog(...args) {
  if (VERBOSE) console.log('  [verbose]', ...args);
}

// ─── NVENC DETECT ────────────────────────────────────────────────────────────
// Probes ffmpeg once for h264_nvenc availability. Cached after first call.
let _nvencCache = null;
function hasNvenc() {
  if (_nvencCache !== null) return _nvencCache;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  if (r.status !== 0) { _nvencCache = false; return false; }
  _nvencCache = /^\s*V[\.\w]+\s+h264_nvenc\s/m.test(r.stdout || '');
  return _nvencCache;
}

// Returns the chosen encoder + ffmpeg args. Order:
//   --cpu-encode -> libx264
//   --gpu-encode -> h264_nvenc (errors if unavailable)
//   neither     -> auto: nvenc if detected, else libx264
function pickEncoder() {
  if (FORCE_CPU_ENCODE) return { name: 'libx264 (forced cpu)', args: x264Args() };
  const available = hasNvenc();
  if (FORCE_GPU_ENCODE && !available) {
    console.error('✗ --gpu-encode requested but h264_nvenc not available in ffmpeg');
    console.error('  install ffmpeg with NVENC, or drop the flag (auto-detect falls back to libx264)');
    process.exit(5);
  }
  if (available) return { name: 'h264_nvenc (gpu)', args: nvencArgs() };
  return { name: 'libx264 (cpu, no nvenc detected)', args: x264Args() };
}

function x264Args() {
  return [
    '-c:v', 'libx264',
    '-crf', '16',
    '-preset', 'slow',
    '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709',
    '-colorspace', 'bt709',
    '-color_trc', 'bt709',
    '-movflags', '+faststart',
  ];
}

function nvencArgs() {
  // p7 = slowest preset = highest quality. cq 19 ≈ x264 crf 16.
  // -tune hq biases toward visual fidelity. -rc vbr lets cq drive bitrate.
  return [
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
  ];
}

function ffprobeDuration(file) {
  const r = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const d = parseFloat((r.stdout || '').trim());
  return Number.isFinite(d) ? d : null;
}

function ffprobeHasVideo(file) {
  const r = spawnSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_type',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ], { encoding: 'utf8' });
  return r.status === 0 && (r.stdout || '').trim() === 'video';
}

function fileMB(file) {
  try { return (fs.statSync(file).size / 1024 / 1024).toFixed(1); }
  catch { return '?'; }
}

function runFfmpeg(args) {
  vlog('ffmpeg ' + args.map(a => /\s/.test(a) ? `"${a}"` : a).join(' '));
  const r = spawnSync('ffmpeg', args, { stdio: VERBOSE ? 'inherit' : ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) {
    const stderr = r.stderr ? r.stderr.toString().slice(-2000) : '(no stderr)';
    console.error('✗ ffmpeg failed:\n' + stderr);
    process.exit(4);
  }
}

function cleanup() {
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);

// ─── 3D MODE: deterministic frame stepping ───────────────────────────────────
// Per HUASHU-3D-FORK-PLAN.md §4.3 and modes/three3d/page-contract.md.
//
// The page exposes window.__renderFrame(t_ms). The recorder owns the clock:
// it sets window.__virtualTimeMs, calls __renderFrame(t), then captures a PNG
// via CDP HeadlessExperimental.beginFrame. Wall-clock APIs are pre-stubbed
// via addInitScript so the page cannot read real time. The result is bit-exact
// frames at exactly t = i * frameInterval for i = 0..totalFrames-1.
//
// Fallback path (if HeadlessExperimental.beginFrame is not available in the
// current Chromium build) uses page.screenshot() with the same virtual clock
// loop. Same determinism, slightly slower, no CDP dependency.

async function renderMode3D({ browser, t0, tmpDir, url, output }) {
  log('mode=3d: deterministic frame stepping via CDP beginFrame');

  // ─── CONTEXT + CLOCK STUBS ────────────────────────────────────────────────
  // Build a non-recordVideo context (we capture frames ourselves, not via
  // Playwright recordVideo). deviceScaleFactor=SSAA passes through to
  // Chromium's compositor: screenshots come out at WIDTH*SSAA × HEIGHT*SSAA.
  const recCtx = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SSAA,
  });

  // Recording handshake: set BEFORE navigation so the page reads it during
  // boot and stays out of the rAF loop (page-contract.md §__recording).
  await recCtx.addInitScript(() => {
    window.__recording = true;
  });

  // Virtual clock: stub Date.now / performance.now and neutralize rAF so
  // the page cannot read wall-clock or self-drive its render loop. The
  // recorder is the only thing that advances time. Per page-contract.md §3
  // (banned wall-clock APIs).
  await recCtx.addInitScript(() => {
    window.__virtualTimeMs = 0;
    const _origPerfNow = (typeof performance !== 'undefined' && performance.now)
      ? performance.now.bind(performance) : null;
    // Date.now: always return virtual time. ms-since-epoch shape preserved
    // by adding a frozen epoch base so any code doing Date.now() - someBase
    // sees monotonic deltas.
    const _epoch = Date.now();
    Date.now = () => _epoch + (window.__virtualTimeMs || 0);
    if (_origPerfNow) {
      // performance.now: must remain monotonically increasing, or React's
      // scheduler gets stuck (it uses perf.now() for yield / time-slice
      // decisions; a constant 0 causes hasTimeRemaining() to always return
      // false, stalling React). Use real wall-clock perf.now so the
      // scheduler yields correctly. Virtual time (window.__virtualTimeMs)
      // only needs to affect THREE animation uniforms and Stage3D's clock,
      // not the React scheduler itself.
      // eslint-disable-next-line no-global-assign
      // performance.now = () => window.__virtualTimeMs || 0; // REMOVED
    }
    // requestAnimationFrame: replaced with a setTimeout-based shim that
    // fires callbacks on the next macrotask (≈0ms). This lets the scheduler
    // of React and other libs continue to work (they use rAF for yield
    // budgeting / commit phases). The stage3d.jsx recording guard
    // (!window.__recording) already prevents Stage3D from self-driving the
    // THREE render loop via rAF — the only rAFs we intercept here are
    // incidental ones from React, Babel, and boot-time loaders.
    //
    // The dead-queue approach (store but never fire) was abandoned because
    // React 18's scheduler posts an rAF as part of its commit handshake;
    // if it never fires, React freezes mid-boot, __ready is never set,
    // and the 90s timeout fires with only a Babel warning in the log.
    const _rafIds = new Map();
    let _rafNextId = 1;
    window.requestAnimationFrame = (cb) => {
      const id = _rafNextId++;
      const t_ms = window.__virtualTimeMs || 0;
      const tid = setTimeout(() => {
        _rafIds.delete(id);
        try { cb(t_ms); } catch {}
      }, 0);
      _rafIds.set(id, tid);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      const tid = _rafIds.get(id);
      if (tid !== undefined) { clearTimeout(tid); _rafIds.delete(id); }
    };
    window.__flushRaf = () => {
      // Flush is now a no-op: all rAF callbacks auto-fire via setTimeout(0).
      // Kept for compatibility with page-contract callers that invoke it.
    };
  });

  // Audio capture: same Tone.js MediaRecorder bridge as html mode, kept here
  // so 3D pages with __audioRuntime='tone' get audio without duplicating
  // logic.
  let audioChunks = null;
  if (AUDIO_MODE === 'tone') {
    audioChunks = [];
    await recCtx.exposeFunction('__sigillerieAudioChunk', (b64) => {
      audioChunks.push(Buffer.from(b64, 'base64'));
    });
    await recCtx.addInitScript(() => {
      window.__sigillerieRegisterRecorder = (rec) => {
        rec.addEventListener('dataavailable', async (ev) => {
          if (!ev.data || ev.data.size === 0) return;
          const buf = await ev.data.arrayBuffer();
          let bin = '';
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          window.__sigillerieAudioChunk(btoa(bin));
        });
      };
    });
  }

  const page = await recCtx.newPage();

  const consoleMsgs = [];
  page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', err => consoleMsgs.push(`[error] ${err.message}`));

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  } catch (e) {
    console.error(`✗ page load failed: ${url}`);
    console.error(`  ${e.message}`);
    await recCtx.close();
    await browser.close();
    process.exit(1);
  }

  // ─── DURATION ─────────────────────────────────────────────────────────────
  let duration = DURATION_OVERRIDE;
  if (duration === null) {
    duration = await page.evaluate(() => {
      const d = window.__duration;
      return typeof d === 'number' && d > 0 ? d : null;
    }).catch(() => null);
  }
  if (duration === null) duration = 10;
  log(`duration: ${duration}s`);

  // ─── WAIT FOR READY ───────────────────────────────────────────────────────
  // 3D contract requires both __ready AND __sceneReady (assets resolved).
  // page-contract.md §__sceneReady. Without this we capture placeholders.
  log('waiting for window.__ready && window.__sceneReady ...');
  let readyOk = true;
  try {
    await page.waitForFunction(
      () => window.__ready === true && window.__sceneReady === true,
      { timeout: 90_000 },
    );
  } catch {
    readyOk = false;
  }

  if (!readyOk) {
    console.error('✗ window.__ready && window.__sceneReady not set within 90s');
    console.error('  page may have failed to boot or assets did not resolve.');
    console.error('  recent console output:');
    for (const line of consoleMsgs.slice(-20)) console.error('    ' + line);
    try {
      const shotPath = path.join(tmpDir, 'failure.png');
      await page.screenshot({ path: shotPath, fullPage: false });
      console.error(`  screenshot: ${shotPath}`);
    } catch {}
    await recCtx.close();
    await browser.close();
    process.exit(2);
  }

  // Confirm __renderFrame is callable (defense; auto-detect already verified).
  const hasRenderFrame = await page.evaluate(
    () => typeof window.__renderFrame === 'function',
  );
  if (!hasRenderFrame) {
    console.error('✗ window.__renderFrame is not a function after __sceneReady');
    await recCtx.close();
    await browser.close();
    process.exit(2);
  }

  // Drain any boot-time rAF callbacks at t=0 so loaders/post-init effects
  // settle before we start stepping time. Then commit a fresh t=0 frame
  // through __renderFrame so the first captured frame is canonical.
  await page.evaluate(() => {
    if (typeof window.__flushRaf === 'function') window.__flushRaf();
    window.__virtualTimeMs = 0;
    window.__renderFrame(0);
  });

  // ─── CDP SESSION + BEGINFRAME PROBE ───────────────────────────────────────
  const fps = FPS_BASE;
  const frameInterval = FRAME_INTERVAL_OVERRIDE !== null
    ? FRAME_INTERVAL_OVERRIDE
    : (1000 / fps);
  const totalFrames = Math.round(duration * fps);
  log(`capture: ${totalFrames} frames @ ${fps}fps (interval ${frameInterval.toFixed(3)}ms)`);

  const client = await page.context().newCDPSession(page);
  let useBeginFrame = true;
  try {
    await client.send('HeadlessExperimental.enable');
    vlog('CDP HeadlessExperimental enabled');
  } catch (e) {
    useBeginFrame = false;
    vlog(`HeadlessExperimental.enable failed: ${e.message}`);
  }

  // Probe one beginFrame call. Some Chromium builds expose the domain but
  // reject screenshot params; if the probe throws, fall back to page
  // screenshots with the same virtual-clock timing.
  if (useBeginFrame) {
    try {
      const probe = await client.send('HeadlessExperimental.beginFrame', {
        frameTimeTicks: 0,
        interval: frameInterval,
        screenshot: { format: 'png' },
      });
      if (!probe || !probe.screenshotData) {
        useBeginFrame = false;
        vlog('beginFrame probe returned no screenshotData; falling back');
      }
    } catch (e) {
      useBeginFrame = false;
      vlog(`beginFrame probe threw: ${e.message}; falling back`);
    }
  }
  log(`capture path: ${useBeginFrame ? 'CDP beginFrame' : 'page.screenshot fallback'}`);

  // ─── AUDIO START ──────────────────────────────────────────────────────────
  // Audio runs in real wall-clock; the page records its Tone.js output to a
  // MediaRecorder which keeps writing while we step frames. This works
  // because audio is captured at runtime rate, not virtual rate; the mux
  // step trims to duration. Tail buffer past the last frame keeps the audio
  // tail intact.
  if (AUDIO_MODE === 'tone') {
    await page.evaluate(() => {
      if (typeof window.__audioStart === 'function') window.__audioStart();
    }).catch(() => {});
  }

  // ─── FRAME LOOP ───────────────────────────────────────────────────────────
  const captureT0 = Date.now();
  for (let i = 0; i < totalFrames; i++) {
    const t_ms = i * frameInterval;

    // Advance virtual clock + run page render. __renderFrame is pure of t,
    // so this single call commits the scene state for this tick.
    await page.evaluate((t) => {
      window.__virtualTimeMs = t;
      window.__renderFrame(t);
    }, t_ms);

    let pngBuf;
    if (useBeginFrame) {
      const result = await client.send('HeadlessExperimental.beginFrame', {
        frameTimeTicks: t_ms,
        interval: frameInterval,
        screenshot: { format: 'png' },
      });
      if (!result || !result.screenshotData) {
        // Mid-loop failure. Drop to fallback for the rest of the run rather
        // than aborting; we have the path tested.
        vlog(`beginFrame returned empty at frame ${i}; switching to fallback`);
        useBeginFrame = false;
        pngBuf = await page.screenshot({ type: 'png', omitBackground: false });
      } else {
        pngBuf = Buffer.from(result.screenshotData, 'base64');
      }
    } else {
      pngBuf = await page.screenshot({ type: 'png', omitBackground: false });
    }

    const framePath = path.join(tmpDir, `frame_${String(i).padStart(5, '0')}.png`);
    fs.writeFileSync(framePath, pngBuf);

    if (VERBOSE && (i % 30 === 0 || i === totalFrames - 1)) {
      const pct = (((i + 1) / totalFrames) * 100).toFixed(1);
      vlog(`frame ${i + 1}/${totalFrames} (${pct}%)`);
    }
  }
  vlog(`frames captured in ${((Date.now() - captureT0) / 1000).toFixed(2)}s`);

  // ─── AUDIO STOP ───────────────────────────────────────────────────────────
  if (AUDIO_MODE === 'tone') {
    // Hold for tail buffer so the page's MediaRecorder catches reverb /
    // release tails past the last visual frame.
    if (AUDIO_TAIL_BUFFER_MS > 0) {
      await page.waitForTimeout(AUDIO_TAIL_BUFFER_MS);
    }
    await page.evaluate(() => {
      if (typeof window.__audioStop === 'function') window.__audioStop();
    }).catch(() => {});
    // Let MediaRecorder flush its last ondataavailable.
    await page.waitForTimeout(150);
  }

  await page.close();
  await recCtx.close();
  await browser.close();
  vlog(`capture done @ ${((Date.now() - t0) / 1000).toFixed(2)}s`);

  // ─── ENCODE ───────────────────────────────────────────────────────────────
  // PNG sequence -> H.264 MP4 via shared pickEncoder(). No SSAA scale filter:
  // Chromium already rasterized at deviceScaleFactor=SSAA, so PNGs are at
  // WIDTH*SSAA × HEIGHT*SSAA. The encode path resamples down to the target
  // output size with lanczos at the same time as fps work. Output fps in 3D
  // mode is captured fps directly (no minterpolate; we already drew the
  // exact frame count).
  let audioPath = null;
  if (AUDIO_MODE === 'tone' && audioChunks && audioChunks.length > 0) {
    audioPath = path.join(tmpDir, 'audio-track.webm');
    fs.writeFileSync(audioPath, Buffer.concat(audioChunks));
    vlog(`audio chunks: ${audioChunks.length} · ${fileMB(audioPath)} MB`);
  } else if (AUDIO_MODE === 'tone') {
    console.warn('  ! --audio=tone but no chunks captured. Did the page call __sigillerieRegisterRecorder?');
  }

  const targetFps = fps;
  log(`encode: frame_%05d.png -> ${path.basename(output)} (H.264, ${targetFps}fps)`);

  const encoder = pickEncoder();
  log(`encoder: ${encoder.name}`);

  const args = [
    '-y',
    '-framerate', String(targetFps),
    '-i', path.join(tmpDir, 'frame_%05d.png'),
  ];

  if (audioPath) {
    args.push('-i', audioPath);
  }

  const vf = [];
  // SSAA down-sample. PNGs are at WIDTH*SSAA × HEIGHT*SSAA; bring to output
  // size with lanczos. For SSAA=1 this is a no-op; skip the filter.
  if (SSAA > 1) {
    vf.push(`scale=${WIDTH}:${HEIGHT}:flags=lanczos`);
  }

  args.push('-t', duration.toFixed(3));

  if (vf.length > 0) {
    args.push('-vf', vf.join(','));
  }

  args.push(...encoder.args);

  if (audioPath) {
    args.push(
      '-c:a', 'aac',
      '-b:a', '192k',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-shortest',
    );
  } else {
    args.push('-an');
  }

  args.push(output);
  runFfmpeg(args);

  // ─── VERIFY ───────────────────────────────────────────────────────────────
  if (!fs.existsSync(output)) {
    console.error(`✗ output not written: ${output}`);
    process.exit(4);
  }
  if (!ffprobeHasVideo(output)) {
    console.error(`✗ output has no video stream: ${output}`);
    process.exit(3);
  }
  const outDur = ffprobeDuration(output);
  if (outDur === null) {
    console.error(`✗ cannot probe output duration`);
    process.exit(3);
  }
  if (Math.abs(outDur - duration) > 0.5) {
    console.warn(`  ! output duration ${outDur.toFixed(2)}s drifted from target ${duration}s (>0.5s)`);
  }

  // Optional GIF hand-off, same as html mode.
  if (WANT_GIF) {
    const conv = path.join(__dirname, 'convert-formats.sh');
    if (!fs.existsSync(conv)) {
      console.warn(`  ! --gif requested but ${conv} not found. Skipping GIF.`);
    } else {
      log('gif: invoking convert-formats.sh ...');
      const r = spawnSync('bash', [conv, output, '--gif'], {
        stdio: VERBOSE ? 'inherit' : 'ignore',
      });
      if (r.status !== 0) {
        console.warn('  ! convert-formats.sh exited non-zero. GIF may be missing.');
      }
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  log(`done in ${elapsed}s`);
  log(`  ${output}`);
  log(`  ${fileMB(output)} MB · ${outDur.toFixed(2)}s · ${targetFps}fps`);
  if (audioPath) log(`  + audio track muxed (${AUDIO_MODE})`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

(async () => {
  const t0 = Date.now();
  log(`input:  ${HTML_ABS}`);
  log(`output: ${OUTPUT}`);
  log(`size:   ${WIDTH}x${HEIGHT} · base ${FPS_BASE}fps · out ${NO_INTERP ? FPS_BASE : FPS_OUT}fps`);

  // Lazy require so --help / arg errors don't need node_modules.
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    console.error('✗ playwright not installed. Run: npm install (or npm i playwright)');
    process.exit(1);
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });
  vlog(`tmp: ${TMP_DIR}`);

  const browser = await chromium.launch({
    args: gpuArgs(),
  });

  // ─── WARMUP ────────────────────────────────────────────────────────────────
  // Per animation-pitfalls.md §5, §12: separate context with no recordVideo
  // pre-warms JIT + fonts + image cache. Without this, recording context's
  // first 1.5-3s of WebM are blank/partial.
  log('warmup: priming JIT and font cache...');
  {
    const warmCtx = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
    });
    const warmPage = await warmCtx.newPage();
    try {
      await warmPage.goto(URL, { waitUntil: 'load', timeout: 60_000 });
    } catch (e) {
      console.error(`✗ page load failed: ${URL}`);
      console.error(`  ${e.message}`);
      await browser.close();
      process.exit(1);
    }
    // Let fonts settle. document.fonts.ready resolves once webfonts load.
    await warmPage.evaluate(() => document.fonts && document.fonts.ready)
      .catch(() => {});
    await warmPage.waitForTimeout(800);
    await warmCtx.close();
  }
  vlog(`warmup done @ ${((Date.now() - t0) / 1000).toFixed(2)}s`);

  // ─── MODE DETECT ───────────────────────────────────────────────────────────
  // For auto mode, peek at the page (in a fresh non-record context) to look
  // for window.__renderFrame. If present, it's a 3D scene driven by CDP
  // beginFrame and this script can't record it (Phase 4 stub).
  let mode = MODE_ARG;
  if (mode === 'auto' || mode === '3d') {
    const peekCtx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
    const peekPage = await peekCtx.newPage();
    try {
      await peekPage.goto(URL, { waitUntil: 'load', timeout: 30_000 });
      const has3D = await peekPage.evaluate(
        () => typeof window.__renderFrame === 'function',
      ).catch(() => false);
      if (mode === 'auto') mode = has3D ? '3d' : 'html';
      if (mode === '3d' && !has3D) {
        console.error('✗ --mode=3d requested but window.__renderFrame is not a function');
        console.error('  3D pages must implement the contract in modes/three3d/page-contract.md');
        await peekCtx.close();
        await browser.close();
        process.exit(1);
      }
    } catch (e) {
      vlog(`mode detect failed: ${e.message}, falling back to html`);
      if (mode === 'auto') mode = 'html';
    }
    await peekCtx.close();
  }
  log(`mode: ${mode}`);

  if (mode === '3d') {
    // 3D mode: CDN importmaps use absolute sub-paths (/tw-to-css@...) that
    // only resolve correctly when served over HTTP (Chromium resolves them
    // relative to the CDN host). file:// treats them as local filesystem paths,
    // causing "Failed to resolve module specifier" errors for every transitive
    // CDN dependency. Spin up a one-shot local static server so importmaps
    // work, then close it after the render finishes.
    const repoRoot = findRepoRoot(HTML_DIR);
    const { server: staticServer, port: staticPort } = await startStaticServer(repoRoot);
    const relPath = HTML_ABS.replace(/\\/g, '/').replace(repoRoot.replace(/\\/g, '/'), '');
    const httpUrl = `http://127.0.0.1:${staticPort}${relPath}`;
    vlog(`3d static server: http://127.0.0.1:${staticPort} (root: ${repoRoot})`);
    try {
      await renderMode3D({
        browser,
        t0,
        tmpDir: TMP_DIR,
        url: httpUrl,
        output: OUTPUT,
      });
    } finally {
      staticServer.close();
    }
    return;
  }

  // ─── RECORD ────────────────────────────────────────────────────────────────
  // SSAA path: viewport stays at logical WIDTH×HEIGHT (CSS pixels). deviceScaleFactor
  // tells Chromium to rasterize at SSAA× DPI, so text and edges get subpixel detail
  // at higher resolution. Playwright captures viewport-sized (WIDTH×HEIGHT), Chromium's
  // compositor handles the downsample from device buffer to capture buffer.
  // (Earlier attempt: recordVideo.size = viewport*SSAA produced a top-left quadrant
  // bug because Playwright doesn't scale the viewport to match recordVideo.size.)
  log(`record: opening recording context (DPR ${SSAA}x, output ${WIDTH}x${HEIGHT})...`);
  const recCtx = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SSAA,
    recordVideo: {
      dir: TMP_DIR,
      size: { width: WIDTH, height: HEIGHT },
    },
  });

  // Handshake: tell the page it's being recorded BEFORE navigation.
  // animation-pitfalls.md §13: page reads __recording, forces loop=false,
  // disables idle animations, kills "press start" overlays.
  await recCtx.addInitScript(() => {
    window.__recording = true;
  });

  // Audio capture init: if --audio=tone, expose a Node-side hook the page can
  // pipe its MediaRecorder chunks into. The page is responsible for calling
  // window.__audioStart() / __audioStop() at the right moments via the
  // generative-audio capture-pipeline contract.
  let audioChunks = null;
  if (AUDIO_MODE === 'tone') {
    audioChunks = [];
    await recCtx.exposeFunction('__sigillerieAudioChunk', (b64) => {
      audioChunks.push(Buffer.from(b64, 'base64'));
    });
    await recCtx.addInitScript(() => {
      // Page-side glue: any code that creates a MediaRecorder for runtime
      // Tone.js output should call window.__sigillerieRegisterRecorder(rec)
      // after ondataavailable is wired. We then forward each chunk to Node.
      window.__sigillerieRegisterRecorder = (rec) => {
        rec.addEventListener('dataavailable', async (ev) => {
          if (!ev.data || ev.data.size === 0) return;
          const buf = await ev.data.arrayBuffer();
          let bin = '';
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          window.__sigillerieAudioChunk(btoa(bin));
        });
      };
    });
  }

  // Track T0 = recording-context creation. WebM writes start NOW, so the gap
  // between T0 and __ready is the head we will trim with ffmpeg -ss.
  const T_REC = Date.now();
  const page = await recCtx.newPage();

  // Page-level error capture for diagnostics.
  const consoleMsgs = [];
  page.on('console', m => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', err => consoleMsgs.push(`[error] ${err.message}`));

  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60_000 });
  } catch (e) {
    console.error(`✗ page load failed: ${URL}`);
    console.error(`  ${e.message}`);
    await recCtx.close();
    await browser.close();
    process.exit(1);
  }

  // Resolve duration: CLI override > page's window.__duration > 10s fallback.
  let duration = DURATION_OVERRIDE;
  if (duration === null) {
    duration = await page.evaluate(() => {
      const d = window.__duration;
      return typeof d === 'number' && d > 0 ? d : null;
    }).catch(() => null);
  }
  if (duration === null) duration = 10;
  log(`duration: ${duration}s`);

  // Wait for __ready. animation-pitfalls.md §12: page sets this on the first
  // rAF tick paired with t=0. Without it we'd capture mid-load black frames.
  log('waiting for window.__ready ...');
  let readyOk = true;
  try {
    await page.waitForFunction(() => window.__ready === true, { timeout: 30_000 });
  } catch {
    readyOk = false;
  }

  if (!readyOk) {
    console.error('✗ window.__ready not set within 30s');
    console.error('  page may have failed to boot. recent console output:');
    for (const line of consoleMsgs.slice(-20)) console.error('    ' + line);
    try {
      const shotPath = path.join(TMP_DIR, 'failure.png');
      await page.screenshot({ path: shotPath, fullPage: false });
      console.error(`  screenshot: ${shotPath}`);
    } catch {}
    await recCtx.close();
    await browser.close();
    process.exit(2);
  }

  const headOffset = (Date.now() - T_REC) / 1000;
  vlog(`__ready @ ${headOffset.toFixed(2)}s after T_REC (this is the trim head)`);

  // Defense in depth: if the page exposes __seek, snap time to 0 so the first
  // captured frame is t=0 even if the page's tick template was sloppy.
  await page.evaluate(() => {
    if (typeof window.__seek === 'function') window.__seek(0);
  }).catch(() => {});

  // Start audio recording on the page side, if requested.
  if (AUDIO_MODE === 'tone') {
    await page.evaluate(() => {
      if (typeof window.__audioStart === 'function') window.__audioStart();
    }).catch(() => {});
  }

  // Hold for animation duration + small tail buffer (200ms) so the recorder
  // captures the final frame cleanly without truncating mid-frame.
  await page.waitForTimeout(duration * 1000 + 200);

  if (AUDIO_MODE === 'tone') {
    await page.evaluate(() => {
      if (typeof window.__audioStop === 'function') window.__audioStop();
    }).catch(() => {});
    // Give MediaRecorder one tick to flush its last chunk through
    // ondataavailable.
    await page.waitForTimeout(150);
  }

  // Close the page first (forces a final WebM flush), then the context (which
  // finalizes the WebM file Playwright wrote).
  await page.close();
  await recCtx.close();
  await browser.close();
  vlog(`record done @ ${((Date.now() - t0) / 1000).toFixed(2)}s`);

  // ─── ENCODE ────────────────────────────────────────────────────────────────
  const webms = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.webm'));
  if (webms.length === 0) {
    console.error('✗ no .webm written by Playwright');
    process.exit(3);
  }
  const webmPath = path.join(TMP_DIR, webms[0]);
  const webmDur = ffprobeDuration(webmPath);
  vlog(`webm: ${webmPath} · ${fileMB(webmPath)} MB · ${webmDur ? webmDur.toFixed(2) + 's' : 'unknown duration'}`);
  if (!webmDur || webmDur < 0.5) {
    console.error(`✗ recording too short or unreadable (duration=${webmDur})`);
    process.exit(3);
  }

  // Write any captured audio to a sibling file so we can mux it in.
  let audioPath = null;
  if (AUDIO_MODE === 'tone' && audioChunks && audioChunks.length > 0) {
    audioPath = path.join(TMP_DIR, 'audio-track.webm');
    fs.writeFileSync(audioPath, Buffer.concat(audioChunks));
    vlog(`audio chunks: ${audioChunks.length} · ${fileMB(audioPath)} MB`);
  } else if (AUDIO_MODE === 'tone') {
    console.warn('  ! --audio=tone but no chunks captured. Did the page call __sigillerieRegisterRecorder?');
  }

  // Build ffmpeg pipeline:
  //   trim head (-ss before -i for fast keyframe seek, then accurate -ss
  //   after -i to land precisely on t=0 of the animation)
  //   limit to duration (-t)
  //   optional minterpolate to FPS_OUT
  //   optional audio mux
  //   H.264 high quality + bt709 color metadata for accurate playback.

  const targetFps = NO_INTERP ? FPS_BASE : FPS_OUT;
  log(`encode: ${webms[0]} -> ${path.basename(OUTPUT)} (H.264, ${targetFps}fps${NO_INTERP ? '' : ', minterpolate'})`);

  const args = [
    '-y',
    '-ss', headOffset.toFixed(3),  // trim warmup head (animation-pitfalls.md §12)
    '-i', webmPath,
  ];

  if (audioPath) {
    args.push('-i', audioPath);
  }

  // Video filter chain. Capture is already at output size; no scale needed.
  // Chromium rasterized at SSAA× DPI internally, so text/edge fidelity is baked
  // into the WebM at viewport resolution. ffmpeg only handles fps and codec.
  const vf = [];
  if (!NO_INTERP && FPS_OUT !== FPS_BASE) {
    vf.push(`minterpolate=fps=${FPS_OUT}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`);
  }
  // -t cuts to exact duration. Goes after seek so it counts from trimmed t=0.
  args.push('-t', duration.toFixed(3));

  if (vf.length > 0) {
    args.push('-vf', vf.join(','));
  }

  const encoder = pickEncoder();
  log(`encoder: ${encoder.name}`);
  args.push(...encoder.args);

  if (audioPath) {
    args.push(
      '-c:a', 'aac',
      '-b:a', '192k',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-shortest',
    );
  } else {
    args.push('-an');
  }

  args.push(OUTPUT);
  runFfmpeg(args);

  // ─── VERIFY ────────────────────────────────────────────────────────────────
  if (!fs.existsSync(OUTPUT)) {
    console.error(`✗ output not written: ${OUTPUT}`);
    process.exit(4);
  }
  if (!ffprobeHasVideo(OUTPUT)) {
    console.error(`✗ output has no video stream: ${OUTPUT}`);
    process.exit(3);
  }
  const outDur = ffprobeDuration(OUTPUT);
  if (outDur === null) {
    console.error(`✗ cannot probe output duration`);
    process.exit(3);
  }
  if (Math.abs(outDur - duration) > 0.5) {
    console.warn(`  ! output duration ${outDur.toFixed(2)}s drifted from target ${duration}s (>0.5s)`);
  }

  // Optional GIF via convert-formats.sh (hand-off to companion script).
  if (WANT_GIF) {
    const conv = path.join(__dirname, 'convert-formats.sh');
    if (!fs.existsSync(conv)) {
      console.warn(`  ! --gif requested but ${conv} not found. Skipping GIF.`);
    } else {
      log('gif: invoking convert-formats.sh ...');
      const r = spawnSync('bash', [conv, OUTPUT, '--gif'], {
        stdio: VERBOSE ? 'inherit' : 'ignore',
      });
      if (r.status !== 0) {
        console.warn('  ! convert-formats.sh exited non-zero. GIF may be missing.');
      }
    }
  }

  // ─── DONE ──────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  log(`done in ${elapsed}s`);
  log(`  ${OUTPUT}`);
  log(`  ${fileMB(OUTPUT)} MB · ${outDur.toFixed(2)}s · ${targetFps}fps`);
  if (audioPath) log(`  + audio track muxed (${AUDIO_MODE})`);
})().catch(err => {
  console.error('✗ unexpected error:');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
