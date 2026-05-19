// integration.test.mjs -- end-to-end fixture tests for the jsx-export CLI.
// Runs the CLI against each fixture/input.html and asserts properties on the
// produced .tsx output. Uses property assertions rather than golden-file diffing
// so prettier / formatter tweaks do not destabilise the suite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const CLI = join(REPO_ROOT, 'scripts', 'jsx-export', 'index.mjs');

function runCli(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [CLI, ...args], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('exit', (code) => resolve({ code, stdout, stderr }));
    proc.on('error', reject);
  });
}

async function runFixture(fixtureName) {
  const input = join(__dirname, 'fixtures', fixtureName, 'input.html');
  const outDir = await mkdtemp(join(tmpdir(), `jsx-fixture-${fixtureName}-`));
  const componentName = fixtureName.split(/[-_]/).map(s => s[0].toUpperCase() + s.slice(1)).join('');
  const out = join(outDir, `${componentName}.tsx`);
  const result = await runCli([input, `--out=${out}`, `--name=${componentName}`]);
  const tsx = result.code === 0 ? await readFile(out, 'utf8') : '';
  const readme = result.code === 0 ? await readFile(join(outDir, 'EXPORT-README.md'), 'utf8') : '';
  return { result, tsx, readme, outDir, componentName };
}

// -----------------------------------------------------------------------
// Fixture A: static landing page (no React in source)
// -----------------------------------------------------------------------
test('fixture: landing — static HTML produces a renderable component', async () => {
  const { result, tsx, componentName, outDir } = await runFixture('landing');
  try {
    assert.equal(result.code, 0, `CLI failed: ${result.stderr}`);
    assert.ok(tsx.includes("'use client'"), 'must include use client directive');
    assert.ok(tsx.includes(`export function ${componentName}`), 'must export named function');
    assert.ok(tsx.includes('className='), 'class attribute must be renamed to className');
    assert.ok(!/\bclass=/.test(tsx), 'raw class= must not appear in JSX output');
    assert.ok(tsx.includes('hero'), 'hero className from source must survive');
    assert.ok(tsx.includes('cta'), 'cta className from source must survive');
    // Tailwind classes should be merged from the CSS transformer for static-HTML mode
    assert.ok(/flex|gap-|p-/.test(tsx), 'static-HTML mode should merge at least one Tailwind utility class');
    // No leva, no useControls
    assert.ok(!tsx.includes('useControls'), 'no useControls expected in static landing');
    assert.ok(!tsx.includes('createRoot'), 'createRoot must be stripped');
    // CSS custom properties should be present in the wrapper
    assert.ok(tsx.includes('--primary'), 'CSS custom property --primary must wrap with -- prefix');
    assert.ok(tsx.includes('--surface'), 'CSS custom property --surface must wrap with -- prefix');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------
// Fixture B: slide deck with leva-driven theme + density controls
// -----------------------------------------------------------------------
test('fixture: slide-deck — leva controls become typed props', async () => {
  const { result, tsx, componentName, outDir } = await runFixture('slide-deck');
  try {
    assert.equal(result.code, 0, `CLI failed: ${result.stderr}`);
    assert.ok(tsx.includes("'use client'"), 'must include use client directive');
    assert.ok(tsx.includes(`export function ${componentName}`), 'must export named function');
    // Leva controls promoted to props
    assert.ok(/interface\s+SlideDeckProps/.test(tsx), 'must declare typed props interface');
    assert.ok(tsx.includes('theme'), 'theme prop must appear');
    assert.ok(tsx.includes('density'), 'density prop must appear');
    // Options become string literal unions
    assert.ok(/['"]dark['"]/.test(tsx) && /['"]light['"]/.test(tsx) && /['"]brand['"]/.test(tsx), 'theme options must appear as literal union');
    assert.ok(/['"]minimal['"]/.test(tsx) && /['"]standard['"]/.test(tsx) && /['"]dense['"]/.test(tsx), 'density options must appear as literal union');
    // Defaults destructured (bare names, not props.x)
    assert.ok(/theme\s*=\s*['"]dark['"]/.test(tsx), 'theme default destructured as bare name');
    assert.ok(/density\s*=\s*['"]standard['"]/.test(tsx), 'density default destructured as bare name');
    // No props.theme / props.density
    assert.ok(!tsx.includes('props.theme'), 'must not use props.theme (destructured)');
    assert.ok(!tsx.includes('props.density'), 'must not use props.density (destructured)');
    // Leva import + useControls + createRoot stripped
    assert.ok(!tsx.includes('useControls'), 'useControls call must be stripped');
    assert.ok(!tsx.includes('from \'leva\''), 'leva import must be stripped');
    assert.ok(!tsx.includes('createRoot'), 'createRoot call and import must be stripped');
    // Page contract globals stripped
    assert.ok(!tsx.includes('window.__ready'), 'page contract globals must be stripped');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------
// Fixture C: iOS prototype with useState-driven screen transitions
// -----------------------------------------------------------------------
test('fixture: prototype — useState survives and onClick handlers preserved', async () => {
  const { result, tsx, componentName, outDir } = await runFixture('prototype');
  try {
    assert.equal(result.code, 0, `CLI failed: ${result.stderr}`);
    assert.ok(tsx.includes("'use client'"), 'must include use client directive');
    assert.ok(tsx.includes(`export function ${componentName}`), 'must export named function');
    // useState preserved
    assert.ok(tsx.includes('useState'), 'useState call must survive');
    assert.ok(/setScreen/.test(tsx), 'setScreen state setter must survive');
    // React import preserved (useState named import)
    assert.ok(tsx.includes("from 'react'"), 'react import must be present');
    // onClick handler preserved
    assert.ok(/onClick\s*=/.test(tsx), 'onClick prop must survive transformation');
    // Conditional JSX patterns preserved
    assert.ok(tsx.includes('Inbox') || tsx.includes('Profile'), 'screen content must survive');
    // createRoot stripped
    assert.ok(!tsx.includes('createRoot'), 'createRoot must be stripped');
    // Page contract globals stripped
    assert.ok(!tsx.includes('window.__ready'), 'page contract globals must be stripped');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------
// Cross-fixture: every export ships EXPORT-README
// -----------------------------------------------------------------------
test('every fixture export ships an EXPORT-README with install steps', async () => {
  for (const name of ['landing', 'slide-deck', 'prototype']) {
    const { result, readme, outDir } = await runFixture(name);
    try {
      assert.equal(result.code, 0, `CLI failed for ${name}: ${result.stderr}`);
      assert.ok(readme.includes('Tailwind v4'), `${name} README must mention Tailwind v4`);
      assert.ok(readme.includes('Installation steps'), `${name} README must include installation steps`);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }
});
