/**
 * x402 Payment Middleware Config Tests (No Network)
 *
 * These tests validate how x402 paywalling is enabled/disabled via env vars.
 * They don't attempt to settle payments; they only validate configuration gates.
 *
 * Run:
 *   node test/x402-payment-config.test.js
 */

// Test framework (small + dependency-free)
let passed = 0;
let failed = 0;
const tests = [];

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

async function runTests() {
  console.log('\nx402 Payment Middleware Config Tests\n');
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

function withEnv(env, fn) {
  const original = { ...process.env };
  try {
    Object.assign(process.env, env);
    return fn();
  } finally {
    process.env = original;
  }
}

function freshX402PaymentModule() {
  // Ensure config is re-evaluated from env.
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/middleware/x402Payment')];
  return require('../src/middleware/x402Payment');
}

const VALID_ADDRESS = '0x0000000000000000000000000000000000000001';

describe('buildRegisterPaymentMiddleware', () => {
  test('returns null when ADDRESS is missing (paywall disabled)', () => {
    withEnv(
      { ADDRESS: '', X402_REGISTER_REQUIRED: 'true' },
      () => {
        const { buildRegisterPaymentMiddleware } = freshX402PaymentModule();
        const mw = buildRegisterPaymentMiddleware();
        assertEqual(mw, null);
      }
    );
  });

  test('returns null when X402_REGISTER_REQUIRED is not true (even if ADDRESS is set)', () => {
    withEnv(
      { ADDRESS: VALID_ADDRESS, X402_REGISTER_REQUIRED: 'false', X402_ENV: 'testnet' },
      () => {
        const { buildRegisterPaymentMiddleware } = freshX402PaymentModule();
        const mw = buildRegisterPaymentMiddleware();
        assertEqual(mw, null);
      }
    );
  });

  test('throws in mainnet mode if required CDP credentials are missing', () => {
    withEnv(
      {
        ADDRESS: VALID_ADDRESS,
        X402_REGISTER_REQUIRED: 'true',
        X402_ENV: 'mainnet',
        CDP_API_KEY_ID: '',
        CDP_API_KEY_SECRET: ''
      },
      () => {
        const { buildRegisterPaymentMiddleware } = freshX402PaymentModule();
        let threw = false;
        try {
          buildRegisterPaymentMiddleware();
        } catch (e) {
          threw = true;
          assert(String(e.message).includes('CDP_API_KEY_ID'), 'Expected missing CDP env vars error');
        }
        assert(threw, 'Expected buildRegisterPaymentMiddleware to throw');
      }
    );
  });

  test('returns a middleware function in testnet mode when enabled (no payment attempt)', () => {
    withEnv(
      {
        ADDRESS: VALID_ADDRESS,
        X402_REGISTER_REQUIRED: 'true',
        X402_ENV: 'testnet'
      },
      () => {
        const { buildRegisterPaymentMiddleware } = freshX402PaymentModule();
        const mw = buildRegisterPaymentMiddleware();
        assert(typeof mw === 'function', 'Expected an express middleware function');
      }
    );
  });
});

// Run
runTests();

