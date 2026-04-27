#!/usr/bin/env node
/**
 * export_deck_pptx.mjs, Sigillerie deck -> editable PowerPoint .pptx
 *
 * One job: orchestrate. We open each slide in headless Chromium, hand the live
 * page + a fresh pptxgenjs slide to html2pptx.js, and let the translator emit
 * native PPT objects (text frames, images, shapes). Result: every text box is
 * double-click editable in PowerPoint, every image is swappable.
 *
 * Two architectures handled:
 *   - multi-file: index.html with window.DECK_MANIFEST -> each slide is its own URL
 *   - single-file: <deck-stage> web component -> one URL, use goTo(i)
 *
 * The 4 hard constraints (see modes/producer/editable-pptx.md) live in the HTML,
 * not here. If a slide violates them, html2pptx throws; we log and (optionally)
 * fall back to a screenshot for that slide.
 *
 * Deps: playwright, pptxgenjs, sharp
 *
 * Usage:
 *   node scripts/export_deck_pptx.mjs <input.html> [--output=deck.pptx]
 *                                                  [--layout=LAYOUT_WIDE]
 *                                                  [--width=13.333] [--height=7.5]
 *                                                  [--background=true|false]
 *                                                  [--image-fallback]
 *                                                  [--verbose] [--help]
 */

import { chromium } from 'playwright';
import pptxgen from 'pptxgenjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- args ----------
function parseArgs(argv) {
  // simple key=value flag parser. positional = input.
  const opts = {
    input: null,
    output: null,
    layout: 'LAYOUT_WIDE',
    width: 13.333,
    height: 7.5,
    background: true,
    imageFallback: false,
    verbose: false,
    help: false,
  };
  for (const a of argv.slice(2)) {
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--verbose') opts.verbose = true;
    else if (a === '--image-fallback') opts.imageFallback = true;
    else if (a.startsWith('--output=')) opts.output = a.slice(9);
    else if (a.startsWith('--layout=')) opts.layout = a.slice(9);
    else if (a.startsWith('--width=')) opts.width = parseFloat(a.slice(8));
    else if (a.startsWith('--height=')) opts.height = parseFloat(a.slice(9));
    else if (a.startsWith('--background=')) opts.background = a.slice(13) === 'true';
    else if (!a.startsWith('--') && !opts.input) opts.input = a;
    else throw new Error(`unknown arg: ${a}`);
  }
  return opts;
}

const HELP = `
export_deck_pptx.mjs, export Sigillerie deck to editable .pptx

  node scripts/export_deck_pptx.mjs <input> [options]

  --output=<path>           default: <input>.pptx
  --layout=LAYOUT_WIDE      default: LAYOUT_WIDE (13.333 x 7.5 in, 16:9)
  --width=<inches>          default: 13.333
  --height=<inches>         default: 7.5
  --background=true|false   render slide bg as filled rect, default: true
  --image-fallback          fall back to per-slide screenshot if translator fails
  --verbose                 chatty
  --help                    this

  HTML must satisfy 4 hard constraints (see modes/producer/editable-pptx.md).
  Visual-rich decks should ship as PDF instead.
`;

// ---------- architecture detect ----------
// peek at the input HTML to decide single-file vs multi-file.
// signal: presence of <deck-stage> (single-file) vs window.DECK_MANIFEST (multi-file).
async function detectArchitecture(inputPath) {
  const html = await fs.readFile(inputPath, 'utf8');
  const hasDeckStage = /<deck-stage(\s|>)/i.test(html);
  const hasManifest = /window\.DECK_MANIFEST\s*=/.test(html);
  if (hasDeckStage && !hasManifest) return 'single-file';
  if (hasManifest && !hasDeckStage) return 'multi-file';
  if (hasManifest && hasDeckStage) return 'single-file'; // deck-stage wins, manifest is a comment example
  // last resort: if siblings look like slides/*.html, assume multi-file
  const slidesDir = path.join(path.dirname(inputPath), 'slides');
  try {
    const stat = await fs.stat(slidesDir);
    if (stat.isDirectory()) return 'multi-file';
  } catch {}
  throw new Error('cannot detect deck architecture: no <deck-stage> and no DECK_MANIFEST found');
}

// pull manifest by loading the index page in playwright (manifest is a JS literal).
async function readManifest(page, indexUrl) {
  await page.goto(indexUrl, { waitUntil: 'domcontentloaded' });
  const manifest = await page.evaluate(() => window.DECK_MANIFEST || []);
  if (!Array.isArray(manifest) || !manifest.length) {
    throw new Error('DECK_MANIFEST is empty or missing');
  }
  return manifest;
}

// ---------- background fill helper ----------
// pull computed body background from the live page so the pptx slide bg matches.
async function readBodyBackground(page) {
  return page.evaluate(() => {
    const bg = window.getComputedStyle(document.body).backgroundColor;
    // rgb(r,g,b) or rgba(r,g,b,a) -> hex. transparent -> null (let pptx default).
    const m = bg.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map(s => s.trim());
    const a = parts.length === 4 ? parseFloat(parts[3]) : 1;
    if (a === 0) return null;
    const toHex = n => Number(n).toString(16).padStart(2, '0').toUpperCase();
    return toHex(parts[0]) + toHex(parts[1]) + toHex(parts[2]);
  });
}

// ---------- image fallback ----------
// if html2pptx throws on a slide, screenshot it whole and add as one big image.
// not editable but at least the slide is in the deck.
async function imageFallbackSlide(page, pptxSlide, opts, log) {
  log(`  -> image-fallback: screenshotting slide`);
  const buf = await page.screenshot({ type: 'png', fullPage: false });
  pptxSlide.addImage({
    data: 'data:image/png;base64,' + buf.toString('base64'),
    x: 0, y: 0, w: opts.width, h: opts.height,
  });
}

// ---------- translator loader ----------
// html2pptx.js is a sibling. ESM import expected per spec.
// fallback: CommonJS require if it ships as CJS (older pptxgenjs ecosystems do this).
async function loadTranslator() {
  const sibling = path.join(__dirname, 'html2pptx.js');
  try {
    const mod = await import(pathToFileURL(sibling).href);
    if (typeof mod.translateSlideToPptx === 'function') return mod.translateSlideToPptx;
    if (typeof mod.default === 'function') return mod.default;
    if (typeof mod.default?.translateSlideToPptx === 'function') return mod.default.translateSlideToPptx;
  } catch (e) {
    // fall through to require
  }
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const cjs = require(sibling);
  if (typeof cjs.translateSlideToPptx === 'function') return cjs.translateSlideToPptx;
  if (typeof cjs === 'function') return cjs;
  throw new Error('html2pptx.js does not export translateSlideToPptx');
}

// ---------- main ----------
async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help || !opts.input) {
    console.log(HELP);
    process.exit(opts.help ? 0 : 1);
  }

  const inputPath = path.resolve(opts.input);
  await fs.access(inputPath); // throws if missing
  const outputPath = path.resolve(opts.output || inputPath.replace(/\.html?$/i, '') + '.pptx');
  const log = opts.verbose ? (...a) => console.log(...a) : () => {};

  const arch = await detectArchitecture(inputPath);
  console.log(`detected: ${arch} deck`);

  const translateSlideToPptx = await loadTranslator();

  // pptx setup. LAYOUT_WIDE is built-in (13.333 x 7.5). custom dims -> defineLayout.
  const pptx = new pptxgen();
  if (opts.layout === 'LAYOUT_WIDE' && Math.abs(opts.width - 13.333) < 0.01 && Math.abs(opts.height - 7.5) < 0.01) {
    pptx.layout = 'LAYOUT_WIDE';
  } else {
    pptx.defineLayout({ name: 'CUSTOM', width: opts.width, height: opts.height });
    pptx.layout = 'CUSTOM';
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: Math.round(opts.width * 96), height: Math.round(opts.height * 96) },
  });
  const page = await context.newPage();

  // build the slide URL list per arch.
  let slideUrls = []; // each: { url, label, hash? }
  const inputUrl = pathToFileURL(inputPath).href;

  if (arch === 'multi-file') {
    const manifest = await readManifest(page, inputUrl);
    const baseDir = path.dirname(inputPath);
    slideUrls = manifest.map((m, i) => ({
      url: pathToFileURL(path.resolve(baseDir, m.file)).href,
      label: m.label || `slide ${i + 1}`,
    }));
  } else {
    // single-file: load once, count slides, then drive via goTo.
    await page.goto(inputUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__deckStage, { timeout: 10000 });
    const total = await page.evaluate(() => window.__deckStage.totalSlides || 0);
    if (!total) throw new Error('deck-stage reports 0 slides');
    slideUrls = Array.from({ length: total }, (_, i) => ({
      url: inputUrl,
      label: `slide ${i + 1}`,
      slideIndex: i,
    }));
  }

  console.log(`exporting ${slideUrls.length} slides -> ${path.basename(outputPath)}`);

  const errors = [];
  for (let i = 0; i < slideUrls.length; i++) {
    const s = slideUrls[i];
    const tag = `[${i + 1}/${slideUrls.length}] ${s.label}`;
    try {
      // navigation strategy differs by arch.
      if (arch === 'multi-file') {
        await page.goto(s.url, { waitUntil: 'domcontentloaded' });
      } else if (i > 0) {
        // already on the deck-stage page; just goTo the next slide.
        await page.evaluate(idx => window.__deckStage.goTo(idx), s.slideIndex);
      } else {
        await page.evaluate(() => window.__deckStage.goTo(0));
      }

      // wait for slide to declare ready. fallback: small settle delay.
      try {
        await page.waitForFunction(() => window.__ready === true, { timeout: 4000 });
      } catch {
        log(`  ${tag}: __ready not set, continuing`);
        await page.waitForTimeout(300);
      }

      const pptxSlide = pptx.addSlide();

      if (opts.background) {
        const hex = await readBodyBackground(page);
        if (hex) pptxSlide.background = { color: hex };
      }

      try {
        await translateSlideToPptx(page, pptxSlide, {
          width: opts.width,
          height: opts.height,
          imageFallback: opts.imageFallback,
          verbose: opts.verbose,
        });
        console.log(`  ${tag} ok`);
      } catch (transErr) {
        // translator told us which element broke. surface it cleanly.
        console.error(`  ${tag} translator error: ${transErr.message}`);
        if (opts.imageFallback) {
          await imageFallbackSlide(page, pptxSlide, opts, log);
          console.log(`  ${tag} fell back to screenshot`);
        } else {
          errors.push({ slide: i + 1, label: s.label, error: transErr.message });
        }
      }

      // single-file: reset __ready for the next slide's detection.
      if (arch === 'single-file') {
        await page.evaluate(() => { window.__ready = false; });
      }
    } catch (navErr) {
      console.error(`  ${tag} nav error: ${navErr.message}`);
      errors.push({ slide: i + 1, label: s.label, error: navErr.message });
    }
  }

  await browser.close();

  if (errors.length === slideUrls.length) {
    console.error(`\nall ${errors.length} slides failed. not writing pptx.`);
    console.error('common cause: HTML violates the 4 hard constraints. see modes/producer/editable-pptx.md');
    process.exit(1);
  }

  await pptx.writeFile({ fileName: outputPath });

  // verify: file exists and has nonzero size. pptxgenjs has no post-write inspector.
  const stat = await fs.stat(outputPath);
  if (stat.size < 1024) throw new Error(`output suspiciously small: ${stat.size} bytes`);

  const ok = slideUrls.length - errors.length;
  console.log(`\nwrote ${outputPath}`);
  console.log(`  ${ok}/${slideUrls.length} slides translated, ${stat.size} bytes`);
  if (errors.length) {
    console.error(`  ${errors.length} slides failed:`);
    for (const e of errors) console.error(`    slide ${e.slide} (${e.label}): ${e.error}`);
    console.error('  fix HTML or rerun with --image-fallback');
    process.exit(2);
  }
}

main().catch(e => {
  console.error('fatal:', e.message);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});
