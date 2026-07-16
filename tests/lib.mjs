// Shared helpers for the gate tests. Node stdlib only.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

export function mdFiles(...dirs) {
  const out = [];
  for (const d of dirs) {
    for (const e of readdirSync(join(ROOT, d), { recursive: true, withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.md')) out.push(join(e.parentPath ?? e.path, e.name));
    }
  }
  return out;
}

export function read(p) { return readFileSync(p, 'utf-8'); }

// Strip fenced code blocks and inline code so lint rules only see prose.
export function prose(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

export function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2];
  }
  return fm;
}

export function report(name, failures) {
  if (failures.length === 0) { console.log(`lint:${name}: PASS`); process.exit(0); }
  console.error(`lint:${name}: FAIL (${failures.length})`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}

export function exists(p) { try { statSync(join(ROOT, p)); return true; } catch { return false; } }
