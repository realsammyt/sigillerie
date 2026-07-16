#!/usr/bin/env node
/**
 * export_deck_pdf.mjs, Sigillerie deck → PDF exporter
 *
 * Two architectures, one command:
 *   - multi-file: input HTML carries window.DECK_MANIFEST, each entry is its
 *     own slide HTML. Render each, merge with pdf-lib.
 *   - single-file: input HTML carries a <deck-stage> web component, the
 *     @media print rules in deck_stage.js render every <section> as its own
 *     page. One page.pdf() call covers the lot.
 *
 * No CDN. No build step. ESM only. Width/height in points, 1pt = 1px for
 * the 1920x1080 logical canvas Sigillerie ships against.
 *
 * Deps: playwright, pdf-lib (must be resolvable from the deck root).
 */

import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ── PARSE ─────────────────────────────────────────────────────────────

const HELP = `
Usage:
  node scripts/export_deck_pdf.mjs <input> [options]

Options:
  --output=<path>          default: <input>.pdf
  --width=<n>              PDF page width in pt (default 1920)
  --height=<n>             PDF page height in pt (default 1080)
  --landscape              default false: orientation follows the explicit
                           --width/--height (1920x1080 already prints wide).
                           Passing --landscape makes Chromium swap the
                           dimensions; almost never what you want here
  --background=true|false  print background colors/images (default true)
  --margin=<n>             page margin in pt (default 0)
  --verbose
  --help
`.trim();

function parseArgs(argv) {
  const args = {
    input: null,
    output: null,
    width: 1920,
    height: 1080,
    landscape: false,
    background: true,
    margin: 0,
    verbose: false,
    help: false,
  };
  const rest = argv.slice(2);
  for (const tok of rest) {
    if (tok === '--help' || tok === '-h') { args.help = true; continue; }
    if (tok === '--verbose') { args.verbose = true; continue; }
    if (tok === '--landscape') { args.landscape = true; continue; }
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      if (eq < 0) continue;
      const k = tok.slice(2, eq);
      const v = tok.slice(eq + 1);
      if (k === 'output') args.output = v;
      else if (k === 'width') args.width = parseInt(v, 10);
      else if (k === 'height') args.height = parseInt(v, 10);
      else if (k === 'margin') args.margin = parseInt(v, 10);
      else if (k === 'landscape') args.landscape = v !== 'false';
      else if (k === 'background') args.background = v !== 'false';
      else if (k === 'verbose') args.verbose = v !== 'false';
      continue;
    }
    if (!args.input) args.input = tok;
  }
  return args;
}

const args = parseArgs(process.argv);
if (args.help || !args.input) {
  console.log(HELP);
  process.exit(args.help ? 0 : 1);
}

const inputAbs = path.resolve(args.input);
const outputAbs = path.resolve(args.output || inputAbs.replace(/\.html?$/i, '') + '.pdf');
const inputUrl = pathToFileURL(inputAbs).href;

const log = (...m) => args.verbose && console.log('[export_deck_pdf]', ...m);
const info = (...m) => console.log(...m);

// pdf options shared across both modes
const pdfOpts = {
  width: `${args.width}px`,
  height: `${args.height}px`,
  printBackground: args.background,
  margin: { top: args.margin, right: args.margin, bottom: args.margin, left: args.margin },
  preferCSSPageSize: false,
  landscape: args.landscape,
};

// wait a bit for fonts/web components, then check __ready or fall back
async function waitReady(page, timeoutMs = 8000) {
  try {
    await page.waitForFunction(() => window.__ready === true, { timeout: timeoutMs });
  } catch {
    log('__ready never set, falling back to fonts.ready + 600ms');
    try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
    await page.waitForTimeout(600);
  }
}

// ── DETECT ────────────────────────────────────────────────────────────
// open input once, sniff which architecture we are dealing with

info(`→ Reading ${path.relative(process.cwd(), inputAbs)}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: args.width, height: args.height },
  deviceScaleFactor: 1,
});

let mode = null;
let manifest = null;
{
  const probe = await ctx.newPage();
  await probe.goto(inputUrl, { waitUntil: 'domcontentloaded' }).catch(() => probe.goto(inputUrl));
  // give late scripts a tick to register the manifest / define the element
  await probe.waitForTimeout(200);

  const detect = await probe.evaluate(() => {
    const hasStage = !!document.querySelector('deck-stage');
    const m = Array.isArray(window.DECK_MANIFEST) ? window.DECK_MANIFEST : null;
    return { hasStage, manifest: m };
  });

  if (detect.manifest && detect.manifest.length) {
    mode = 'multi';
    manifest = detect.manifest;
  } else if (detect.hasStage) {
    mode = 'single';
  }
  await probe.close();
}

if (!mode) {
  await browser.close();
  console.error(
    'Error: input is not a Sigillerie deck, expected `<deck-stage>` element ' +
    'or `window.DECK_MANIFEST` array.\n' +
    'Hint: open the file in a browser and check the console.'
  );
  process.exit(2);
}

log(`mode=${mode}`);
if (mode === 'multi') log(`manifest entries=${manifest.length}`);

// ── EXPORT ────────────────────────────────────────────────────────────

let outBytes;
let expectedPages;

if (mode === 'multi') {
  // resolve each manifest entry against the input HTML's directory
  const baseDir = path.dirname(inputAbs);
  const slidePaths = manifest.map((it) => {
    const rel = typeof it === 'string' ? it : (it && it.file);
    if (!rel) throw new Error('MANIFEST entry missing `file`: ' + JSON.stringify(it));
    return path.resolve(baseDir, rel);
  });
  expectedPages = slidePaths.length;
  info(`→ Multi-file mode, ${expectedPages} slides`);

  // render each slide to its own PDF buffer, then merge
  const buffers = [];
  let i = 0;
  for (const sp of slidePaths) {
    i += 1;
    const page = await ctx.newPage();
    const url = pathToFileURL(sp).href;
    await page.goto(url, { waitUntil: 'networkidle' }).catch(() => page.goto(url));
    await page.emulateMedia({ media: 'screen' });
    await waitReady(page);
    const buf = await page.pdf(pdfOpts);
    buffers.push(buf);
    await page.close();
    info(`  [${i}/${expectedPages}] ${path.basename(sp)}`);
  }

  // merge with pdf-lib
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }
  outBytes = await merged.save();
} else {
  // single-file: deck_stage.js print CSS already paginates one section per page
  info(`→ Single-file mode (deck-stage)`);
  const page = await ctx.newPage();
  // hint to the component before its scripts initialize, in case any deck
  // wires print-only behavior off this flag
  await page.addInitScript(() => { window.__forcePrintMode = true; });
  await page.goto(inputUrl, { waitUntil: 'networkidle' }).catch(() => page.goto(inputUrl));
  await waitReady(page);

  expectedPages = await page.evaluate(() => {
    const stage = document.querySelector('deck-stage');
    if (!stage) return 0;
    return stage.querySelectorAll(':scope > section, :scope > .deck-stage-frame > section').length;
  });
  if (!expectedPages) expectedPages = 1;
  info(`  detected ${expectedPages} <section> slides`);

  // emulate print so @media print rules fire (display sections block)
  await page.emulateMedia({ media: 'print' });
  outBytes = await page.pdf(pdfOpts);
  await page.close();
}

await browser.close();

// write output
await fs.mkdir(path.dirname(outputAbs), { recursive: true });
await fs.writeFile(outputAbs, outBytes);

// ── VERIFY ────────────────────────────────────────────────────────────

const verify = await PDFDocument.load(outBytes);
const actualPages = verify.getPageCount();
const kb = (outBytes.byteLength / 1024).toFixed(0);
info(`✓ Wrote ${path.relative(process.cwd(), outputAbs)} (${kb} KB, ${actualPages} pages)`);

if (mode === 'multi' && actualPages !== expectedPages) {
  console.error(
    `Warning: expected ${expectedPages} pages from MANIFEST, ` +
    `output has ${actualPages}. Check for slide load failures.`
  );
  process.exit(3);
}
if (mode === 'single' && expectedPages > 1 && actualPages < expectedPages) {
  console.error(
    `Warning: deck-stage has ${expectedPages} sections but PDF has ${actualPages} pages. ` +
    'Likely a CSS bug, sections need `display: block` (or flex) at @media print scope.'
  );
  process.exit(3);
}
