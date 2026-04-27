#!/usr/bin/env node
/**
 * Sigillerie · render-video.js
 *
 * HTML capture pipeline for --mode=html (Producer mode).
 *
 *   Playwright headless Chromium (GPU on)
 *     -> warmup context (JIT + font cache)
 *     -> recording context, recordVideo @ 25fps
 *     -> wait window.__ready, hold for duration
 *     -> ffmpeg WebM -> H.264 MP4
 *     -> optional minterpolate 25 -> 60 fps
 *     -> optional GIF via convert-formats.sh
 *     -> optional Tone.js audio mux
 *
 * 3D mode (--mode=3d) is a stub. Phase 4 fills modes/three3d/page-contract.md
 * with the CDP beginFrame contract; this script will dispatch there.
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
const { spawnSync } = require('child_process');
const { parseArgs } = require('node:util');

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
  --fps=<n>             output fps, default: 60
  --base-fps=<n>        capture fps, default: 25 (Playwright ceiling)
  --output=<path>       default: <input>.mp4
  --no-interp           skip 25->60 interp, output at base-fps
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
      output:      { type: 'string' },
      'no-interp': { type: 'boolean' },
      audio:       { type: 'string' },
      gif:         { type: 'boolean' },
      'no-gpu':    { type: 'boolean' },
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
const WIDTH      = parseInt(parsed.values.width  || '1920', 10);
const HEIGHT     = parseInt(parsed.values.height || '1080', 10);
const FPS_OUT    = parseInt(parsed.values.fps    || '60',   10);
const FPS_BASE   = parseInt(parsed.values['base-fps'] || '25', 10);
const NO_INTERP  = parsed.values['no-interp'] === true;
const NO_GPU     = parsed.values['no-gpu']    === true;
const VERBOSE    = parsed.values.verbose      === true;
const WANT_GIF   = parsed.values.gif          === true;
const AUDIO_MODE = parsed.values.audio || null;   // 'tone' or null
const DURATION_OVERRIDE = parsed.values.duration ? parseFloat(parsed.values.duration) : null;

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
  ];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function log(...args) {
  console.log('▸', ...args);
}
function vlog(...args) {
  if (VERBOSE) console.log('  [verbose]', ...args);
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
    // TODO Phase 4: dispatch to a CDP beginFrame driver per
    // modes/three3d/page-contract.md. For now, hard-stop with a clear note so
    // callers know this is intentional, not silent breakage.
    console.error('');
    console.error('✗ --mode=3d not implemented in this script.');
    console.error('  Phase 4 (modes/three3d/page-contract.md) ships a CDP-based');
    console.error('  HeadlessExperimental.beginFrame driver. Until then, render');
    console.error('  3D scenes via the dedicated capture script (TBD).');
    console.error('');
    await browser.close();
    process.exit(1);
  }

  // ─── RECORD ────────────────────────────────────────────────────────────────
  log('record: opening recording context...');
  const recCtx = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
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

  // Video filter: minterpolate 25 -> 60 unless --no-interp.
  // Settings per modes/producer/video-export.md (mci + aobmc + bidir).
  const vf = [];
  if (!NO_INTERP && FPS_OUT !== FPS_BASE) {
    vf.push(`minterpolate=fps=${FPS_OUT}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`);
  }
  // -t cuts to exact duration. Goes after seek so it counts from trimmed t=0.
  args.push('-t', duration.toFixed(3));

  if (vf.length > 0) {
    args.push('-vf', vf.join(','));
  }

  args.push(
    '-c:v', 'libx264',
    '-crf', '16',
    '-preset', 'slow',
    '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709',
    '-colorspace', 'bt709',
    '-color_trc', 'bt709',
    '-movflags', '+faststart',
  );

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
