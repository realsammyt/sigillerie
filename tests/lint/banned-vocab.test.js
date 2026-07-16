// G1 lint: no em-dashes, no banned vocab in doc prose (code blocks exempt).
// content-guidelines.md and glossary.md define the rules, so they are exempt.
import { mdFiles, read, prose, report, ROOT } from '../lib.mjs';
import { relative } from 'node:path';

const EXEMPT = /content-guidelines\.md$|glossary\.md$/;
const VOCAB = /\b(delve\w*|leverag\w*|robust|comprehensive|seamless\w*|ensure[sd]?|ensuring|foster\w*|utiliz\w*)\b/gi;

const failures = [];
for (const file of [...mdFiles('modes', 'capabilities'), ROOT + 'SKILL.md', ROOT + 'README.md']) {
  if (EXEMPT.test(file)) continue;
  const rel = relative(ROOT, file);
  prose(read(file)).split(/\r?\n/).forEach((line, i) => {
    if (line.includes('—')) failures.push(`${rel}:${i + 1} em-dash`);
    for (const m of line.matchAll(VOCAB)) failures.push(`${rel}:${i + 1} banned word "${m[0]}"`);
  });
}
report('banned-vocab', failures);
