// Golden phase 1: the skill entry point is loadable and internally consistent.
// Frontmatter parses within spec, and every References-map path resolves.
import { read, frontmatter, exists, ROOT } from '../lib.mjs';

const failures = [];
const text = read(ROOT + 'SKILL.md');
const fm = frontmatter(text);
if (!fm) failures.push('SKILL.md: frontmatter does not parse');
else {
  if (fm.name !== 'sigillerie') failures.push(`SKILL.md: name "${fm.name}" != sigillerie`);
  if (!fm.description) failures.push('SKILL.md: no description');
  else if (fm.description.length > 1024) failures.push(`SKILL.md: description over 1024 chars (${fm.description.length})`);
}
for (const m of text.matchAll(/\|\s*`((?:modes|capabilities)\/[^`*]+?)`/g)) {
  if (!exists(m[1])) failures.push(`References map: dead path ${m[1]}`);
}
if (failures.length) {
  console.error(`golden:phase-1-skill-loads: FAIL (${failures.length})`);
  failures.forEach(f => console.error('  ' + f));
  process.exit(1);
}
console.log('golden:phase-1-skill-loads: PASS');
