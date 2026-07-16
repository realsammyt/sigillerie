// G1 lint: every doc has parseable frontmatter with name + description.
// SKILL.md description must stay under the 1024-char agentskills.io cap.
import { mdFiles, read, frontmatter, report, ROOT } from '../lib.mjs';
import { relative } from 'node:path';

const failures = [];
for (const file of [...mdFiles('modes', 'capabilities'), ROOT + 'SKILL.md']) {
  const rel = relative(ROOT, file);
  const fm = frontmatter(read(file));
  if (!fm) { failures.push(`${rel}: no frontmatter`); continue; }
  if (!fm.name) failures.push(`${rel}: missing name`);
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(fm.name)) failures.push(`${rel}: bad name "${fm.name}"`);
  if (!fm.description) failures.push(`${rel}: missing description`);
}
const skill = frontmatter(read(ROOT + 'SKILL.md'));
if (skill?.description && skill.description.length > 1024)
  failures.push(`SKILL.md: description ${skill.description.length} chars (cap 1024)`);
report('frontmatter', failures);
