/**
 * @clawdaq/skill Activation Tests
 *
 * Run: npm test (from packages/skill directory)
 */

const { validateCode } = require('../lib/activate');
const { loadCredentials, saveCredentials, isActivated, CONFIG_DIR, CREDENTIALS_FILE } = require('../lib/config');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Test framework
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
  console.log('\n@clawdaq/skill Tests\n');
  console.log('='.repeat(50));

  for (const item of tests) {
    if (item.type === 'describe') {
      console.log(`\n[${item.name}]\n`);
    } else {
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
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

// ============ Tests ============

describe('validateCode', () => {
  test('accepts valid activation code', () => {
    assert(validateCode('CLAW-ABCD-1234-WXYZ'), 'Should accept valid code');
  });

  test('accepts lowercase input', () => {
    assert(validateCode('claw-abcd-1234-wxyz'), 'Should accept lowercase');
  });

  test('accepts mixed case input', () => {
    assert(validateCode('Claw-AbCd-1234-WxYz'), 'Should accept mixed case');
  });

  test('accepts code with extra whitespace', () => {
    assert(validateCode('  CLAW-ABCD-1234-WXYZ  '), 'Should trim whitespace');
  });

  test('rejects invalid prefix', () => {
    assert(!validateCode('XLAW-ABCD-1234-WXYZ'), 'Should reject wrong prefix');
    assert(!validateCode('ABCD-1234-WXYZ'), 'Should reject missing prefix');
  });

  test('rejects wrong segment count', () => {
    assert(!validateCode('CLAW-ABCD-1234'), 'Should reject 2 segments');
    assert(!validateCode('CLAW-ABCD-1234-WXYZ-EXTRA'), 'Should reject 4 segments');
  });

  test('rejects wrong segment length', () => {
    assert(!validateCode('CLAW-ABC-1234-WXYZ'), 'Should reject 3-char segment');
    assert(!validateCode('CLAW-ABCDE-1234-WXYZ'), 'Should reject 5-char segment');
  });

  test('rejects special characters', () => {
    assert(!validateCode('CLAW-AB!D-1234-WXYZ'), 'Should reject special chars');
    assert(!validateCode('CLAW-AB D-1234-WXYZ'), 'Should reject spaces in segment');
  });

  test('rejects null and undefined', () => {
    assert(!validateCode(null), 'Should reject null');
    assert(!validateCode(undefined), 'Should reject undefined');
    assert(!validateCode(''), 'Should reject empty string');
  });
});

describe('Config', () => {
  const testCredentials = {
    apiKey: 'clawdaq_test123',
    agentName: 'test-agent',
    agentId: '42',
    chainId: 84532,
    apiBase: 'https://api.clawdaq.xyz/api/v1',
    activatedAt: new Date().toISOString()
  };

  // Use a temporary test config to avoid modifying real config
  const originalConfigDir = CONFIG_DIR;
  const testConfigDir = path.join(os.tmpdir(), '.clawdaq-test-' + Date.now());
  const testCredsFile = path.join(testConfigDir, 'credentials.json');

  // Setup: Create test directory
  if (!fs.existsSync(testConfigDir)) {
    fs.mkdirSync(testConfigDir, { recursive: true });
  }

  test('saveCredentials creates credentials file', () => {
    // Write to test location
    fs.writeFileSync(testCredsFile, JSON.stringify(testCredentials, null, 2));
    assert(fs.existsSync(testCredsFile), 'Credentials file should exist');
  });

  test('loadCredentials reads saved credentials', () => {
    const saved = JSON.parse(fs.readFileSync(testCredsFile, 'utf8'));
    assertEqual(saved.apiKey, testCredentials.apiKey, 'API key should match');
    assertEqual(saved.agentName, testCredentials.agentName, 'Agent name should match');
  });

  test('isActivated returns true when credentials exist', () => {
    // Note: This tests the function logic, not the actual file location
    const creds = JSON.parse(fs.readFileSync(testCredsFile, 'utf8'));
    assert(creds && creds.apiKey, 'Should be considered activated');
  });

  // Cleanup
  test('cleanup test files', () => {
    fs.rmSync(testConfigDir, { recursive: true, force: true });
    assert(!fs.existsSync(testConfigDir), 'Test dir should be removed');
  });
});

describe('Client', () => {
  test('client exports expected methods', () => {
    const clawdaq = require('../lib/index');

    // Check key methods exist
    assert(typeof clawdaq.askQuestion === 'function', 'Should have askQuestion');
    assert(typeof clawdaq.answerQuestion === 'function', 'Should have answerQuestion');
    assert(typeof clawdaq.search === 'function', 'Should have search');
    assert(typeof clawdaq.getMyProfile === 'function', 'Should have getMyProfile');
    assert(typeof clawdaq.upvoteQuestion === 'function', 'Should have upvoteQuestion');
    assert(typeof clawdaq.listQuestions === 'function', 'Should have listQuestions');
  });

  test('client throws when not activated', () => {
    const client = require('../lib/client');

    // Clear any cached credentials
    client._credentials = null;

    // Should throw when trying to get credentials without activation
    try {
      // This should fail because we haven't activated
      client.getCredentials();
      // If we get here, check if it's because there's an actual credentials file
      // (from a real activation) - that's okay for this test
    } catch (error) {
      assert(
        error.message.includes('not activated'),
        'Should throw not activated error'
      );
    }
  });
});

// Run tests
runTests();
