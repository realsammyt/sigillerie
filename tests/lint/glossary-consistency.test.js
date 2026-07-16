// G1 lint: locked glossary terms. Wrong forms banned outside glossary.md itself.
// ponytail: hardcoded from glossary.md's Notes column; extend when glossary locks more.
import { mdFiles, read, prose, report, ROOT } from '../lib.mjs';
import { relative } from 'node:path';

const WRONG = [
  [/\bDataViz\b/g, 'DataViz (use "Data Viz" or "Data Visualization")'],
  [/\banti-slop\b/g, 'anti-slop (use "anti-AI-slop")'],
];

const failures = [];
for (const file of [...mdFiles('modes', 'capabilities'), ROOT + 'SKILL.md', ROOT + 'README.md']) {
  if (/glossary\.md$/.test(file)) continue;
  const rel = relative(ROOT, file);
  const text = prose(read(file));
  for (const [re, msg] of WRONG) if (re.test(text)) failures.push(`${rel}: ${msg}`);
}
report('glossary-consistency', failures);
