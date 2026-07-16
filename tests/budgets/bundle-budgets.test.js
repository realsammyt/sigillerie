// G3 budget: single-file HTML deliverables stay single-file sized.
// ponytail: flat 512KB cap (largest shipped demo is ~37KB); raise deliberately, not by drift.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from '../lib.mjs';

const CAP = 512 * 1024;
const failures = [];
const roots = readdirSync(ROOT).filter(d => /^demos/.test(d));
roots.push(join('launch', 'posts'));
for (const dir of roots) {
  for (const e of readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })) {
    if (!e.isFile() || e.name !== 'index.html') continue;
    const p = join(e.parentPath ?? e.path, e.name);
    const size = statSync(p).size;
    if (size > CAP) failures.push(`${relative(ROOT, p)}: ${(size / 1024).toFixed(0)}KB > 512KB`);
  }
}
if (failures.length) {
  console.error(`budget:bundle-budgets: FAIL (${failures.length})`);
  failures.forEach(f => console.error('  ' + f));
  process.exit(1);
}
console.log('budget:bundle-budgets: PASS');
