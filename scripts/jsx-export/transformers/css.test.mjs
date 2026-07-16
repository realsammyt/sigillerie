import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformCSS } from './css.mjs';

test('direct lookup hit - display flex', async () => {
  const result = await transformCSS('.box { display: flex; }');
  assert.deepEqual(result.selectorToClasses['.box'], ['flex']);
  assert.equal(result.residualCSS, '');
});

test('direct lookup hit - margin and padding', async () => {
  const result = await transformCSS('.card { margin: 16px; padding: 8px; }');
  assert.deepEqual(result.selectorToClasses['.card'], ['m-4', 'p-2']);
});

test('shorthand expansion - margin two-value', async () => {
  // margin: 8px 16px => margin-top/bottom: 8px (mt-2/mb-2), margin-left/right: 16px (mr-4/ml-4)
  const result = await transformCSS('.el { margin: 8px 16px; }');
  const classes = result.selectorToClasses['.el'];
  assert.ok(classes.includes('mt-2'), 'should include mt-2');
  assert.ok(classes.includes('mb-2'), 'should include mb-2');
  assert.ok(classes.includes('mr-4'), 'should include mr-4');
  assert.ok(classes.includes('ml-4'), 'should include ml-4');
});

test('arbitrary-value fallback - custom px', async () => {
  // margin: 13px expands to four longhands, each getting arbitrary-value classes
  const result = await transformCSS('.el { margin: 13px; gap: 7rem; }');
  const classes = result.selectorToClasses['.el'];
  assert.ok(classes.includes('mt-[13px]'), `expected mt-[13px], got: ${JSON.stringify(classes)}`);
  assert.ok(classes.includes('mb-[13px]'), `expected mb-[13px], got: ${JSON.stringify(classes)}`);
  // gap is not a shorthand, goes directly to arbitrary
  assert.ok(classes.includes('gap-[7rem]'), `expected gap-[7rem], got: ${JSON.stringify(classes)}`);
});

test('OKLCH color to arbitrary bg class', async () => {
  const result = await transformCSS('.hero { background: oklch(0.65 0.18 25); }');
  const classes = result.selectorToClasses['.hero'];
  // Spaces in oklch become underscores
  assert.ok(
    classes.includes('bg-[oklch(0.65_0.18_25)]'),
    `expected bg-[oklch(0.65_0.18_25)], got: ${JSON.stringify(classes)}`
  );
});

test('CSS variable shorthand in color uses Tailwind v4 paren syntax', async () => {
  const result = await transformCSS('.btn { color: var(--primary); }');
  const classes = result.selectorToClasses['.btn'];
  assert.ok(
    classes.includes('text-(--primary)'),
    `expected text-(--primary), got: ${JSON.stringify(classes)}`
  );
});

test(':hover selector produces hover: prefix', async () => {
  const result = await transformCSS('.link:hover { color: white; }');
  const classes = result.selectorToClasses['.link'];
  assert.ok(
    classes.includes('hover:text-white'),
    `expected hover:text-white, got: ${JSON.stringify(classes)}`
  );
});

test('@media md breakpoint prefixes classes', async () => {
  const result = await transformCSS('@media (min-width: 768px) { .panel { display: flex; } }');
  const classes = result.selectorToClasses['.panel'];
  assert.ok(
    classes.includes('md:flex'),
    `expected md:flex, got: ${JSON.stringify(classes)}`
  );
  assert.equal(result.residualCSS, '');
});

test('@keyframes goes into residualCSS', async () => {
  const css = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  const result = await transformCSS(css);
  assert.ok(result.residualCSS.includes('@keyframes spin'), 'keyframes should be in residualCSS');
  assert.deepEqual(result.selectorToClasses, {});
});

test(':root CSS variables extracted to cssVars', async () => {
  const result = await transformCSS(':root { --primary: #3b82f6; --spacing-md: 16px; }');
  assert.equal(result.cssVars['primary'], '#3b82f6');
  assert.equal(result.cssVars['spacing-md'], '16px');
});

test('unknown @media goes to residualCSS', async () => {
  const result = await transformCSS('@media (prefers-color-scheme: dark) { .el { color: white; } }');
  assert.ok(result.residualCSS.includes('prefers-color-scheme'), 'unknown media should be in residualCSS');
});

test('complex selector goes to residualCSS', async () => {
  const result = await transformCSS('.parent .child { padding: 8px; }');
  // Descendant combinator selector - too complex for class mapping
  assert.ok(result.residualCSS.includes('.parent .child'), 'complex selector should be in residualCSS');
  assert.equal(result.selectorToClasses['.parent .child'], undefined);
});

test('residual decls inside a matched @media keep the media wrapper', async () => {
  const result = await transformCSS(
    '@media (min-width: 768px) { .panel { display: flex; clip-path: circle(50%); } }'
  );
  assert.ok(result.selectorToClasses['.panel'].includes('md:flex'), 'mappable decl still becomes md:flex');
  assert.ok(
    /@media \(min-width: 768px\)\s*\{[\s\S]*clip-path/.test(result.residualCSS),
    `residual decl must stay inside the @media wrapper, got: ${result.residualCSS}`
  );
});

test('@supports/@container inner rules are not promoted to unconditional classes', async () => {
  const css = `
    @supports (display: grid) { .a { display: flex; } }
    @container (min-width: 400px) { .b { display: flex; } }
  `;
  const result = await transformCSS(css);
  assert.equal(result.selectorToClasses['.a'], undefined, '@supports inner rule must not be promoted');
  assert.equal(result.selectorToClasses['.b'], undefined, '@container inner rule must not be promoted');
  assert.ok(result.residualCSS.includes('@supports (display: grid)'), '@supports goes to residual verbatim');
  assert.ok(result.residualCSS.includes('@container (min-width: 400px)'), '@container goes to residual verbatim');
});

test('calc()/clamp() values are not shredded by shorthand expansion', async () => {
  const result = await transformCSS('.el { margin: calc(100% - 20px); }');
  const classes = result.selectorToClasses['.el'] || [];
  assert.ok(
    classes.includes('m-[calc(100%_-_20px)]'),
    `expected m-[calc(100%_-_20px)], got: ${JSON.stringify(classes)}`
  );
  assert.ok(!classes.some(c => /^(mt|mr|mb|ml)-\[(calc|100%|-|20px)\]?/.test(c)), 'no shredded longhand fragments');
});

test('::placeholder maps to placeholder: variant with a clean base selector', async () => {
  const result = await transformCSS('.input::placeholder { color: white; }');
  const classes = result.selectorToClasses['.input'] || [];
  assert.ok(
    classes.includes('placeholder:text-white'),
    `expected placeholder:text-white on ".input", got: ${JSON.stringify(result.selectorToClasses)}`
  );
  assert.equal(result.selectorToClasses['.input:'], undefined, 'no trailing-colon base selector');
});

test('unhandled pseudo-element selectors go to residualCSS, not promoted', async () => {
  const result = await transformCSS('.x::selection { color: white; }');
  assert.equal(result.selectorToClasses['.x::selection'], undefined);
  assert.ok(result.residualCSS.includes('::selection'), '::selection rule should be in residualCSS');
});
