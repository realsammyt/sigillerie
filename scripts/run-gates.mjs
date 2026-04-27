#!/usr/bin/env node
// Runs G1-G4 gates on a path or directory. Phase 11 fills this out.
const arg = process.argv.find(a => a.startsWith('--gate='));
console.log('run-gates: stub', arg ?? '(no gate arg)');
process.exit(0);
