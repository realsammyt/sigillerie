#!/usr/bin/env node
// Runs every gate under tests/ (lint, budgets, golden). Fails if any test fails.
// Tests that print "SKIP" are counted as skipped, not passed.
import { readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const tests = [];
for (const e of readdirSync(join(ROOT, 'tests'), { recursive: true, withFileTypes: true })) {
  if (e.isFile() && e.name.endsWith('.test.js')) tests.push(join(e.parentPath ?? e.path, e.name));
}
tests.sort();

let passed = 0, failed = 0, skipped = 0;
for (const t of tests) {
  const r = spawnSync(process.execPath, [t], { encoding: 'utf-8' });
  const out = (r.stdout + r.stderr).trim();
  const rel = relative(ROOT, t);
  if (r.status !== 0) { failed++; console.error(`FAIL ${rel}\n${out.replace(/^/gm, '  ')}`); }
  else if (out.includes('SKIP')) { skipped++; console.log(`SKIP ${rel}`); }
  else { passed++; console.log(`PASS ${rel}`); }
}
console.log(`\n${passed} passed, ${skipped} skipped, ${failed} failed (${tests.length} total)`);
process.exit(failed ? 1 : 0);
