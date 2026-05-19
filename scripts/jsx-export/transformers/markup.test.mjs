// markup.test.mjs -- Tests for the HTML-to-JSX markup transformer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformMarkup } from './markup.mjs';

// Helper: extract text from the jsx result.
async function jsx(html, map = {}) {
  const { jsx } = await transformMarkup(html, map);
  return jsx;
}

// 1. class -> className rename
test('renames class to className', async () => {
  const out = await jsx('<div class="foo bar">text</div>');
  assert.ok(out.includes('className="foo bar"'), `got: ${out}`);
  assert.ok(!out.includes(' class='), `got: ${out}`);
});

// 2. for -> htmlFor rename
test('renames for to htmlFor', async () => {
  const out = await jsx('<label for="email">Email</label>');
  assert.ok(out.includes('htmlFor="email"'), `got: ${out}`);
});

// 3. tabindex -> tabIndex rename
test('renames tabindex to tabIndex', async () => {
  const out = await jsx('<input tabindex="0" />');
  assert.ok(out.includes('tabIndex="0"'), `got: ${out}`);
});

// 4. readonly -> readOnly rename
test('renames readonly to readOnly', async () => {
  const out = await jsx('<input readonly />');
  assert.ok(out.includes('readOnly'), `got: ${out}`);
});

// 5. maxlength / colspan / rowspan
test('renames maxlength, colspan, rowspan', async () => {
  const out1 = await jsx('<input maxlength="10" />');
  assert.ok(out1.includes('maxLength="10"'), `got: ${out1}`);

  const out2 = await jsx('<td colspan="2">x</td>');
  assert.ok(out2.includes('colSpan="2"'), `got: ${out2}`);

  const out3 = await jsx('<td rowspan="3">x</td>');
  assert.ok(out3.includes('rowSpan="3"'), `got: ${out3}`);
});

// 6. aria-* and data-* pass through unchanged
test('aria-* and data-* pass through unchanged', async () => {
  const out = await jsx('<button aria-label="close" data-id="42">x</button>');
  assert.ok(out.includes('aria-label="close"'), `got: ${out}`);
  assert.ok(out.includes('data-id="42"'), `got: ${out}`);
});

// 7. style string -> JSX style object
test('converts inline style string to JSX style object', async () => {
  const out = await jsx('<div style="color: red; flex: 1;">x</div>');
  assert.ok(out.includes("color: 'red'"), `got: ${out}`);
  assert.ok(out.includes('flex: 1'), `got: ${out}`);
  // Must be double-brace JSX object syntax.
  assert.ok(out.includes('style={{'), `got: ${out}`);
});

// 8. style with kebab-case property -> camelCase
test('camelCases CSS property names in style object', async () => {
  const out = await jsx('<div style="background-color: #fff; font-size: 14px;">x</div>');
  assert.ok(out.includes('backgroundColor:'), `got: ${out}`);
  assert.ok(out.includes('fontSize:'), `got: ${out}`);
});

// 9. onclick -> onClick event handler wrapping
test('rewrites onclick to onClick with arrow function wrapper', async () => {
  const out = await jsx('<button onclick="doThing()">click</button>');
  assert.ok(out.includes('onClick='), `got: ${out}`);
  assert.ok(out.includes('doThing()'), `got: ${out}`);
  assert.ok(!out.includes('onclick='), `got: ${out}`);
});

// 10. onsubmit -> onSubmit
test('rewrites onsubmit to onSubmit', async () => {
  const out = await jsx('<form onsubmit="handleSubmit(event)">x</form>');
  assert.ok(out.includes('onSubmit='), `got: ${out}`);
  assert.ok(!out.includes('onsubmit='), `got: ${out}`);
});

// 11. void element self-closing
test('self-closes void elements', async () => {
  const html = '<div><img src="a.png"><br><hr><input type="text"><meta charset="utf-8"></div>';
  const out = await jsx(html);
  assert.ok(out.includes('<img ') && out.includes('/>'), `img: ${out}`);
  assert.ok(out.includes('<br />'), `br: ${out}`);
  assert.ok(out.includes('<hr />'), `hr: ${out}`);
  assert.ok(out.includes('<input ') && out.includes('/>'), `input: ${out}`);
});

// 12. brace escaping in text nodes
test('escapes literal { and } in text nodes', async () => {
  const out = await jsx('<p>Hello {world} and {again}</p>');
  assert.ok(out.includes("{'{'}"), `got: ${out}`);
  assert.ok(out.includes("{'}'}"), `got: ${out}`);
  assert.ok(!out.match(/>\s*\{world\}/), `raw braces leaked: ${out}`);
});

// 13. class merge from selectorToClasses -- adds to existing className
test('merges Tailwind classes onto existing className via class selector', async () => {
  const html = '<div class="base">x</div>';
  const map = { '.base': ['text-lg', 'font-bold'] };
  const out = await jsx(html, map);
  assert.ok(out.includes('base'), `original class missing: ${out}`);
  assert.ok(out.includes('text-lg'), `tailwind class missing: ${out}`);
  assert.ok(out.includes('font-bold'), `tailwind class missing: ${out}`);
});

// 14. id selector match from selectorToClasses
test('merges classes via id selector', async () => {
  const html = '<div id="hero">x</div>';
  const map = { '#hero': ['bg-blue-500', 'p-4'] };
  const out = await jsx(html, map);
  assert.ok(out.includes('bg-blue-500'), `got: ${out}`);
  assert.ok(out.includes('p-4'), `got: ${out}`);
});
