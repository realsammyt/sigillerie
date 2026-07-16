// G3 static slice: every recordable HTML deliverable carries the page contract,
// either declaring window.__ready inline or loading a shared Stage engine that sets it.
// Runtime enforcement is scripts/verify.py; this catches a missing contract before that.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from '../lib.mjs';

const ENGINES = /assets\/(stage3d\.jsx|animations\.jsx|deck_stage\.js)/;
const failures = [];
const roots = readdirSync(ROOT).filter(d => /^demos/.test(d));
roots.push(join('launch', 'posts'));
for (const dir of roots) {
  for (const e of readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })) {
    if (!e.isFile() || e.name !== 'index.html') continue;
    const p = join(e.parentPath ?? e.path, e.name);
    const html = readFileSync(p, 'utf-8');
    if (!html.includes('__ready') && !ENGINES.test(html))
      failures.push(`${relative(ROOT, p)}: no window.__ready and no Stage engine include`);
  }
}
if (failures.length) {
  console.error(`budget:page-contract: FAIL (${failures.length})`);
  failures.forEach(f => console.error('  ' + f));
  process.exit(1);
}
console.log('budget:page-contract: PASS');
