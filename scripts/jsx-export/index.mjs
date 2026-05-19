// index.mjs -- CLI orchestrator for sigillerie HTML -> React/Tailwind component export.
// Usage: node scripts/jsx-export <input.html> [options]
//
// Options:
//   --out=<path>           Output .tsx path (default: ./out/<Name>.tsx)
//   --name=<PascalCase>    Component name (default: derived from input filename)
//   --brand-spec=<path>    Path to brand-spec.md for Tailwind theme snippet
//   --shadcn               (v2) shadcn primitive rewrites. Logs and continues for v1.
//   --require-g4           (v2) Refuse input that has not passed critic G4. No-op in v1.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, basename, extname, join, resolve } from 'node:path';
import { load } from 'cheerio';
import prettier from 'prettier';
import { transformCSS } from './transformers/css.mjs';
import { transformJS } from './transformers/js.mjs';
import { transformMarkup } from './transformers/markup.mjs';
import { renderComponent } from './templates/render.mjs';
import { buildBrandSpecSnippet, buildExportReadme } from './brand-spec-mapper.mjs';

const ARG_RE = /^--([^=]+)(?:=(.*))?$/;

function parseArgs(argv) {
  const args = { _: [], shadcn: false, requireG4: false };
  for (const a of argv) {
    const m = a.match(ARG_RE);
    if (!m) { args._.push(a); continue; }
    const [, key, val] = m;
    if (key === 'shadcn') args.shadcn = true;
    else if (key === 'require-g4') args.requireG4 = true;
    else if (key === 'out') args.out = val;
    else if (key === 'name') args.name = val;
    else if (key === 'brand-spec') args.brandSpec = val;
    else throw new Error(`Unknown flag: --${key}`);
  }
  if (args._.length !== 1) {
    throw new Error('Usage: node scripts/jsx-export <input.html> [--out=...] [--name=...] [--brand-spec=...]');
  }
  return args;
}

function toPascalCase(s) {
  return s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join('') || 'Component';
}

function extractScriptsAndStyles(html) {
  const $ = load(html, { decodeEntities: false });

  const styleBlocks = [];
  $('style').each((_, el) => styleBlocks.push($(el).text()));

  const scriptBlocks = [];
  let importmap = {};

  $('script').each((_, el) => {
    const type = $(el).attr('type') || '';
    const text = $(el).text();
    if (!text.trim()) return;
    if (type === 'importmap') {
      try {
        const parsed = JSON.parse(text);
        importmap = parsed.imports || {};
      } catch (e) {
        console.warn(`Could not parse importmap: ${e.message}`);
      }
      return;
    }
    if (type === 'module' || type === 'text/babel' || type === '') {
      scriptBlocks.push(text);
    }
  });

  const bodyMarkup = $('body').html() || '';

  // The body markup will contain the original <script> and <style> tags too.
  // Strip them; they belong in their own pipeline lanes.
  const $body = load(`<div>${bodyMarkup}</div>`, { decodeEntities: false });
  $body('script, style').remove();
  const cleanBody = $body('div').first().html() || '';

  return { styleBlocks, scriptBlocks, importmap, bodyMarkup: cleanBody };
}

// Simple class-selector merge into a JSX string. Only handles `.foo` selectors
// for v1; complex selectors fall through silently and rely on residualCSS.
function mergeTailwindIntoReturnJsx(jsxString, selectorToClasses) {
  let out = jsxString;
  for (const [selector, classes] of Object.entries(selectorToClasses || {})) {
    if (!classes || classes.length === 0) continue;
    const m = selector.match(/^\.([\w-]+)$/);
    if (!m) continue;
    const klass = m[1];
    // Match className="...klass..." (string form) and merge.
    const re = new RegExp(`className=(["\\'])([^"\\']*\\b${klass}\\b[^"\\']*)\\1`, 'g');
    out = out.replace(re, (match, quote, existing) => {
      const have = new Set(existing.split(/\s+/).filter(Boolean));
      for (const c of classes) have.add(c);
      return `className=${quote}${[...have].join(' ')}${quote}`;
    });
  }
  return out;
}

async function format(src) {
  try {
    return await prettier.format(src, { parser: 'typescript', singleQuote: true, semi: true });
  } catch (e) {
    console.warn(`Prettier failed (${e.message}). Returning unformatted output.`);
    return src;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.shadcn) {
    console.warn('--shadcn flag is reserved for v2. Ignoring in v1.');
  }

  const inputPath = resolve(args._[0]);
  const html = await readFile(inputPath, 'utf8');

  const stem = basename(inputPath, extname(inputPath));
  const componentName = args.name || toPascalCase(stem);
  const outPath = resolve(args.out || join('out', `${componentName}.tsx`));
  const outDir = dirname(outPath);

  const { styleBlocks, scriptBlocks, importmap, bodyMarkup } = extractScriptsAndStyles(html);

  const cssIn = styleBlocks.join('\n\n');
  const jsIn = scriptBlocks.join('\n\n');

  const cssResult = await transformCSS(cssIn);
  const jsResult = await transformJS(jsIn, importmap);
  const markupResult = await transformMarkup(bodyMarkup, cssResult.selectorToClasses);

  if (jsResult.warnings.length) {
    console.warn('Transformer warnings:');
    for (const w of jsResult.warnings) console.warn(`  - ${w}`);
  }

  // React-driven mode: the script defined an App() that returns JSX.
  // Use that JSX as the component body and merge Tailwind classes by className
  // string substitution (a v1 simplification; v2 will do JSX-aware merging).
  // Static-HTML mode: use the markup transformer's JSX.
  const reactDriven = jsResult.returnJsx && jsResult.returnJsx.trim().length > 0;
  const jsxForRender = reactDriven
    ? mergeTailwindIntoReturnJsx(jsResult.returnJsx, cssResult.selectorToClasses)
    : markupResult.jsx;

  const tsxRaw = await renderComponent({
    componentName,
    imports: jsResult.imports,
    propsInterface: jsResult.propsInterface,
    cssVars: cssResult.cssVars,
    body: jsResult.body,
    jsx: jsxForRender,
    residualCSS: cssResult.residualCSS,
  });

  const tsx = await format(tsxRaw);

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, tsx, 'utf8');

  let themeSnippet = null;
  if (args.brandSpec) {
    const brandMd = await readFile(resolve(args.brandSpec), 'utf8');
    themeSnippet = buildBrandSpecSnippet(brandMd);
    await writeFile(join(outDir, 'tailwind.theme.snippet.ts'), themeSnippet, 'utf8');
  }

  const readme = buildExportReadme({
    componentName,
    componentFile: basename(outPath),
    hasThemeSnippet: !!themeSnippet,
    warnings: jsResult.warnings,
    cssVarsCount: Object.keys(cssResult.cssVars).length,
    residualCSSPresent: cssResult.residualCSS.trim().length > 0,
  });
  await writeFile(join(outDir, 'EXPORT-README.md'), readme, 'utf8');

  console.log(`Wrote ${outPath}`);
  if (themeSnippet) console.log(`Wrote ${join(outDir, 'tailwind.theme.snippet.ts')}`);
  console.log(`Wrote ${join(outDir, 'EXPORT-README.md')}`);
}

main().catch(e => {
  console.error(`jsx-export failed: ${e.message}`);
  process.exit(1);
});
