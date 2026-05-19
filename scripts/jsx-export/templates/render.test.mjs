// render.test.mjs -- Tests for the component template renderer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderComponent } from './render.mjs';

const BASE = {
  componentName: 'MyCard',
  imports: [],
  propsInterface: [],
  cssVars: {},
  body: '',
  jsx: '<div>hello</div>',
  residualCSS: '',
};

// 1. No props -- empty destructure, empty interface, {} type.
test('no props: empty destructure and {} type annotation', async () => {
  const out = await renderComponent({ ...BASE });
  assert.ok(out.includes('export function MyCard('), `fn decl missing: ${out}`);
  // No props interface block when propsInterface is empty.
  assert.ok(!out.includes('interface MyCardProps'), `unexpected interface: ${out}`);
  // Type annotation should be {} when no props.
  assert.ok(out.includes(': {}'), `type annotation wrong: ${out}`);
});

// 2. Props with defaults -- interface and destructure both generated.
test('props with defaults: interface and destructure rendered', async () => {
  const out = await renderComponent({
    ...BASE,
    componentName: 'Button',
    propsInterface: [
      { name: 'primary', type: 'string', default: "'#D97757'" },
      { name: 'fontSize', type: 'number', default: '16' },
    ],
  });
  assert.ok(out.includes('interface ButtonProps {'), `interface missing: ${out}`);
  assert.ok(out.includes("primary = '#D97757'"), `default missing: ${out}`);
  assert.ok(out.includes('fontSize = 16'), `default missing: ${out}`);
  assert.ok(out.includes(': ButtonProps'), `type annotation wrong: ${out}`);
});

// 3. cssVars wrapping -- jsx is wrapped in a style div.
test('cssVars: jsx wrapped in div with CSS custom properties', async () => {
  const out = await renderComponent({
    ...BASE,
    cssVars: { '--primary': '#D97757', '--surface': '#F0EEE6' },
  });
  assert.ok(out.includes("'--primary': '#D97757'"), `cssVar missing: ${out}`);
  assert.ok(out.includes("'--surface': '#F0EEE6'"), `cssVar missing: ${out}`);
  assert.ok(out.includes('as React.CSSProperties'), `cast missing: ${out}`);
  // The original jsx must still be inside.
  assert.ok(out.includes('<div>hello</div>'), `jsx lost: ${out}`);
});

// 4. residualCSS -- style jsx block included.
test('residualCSS: style jsx block added', async () => {
  const out = await renderComponent({
    ...BASE,
    residualCSS: '.foo { color: red; }',
  });
  assert.ok(out.includes('<style jsx>'), `style jsx missing: ${out}`);
  assert.ok(out.includes('.foo { color: red; }'), `css missing: ${out}`);
});

// 5. Import grouping -- React first, then alphabetical.
test('imports: React first then alphabetical', async () => {
  const out = await renderComponent({
    ...BASE,
    imports: [
      { from: 'zustand', specifiers: [{ local: 'useStore', default: true }] },
      { from: 'react', specifiers: [{ local: 'useState' }, { local: 'useEffect' }] },
      { from: 'clsx', specifiers: [{ local: 'clsx', default: true }] },
    ],
  });
  const reactIdx = out.indexOf("from 'react'");
  const clsxIdx = out.indexOf("from 'clsx'");
  const zustandIdx = out.indexOf("from 'zustand'");
  assert.ok(reactIdx < clsxIdx, 'react must come before clsx');
  assert.ok(clsxIdx < zustandIdx, 'clsx must come before zustand');
});

// 6. No imports -- importsBlock is empty, no blank artifact lines.
test('no imports: no orphan blank lines from empty importsBlock', async () => {
  const out = await renderComponent({ ...BASE, imports: [] });
  // Should not have 3+ consecutive newlines.
  assert.ok(!/\n{3,}/.test(out), `excess blank lines: ${JSON.stringify(out)}`);
  assert.ok(!out.includes('import '), `unexpected import: ${out}`);
});

// 7. stateAndEffectsBlock -- body content is indented inside the function.
test('body: state and effects block indented inside function', async () => {
  const out = await renderComponent({
    ...BASE,
    body: "const [count, setCount] = useState(0);",
  });
  assert.ok(out.includes('const [count, setCount] = useState(0);'), `body missing: ${out}`);
});

// 8. Full-stack render -- all blocks present and in correct order.
test('full render: all blocks present and in correct relative order', async () => {
  const out = await renderComponent({
    componentName: 'Hero',
    imports: [
      { from: 'react', specifiers: [{ local: 'useState' }] },
    ],
    propsInterface: [{ name: 'title', type: 'string', default: "'Default Title'" }],
    cssVars: { '--brand': '#333' },
    body: 'const [open, setOpen] = useState(false);',
    jsx: '<h1>heading</h1>',
    residualCSS: 'h1 { margin: 0; }',
  });

  // 'use client' must be first.
  assert.ok(out.startsWith("'use client';"), `use client missing: ${out}`);

  const importIdx = out.indexOf("from 'react'");
  const interfaceIdx = out.indexOf('interface HeroProps');
  const fnIdx = out.indexOf('export function Hero(');
  const stateIdx = out.indexOf('useState(false)');
  const jsxIdx = out.indexOf('<h1>heading</h1>');
  const styleIdx = out.indexOf('<style jsx>');

  assert.ok(importIdx < interfaceIdx, 'import before interface');
  assert.ok(interfaceIdx < fnIdx, 'interface before function');
  assert.ok(fnIdx < stateIdx, 'fn decl before state');
  assert.ok(stateIdx < jsxIdx, 'state before jsx');
  assert.ok(jsxIdx < styleIdx, 'jsx before style');
});
