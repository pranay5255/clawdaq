#!/usr/bin/env node
/**
 * Full test runner (includes DB-backed activation flow tests).
 *
 * Run:
 *   node test/run-all.js
 */

const path = require('path');
const { spawnSync } = require('child_process');

const files = [
  'run-unit.js',
  'activation.test.js'
];

function runFile(file) {
  const fullPath = path.join(__dirname, file);
  console.log(`\n=== Running ${file} ===\n`);
  const result = spawnSync(process.execPath, [fullPath], {
    stdio: 'inherit',
    env: process.env
  });
  return typeof result.status === 'number' ? result.status : 1;
}

let exitCode = 0;
for (const file of files) {
  const status = runFile(file);
  if (status !== 0) {
    exitCode = status;
    break;
  }
}

process.exit(exitCode);

