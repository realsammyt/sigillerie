// G1 lint: every backticked in-repo file path in the docs resolves on disk.
// Glob patterns, <placeholders>, and annotated planned-not-shipped scripts are exempt.
import { mdFiles, read, report, exists, ROOT } from '../lib.mjs';
import { relative } from 'node:path';

const PLANNED = new Set(['scripts/webxr-bundle.js', 'scripts/seed-audio-library.mjs']);
const REF = /`((?:modes|capabilities|assets|scripts|demos[\w-]*|launch|tests)\/[^`\s]+?\.(?:md|js|mjs|jsx|py|sh|html|json|css|tmpl))`/g;

const failures = [];
for (const file of [...mdFiles('modes', 'capabilities'), ROOT + 'SKILL.md', ROOT + 'README.md']) {
  const rel = relative(ROOT, file);
  for (const m of read(file).matchAll(REF)) {
    const ref = m[1];
    if (/[<>*{]/.test(ref) || PLANNED.has(ref)) continue;
    if (!exists(ref)) failures.push(`${rel}: dead reference ${ref}`);
  }
}
report('markdown', failures);
