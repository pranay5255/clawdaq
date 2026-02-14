#!/usr/bin/env node
/**
 * Unit test runner (no DB / no network required).
 *
 * Why this exists:
 * - The project uses small, dependency-free node scripts for tests.
 * - `npm test` should run a useful set of checks by default.
 *
 * Run:
 *   node test/run-unit.js
 */

const path = require('path');
const { spawnSync } = require('child_process');

const files = [
  'api.test.js',
  'x402-compat.test.js',
  'x402-payment-config.test.js',
  'app-http.test.js'
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

