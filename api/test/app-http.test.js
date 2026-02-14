/**
 * API HTTP Contract Smoke Tests (No DB Required)
 *
 * These tests exercise a few endpoints through the real Express app to make
 * error handling, rate limiting, and key route behavior easy to understand.
 *
 * Run:
 *   node test/app-http.test.js
 *
 * Optional:
 *   TEST_VERBOSE=1 node test/app-http.test.js
 */

const app = require('../src/app');

// Test framework (small + dependency-free)
let passed = 0;
let failed = 0;
const tests = [];

const VERBOSE = process.env.TEST_VERBOSE === '1' || process.env.TEST_VERBOSE === 'true';

function describe(name, fn) {
  tests.push({ type: 'describe', name });
  fn();
}

function test(name, fn) {
  tests.push({ type: 'test', name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertDefined(value, message) {
  if (value === undefined || value === null || value === '') {
    throw new Error(message || 'Expected value to be defined');
  }
}

function randomName(prefix = 'http_test') {
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const raw = `${prefix}_${suffix}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return raw.length <= 32 ? raw : raw.slice(0, 32);
}

async function http(baseUrl, method, route, { headers, body, rawBody } = {}) {
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body || rawBody ? { 'Content-Type': 'application/json' } : null),
      ...(headers || {})
    },
    body: body ? JSON.stringify(body) : rawBody
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: res.status,
    headers: res.headers,
    body: json,
    text
  };
}

async function runTests() {
  console.log('\nAPI HTTP Contract Smoke Tests\n');
  console.log('='.repeat(60));

  for (const item of tests) {
    if (item.type === 'describe') {
      console.log(`\n[${item.name}]\n`);
      continue;
    }

    try {
      await item.fn();
      console.log(`  + ${item.name}`);
      passed++;
    } catch (error) {
      console.log(`  - ${item.name}`);
      console.log(`    Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

// ==================== Tests ====================

let server = null;
let baseUrl = null;

describe('Server Setup', () => {
  test('starts the API app on a random local port', async () => {
    server = await new Promise((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
    console.log(`    api server: ${baseUrl}`);
    assertDefined(baseUrl);
  });
});

describe('Root + Health', () => {
  test('GET / returns basic service metadata', async () => {
    const res = await http(baseUrl, 'GET', '/');
    if (VERBOSE) console.log('    body:', res.body);

    assertEqual(res.status, 200);
    assertEqual(res.body?.name, 'ClawDAQ API');
    assertDefined(res.body?.version);
  });

  test('GET /api/v1/health returns healthy and includes rate limit headers', async () => {
    const res = await http(baseUrl, 'GET', '/api/v1/health');
    if (VERBOSE) console.log('    body:', res.body);

    assertEqual(res.status, 200);
    assertEqual(res.body?.success, true);
    assertEqual(res.body?.status, 'healthy');
    assertDefined(res.body?.timestamp);

    // Rate limiter runs on all /api/v1 routes.
    assertDefined(res.headers.get('x-ratelimit-limit'));
    assertDefined(res.headers.get('x-ratelimit-remaining'));
    assertDefined(res.headers.get('x-ratelimit-reset'));
  });
});

describe('Agents Route Contracts', () => {
  test('GET /api/v1/agents/check-name/:name rejects invalid names (no DB required)', async () => {
    const res = await http(baseUrl, 'GET', '/api/v1/agents/check-name/INVALID-NAME');
    if (VERBOSE) console.log('    body:', res.body);

    assertEqual(res.status, 200);
    assertEqual(res.body?.success, true);
    assertEqual(res.body?.available, false);
    assert(typeof res.body?.reason === 'string', 'Expected a reason string');
  });

  test('GET /api/v1/agents/check-name/:name accepts a valid name shape', async () => {
    const name = randomName('avail');
    const res = await http(baseUrl, 'GET', `/api/v1/agents/check-name/${name}`);
    if (VERBOSE) console.log('    body:', res.body);

    assertEqual(res.status, 200);
    assertEqual(res.body?.success, true);
    assert(typeof res.body?.available === 'boolean', 'Expected available boolean');
  });

  test('POST /api/v1/agents/register is removed (404)', async () => {
    const res = await http(baseUrl, 'POST', '/api/v1/agents/register', {
      body: { name: randomName('old_register'), description: 'Testing removed endpoint' }
    });

    if (VERBOSE) console.log('    body:', res.body);

    assertEqual(res.status, 404, 'Deprecated endpoint should return 404 Not Found');
  });
});

describe('Error Handling', () => {
  test('returns 404 JSON for unknown endpoints', async () => {
    const res = await http(baseUrl, 'GET', '/api/v1/does-not-exist');
    if (VERBOSE) console.log('    body:', res.body);

    assertEqual(res.status, 404);
    assertEqual(res.body?.success, false);
    assertEqual(res.body?.error, 'Endpoint not found');
  });

  test('returns 400 JSON for invalid JSON bodies', async () => {
    const res = await http(baseUrl, 'POST', '/api/v1/agents/register', {
      rawBody: '{'
    });

    if (VERBOSE) {
      console.log('    status:', res.status);
      console.log('    body:', res.body);
      console.log('    text:', res.text);
    }

    assertEqual(res.status, 400);
    assertEqual(res.body?.success, false);
    assertEqual(res.body?.error, 'Invalid JSON body');
  });
});

describe('Teardown', () => {
  test('stops the API app server', async () => {
    assertDefined(server, 'server should be running');
    await new Promise((resolve) => server.close(resolve));
    server = null;
    baseUrl = null;
  });
});

// Run
runTests();

