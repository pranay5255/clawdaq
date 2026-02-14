/**
 * x402 Compatibility Shim Tests
 *
 * What this covers:
 * - v2 request header -> v1 request header mapping (PAYMENT-SIGNATURE -> X-PAYMENT)
 * - v1 response header -> v2 response header mapping (X-PAYMENT-RESPONSE -> PAYMENT-RESPONSE)
 * - v1 402 JSON body (`accepts`) -> v2 PAYMENT-REQUIRED response header
 *
 * Run:
 *   node test/x402-compat.test.js
 *
 * Optional:
 *   TEST_VERBOSE=1 node test/x402-compat.test.js
 */

const express = require('express');
const { x402CompatShim } = require('../src/middleware/x402Compat');

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

async function http(baseUrl, method, route, { headers, body } = {}) {
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : null),
      ...(headers || {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  return {
    status: res.status,
    headers: res.headers,
    body: json
  };
}

async function runTests() {
  console.log('\nx402 Compatibility Shim Tests\n');
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
  test('starts a test server with the x402 compat shim', async () => {
    const app = express();
    app.use(x402CompatShim());

    app.get('/__test__/headers', (req, res) => {
      res.json({
        paymentSignature: req.get('PAYMENT-SIGNATURE') || null,
        xPayment: req.get('X-PAYMENT') || null
      });
    });

    app.get('/__test__/set-response-header', (_req, res) => {
      res.setHeader('X-PAYMENT-RESPONSE', 'v1-response');
      res.json({ ok: true });
    });

    app.get('/__test__/challenge', (_req, res) => {
      res.status(402).json({
        accepts: [{ scheme: 'exact', network: 'base-sepolia', price: '$5.00' }]
      });
    });

    app.get('/__test__/already-required', (_req, res) => {
      res.setHeader('PAYMENT-REQUIRED', 'already');
      res.status(402).json({
        accepts: [{ scheme: 'exact', network: 'base-sepolia', price: '$5.00' }]
      });
    });

    server = await new Promise((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    console.log(`    test server: ${baseUrl}`);
    assertDefined(baseUrl);
  });
});

describe('Request Header Mapping', () => {
  test('maps PAYMENT-SIGNATURE to X-PAYMENT when X-PAYMENT is missing', async () => {
    const res = await http(baseUrl, 'GET', '/__test__/headers', {
      headers: { 'PAYMENT-SIGNATURE': 'sig_123' }
    });

    if (VERBOSE) {
      console.log('    response body:', res.body);
    }

    assertEqual(res.status, 200);
    assertEqual(res.body.paymentSignature, 'sig_123');
    assertEqual(res.body.xPayment, 'sig_123');
  });

  test('does not override X-PAYMENT when both headers are present', async () => {
    const res = await http(baseUrl, 'GET', '/__test__/headers', {
      headers: { 'X-PAYMENT': 'xpay_456', 'PAYMENT-SIGNATURE': 'sig_123' }
    });

    if (VERBOSE) {
      console.log('    response body:', res.body);
    }

    assertEqual(res.status, 200);
    assertEqual(res.body.paymentSignature, 'sig_123');
    assertEqual(res.body.xPayment, 'xpay_456');
  });
});

describe('Response Header Mapping', () => {
  test('maps X-PAYMENT-RESPONSE to PAYMENT-RESPONSE', async () => {
    const res = await http(baseUrl, 'GET', '/__test__/set-response-header');

    const xPaymentResponse = res.headers.get('x-payment-response');
    const paymentResponse = res.headers.get('payment-response');

    if (VERBOSE) {
      console.log('    headers:', { xPaymentResponse, paymentResponse });
    }

    assertEqual(res.status, 200);
    assertEqual(res.body.ok, true);
    assertEqual(xPaymentResponse, 'v1-response');
    assertEqual(paymentResponse, 'v1-response');
  });
});

describe('402 Challenge Mapping', () => {
  test('sets PAYMENT-REQUIRED when responding 402 with accepts[] body', async () => {
    const res = await http(baseUrl, 'GET', '/__test__/challenge');
    const paymentRequired = res.headers.get('payment-required');

    if (VERBOSE) {
      console.log('    status:', res.status);
      console.log('    payment-required:', paymentRequired);
      console.log('    body:', res.body);
    }

    assertEqual(res.status, 402);
    assertDefined(paymentRequired, 'Expected PAYMENT-REQUIRED header to be set');
    assert(Array.isArray(res.body.accepts), 'Expected body.accepts to be an array');
    assert(res.body.accepts.length > 0, 'Expected body.accepts to be non-empty');
  });

  test('does not overwrite PAYMENT-REQUIRED if it is already set', async () => {
    const res = await http(baseUrl, 'GET', '/__test__/already-required');
    const paymentRequired = res.headers.get('payment-required');

    if (VERBOSE) {
      console.log('    payment-required:', paymentRequired);
      console.log('    body:', res.body);
    }

    assertEqual(res.status, 402);
    assertEqual(paymentRequired, 'already');
  });
});

describe('Teardown', () => {
  test('stops the test server', async () => {
    assertDefined(server, 'server should be running');
    await new Promise((resolve) => server.close(resolve));
    server = null;
    baseUrl = null;
  });
});

// Run
runTests();

