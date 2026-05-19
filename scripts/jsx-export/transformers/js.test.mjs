// js.test.mjs -- Node test runner tests for the JS/Babel transformer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformJS } from './js.mjs';

// ---------------------------------------------------------------------------
// 1. Empty input
// ---------------------------------------------------------------------------
test('empty input returns empty result', async () => {
  const result = await transformJS('', {});
  assert.deepEqual(result.imports, []);
  assert.equal(result.body, '');
  assert.deepEqual(result.propsInterface, []);
  assert.deepEqual(result.warnings, []);
});

// ---------------------------------------------------------------------------
// 2. esm.sh import rewrite -- react
// ---------------------------------------------------------------------------
test('rewrites esm.sh react URL to bare "react"', async () => {
  const js = `import React from 'https://esm.sh/react@18';`;
  const result = await transformJS(js, {});
  assert.equal(result.imports.length, 1);
  assert.equal(result.imports[0].from, 'react');
  assert.equal(result.imports[0].specifiers[0].local, 'React');
  assert.equal(result.imports[0].specifiers[0].default, true);
});

// ---------------------------------------------------------------------------
// 3. esm.sh import rewrite -- leva with ?deps= query string
// ---------------------------------------------------------------------------
test('leva import is stripped and not included in imports', async () => {
  const js = `
import { useControls } from 'https://esm.sh/leva@0.9?deps=react@18';
function App() {
  const { x } = useControls({ x: { value: 1 } });
  return <div>{x}</div>;
}
`;
  const result = await transformJS(js, {});
  const levaImport = result.imports.find((i) => i.from === 'leva');
  assert.equal(levaImport, undefined, 'leva import should be stripped');
});

// ---------------------------------------------------------------------------
// 4. importmap-based rewrite
// ---------------------------------------------------------------------------
test('rewrites via importmap entry', async () => {
  const js = `import { useState } from 'react';`;
  const importmap = { react: 'https://esm.sh/react@18' };
  const result = await transformJS(js, importmap);
  assert.equal(result.imports.length, 1);
  assert.equal(result.imports[0].from, 'react');
});

// ---------------------------------------------------------------------------
// 5. Bare specifier kept as-is
// ---------------------------------------------------------------------------
test('keeps bare specifiers unchanged', async () => {
  const js = `import { motion } from 'framer-motion';`;
  const result = await transformJS(js, {});
  assert.equal(result.imports.length, 1);
  assert.equal(result.imports[0].from, 'framer-motion');
});

// ---------------------------------------------------------------------------
// 6. Page-contract globals are stripped
// ---------------------------------------------------------------------------
test('strips all page-contract window globals', async () => {
  const js = `
import React from 'react';
window.__ready = true;
window.__recording = false;
window.__sceneReady = () => {};
window.__renderFrame = (t) => {};
window.__duration = 5;
window.__audioCues = [];
window.__audioRuntime = null;
window.__capabilities = {};
window.__customGlobal = 'hi';
function App() { return <div />; }
`;
  const result = await transformJS(js, {});
  // None of the window.__ assignments should appear in the body.
  assert.ok(!result.body.includes('window.__'), `body should not contain window.__ globals, got: ${result.body}`);
});

// ---------------------------------------------------------------------------
// 7. createRoot().render() is stripped
// ---------------------------------------------------------------------------
test('strips createRoot render call', async () => {
  const js = `
import React from 'react';
import { createRoot } from 'react-dom/client';
function App() { return <div>Hello</div>; }
createRoot(document.getElementById('root')).render(<App />);
`;
  const result = await transformJS(js, {});
  assert.ok(!result.body.includes('createRoot'), `createRoot should be stripped, got: ${result.body}`);
});

// ---------------------------------------------------------------------------
// 8. useControls -- boolean, number, color extraction
// ---------------------------------------------------------------------------
test('extracts useControls props with boolean, number, and color types', async () => {
  const js = `
import { useControls } from 'leva';
function App() {
  const { visible, size, primary } = useControls({
    visible: { value: true },
    size: { value: 42, min: 10, max: 100 },
    primary: { value: '#D97757' }
  });
  return <div style={{ color: primary }}>{size}</div>;
}
`;
  const result = await transformJS(js, {});
  const byName = (name) => result.propsInterface.find((p) => p.name === name);

  const visibleProp = byName('visible');
  assert.ok(visibleProp, 'visible prop should exist');
  assert.equal(visibleProp.type, 'boolean');
  assert.equal(visibleProp.default, 'true');

  const sizeProp = byName('size');
  assert.ok(sizeProp, 'size prop should exist');
  assert.equal(sizeProp.type, 'number');
  assert.equal(sizeProp.default, '42');

  const primaryProp = byName('primary');
  assert.ok(primaryProp, 'primary prop should exist');
  assert.ok(primaryProp.type.includes('string'), 'primary should be string type');
  assert.ok(primaryProp.type.includes('color'), 'primary should note color in type');
  // default is now JS-literal-quoted so it inlines correctly in destructure
  assert.equal(primaryProp.default, '"#D97757"');
});

// ---------------------------------------------------------------------------
// 9. useControls -- options array becomes string literal union
// ---------------------------------------------------------------------------
test('extracts useControls options array as string literal union', async () => {
  const js = `
import { useControls } from 'leva';
function App() {
  const { density } = useControls({
    density: { value: 'compact', options: ['compact', 'comfortable', 'spacious'] }
  });
  return <div>{density}</div>;
}
`;
  const result = await transformJS(js, {});
  const densityProp = result.propsInterface.find((p) => p.name === 'density');
  assert.ok(densityProp, 'density prop should exist');
  assert.ok(densityProp.type.includes("'compact'"), `type should include 'compact', got: ${densityProp.type}`);
  assert.ok(densityProp.type.includes("'comfortable'"), `type should include 'comfortable'`);
  assert.ok(densityProp.type.includes("'spacious'"), `type should include 'spacious'`);
});

// ---------------------------------------------------------------------------
// 10. useControls -- bare-name preservation (renderer destructures, no props.x)
// ---------------------------------------------------------------------------
test('preserves bare controlled-prop names in body and returnJsx', async () => {
  const js = `
import { useControls } from 'leva';
function App() {
  const { fontSize } = useControls({ fontSize: { value: 16 } });
  const doubled = fontSize * 2;
  return <div style={{ fontSize }}>{fontSize}</div>;
}
`;
  const result = await transformJS(js, {});
  // useControls call stripped from body
  assert.ok(!result.body.includes('useControls'), `useControls should be stripped, got: ${result.body}`);
  // Bare name preserved in pre-return body (not rewritten to props.fontSize)
  assert.ok(result.body.includes('fontSize'), `body should contain fontSize, got: ${result.body}`);
  assert.ok(!result.body.includes('props.fontSize'), `body should NOT contain props.fontSize, got: ${result.body}`);
  // Bare name preserved in returnJsx
  assert.ok(result.returnJsx.includes('fontSize'), `returnJsx should contain fontSize, got: ${result.returnJsx}`);
  assert.ok(!result.returnJsx.includes('props.fontSize'), `returnJsx should NOT contain props.fontSize, got: ${result.returnJsx}`);
});

// ---------------------------------------------------------------------------
// 11. THREE warning
// ---------------------------------------------------------------------------
test('warns on new THREE.* usage', async () => {
  const js = `
import React from 'react';
const geo = new THREE.BoxGeometry(1, 1, 1);
function App() { return <div />; }
`;
  const result = await transformJS(js, {});
  assert.ok(
    result.warnings.some((w) => w.includes('three.js')),
    `expected three.js warning, got: ${JSON.stringify(result.warnings)}`
  );
});

// ---------------------------------------------------------------------------
// 12. Tone.js warning
// ---------------------------------------------------------------------------
test('warns on new Tone.* usage', async () => {
  const js = `
import React from 'react';
const synth = new Tone.Synth();
function App() { return <div />; }
`;
  const result = await transformJS(js, {});
  assert.ok(
    result.warnings.some((w) => w.includes('Tone.js')),
    `expected Tone.js warning, got: ${JSON.stringify(result.warnings)}`
  );
});

// ---------------------------------------------------------------------------
// 13. canvas warning via document.createElement
// ---------------------------------------------------------------------------
test('warns on document.createElement("canvas")', async () => {
  const js = `
import React from 'react';
const canvas = document.createElement('canvas');
function App() { return <div />; }
`;
  const result = await transformJS(js, {});
  assert.ok(
    result.warnings.some((w) => w.includes('canvas')),
    `expected canvas warning, got: ${JSON.stringify(result.warnings)}`
  );
});

// ---------------------------------------------------------------------------
// 14. @react-three/fiber import triggers 3D warning
// ---------------------------------------------------------------------------
test('warns on @react-three/fiber import', async () => {
  const js = `import { Canvas } from '@react-three/fiber';
function App() { return <Canvas />; }
`;
  const result = await transformJS(js, {});
  assert.ok(
    result.warnings.some((w) => w.includes('three.js')),
    `expected three.js warning for @react-three/fiber, got: ${JSON.stringify(result.warnings)}`
  );
});
