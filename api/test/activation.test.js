/**
 * Activation Code Flow Tests
 *
 * These tests verify the activation code registration flow:
 * 1. Register with payment returns activation code (not API key)
 * 2. Activation code can be exchanged for API key
 * 3. Activation code expires after 24 hours
 * 4. Activation code can only be used once
 *
 * Run: node test/activation.test.js
 */

const AgentService = require('../src/services/AgentService');
const {
  generateActivationCode,
  validateActivationCode,
  hashToken
} = require('../src/utils/auth');
const { queryOne, queryAll, transaction } = require('../src/config/database');

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

function assertDefined(value, message) {
  if (value === undefined || value === null) {
    throw new Error(message || 'Expected value to be defined');
  }
}

async function runTests() {
  console.log('\nActivation Code Flow Tests\n');
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

  // Cleanup test agents
  await cleanup();

  process.exit(failed > 0 ? 1 : 0);
}

// Track test agents for cleanup
const testAgentNames = [];

async function cleanup() {
  console.log('Cleaning up test agents...');
  for (const name of testAgentNames) {
    try {
      await queryOne('DELETE FROM agents WHERE name = $1', [name]);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

function uniqueTestName(prefix = 'test_agent') {
  const name = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  testAgentNames.push(name);
  return name;
}

// ============ Tests ============

describe('Activation Code Generation', () => {
  test('generateActivationCode produces valid format', () => {
    const code = generateActivationCode();
    assert(validateActivationCode(code), 'Generated code should be valid');
    assert(code.startsWith('CLAW-'), 'Should have CLAW- prefix');
    assertEqual(code.length, 19, 'Should be 19 chars: CLAW-XXXX-XXXX-XXXX');
  });

  test('activation codes are unique', () => {
    const codes = new Set();
    for (let i = 0; i < 1000; i++) {
      codes.add(generateActivationCode());
    }
    assertEqual(codes.size, 1000, 'All codes should be unique');
  });
});

describe('AgentService.registerWithPayment', () => {
  test('returns activation code instead of API key', async () => {
    const name = uniqueTestName('reg');
    const result = await AgentService.registerWithPayment({
      name,
      description: 'Test agent',
      payerEoa: '0x742d35Cc6634C0532925a3b844Bc91e5dEb4dEe2',
      erc8004: {
        chainId: 84532,
        agentId: '123',
        agentUri: 'https://example.com/agent.json'
      }
    });

    // Should have activation code, NOT API key
    assertDefined(result.activationCode, 'Should return activationCode');
    assert(!result.agent?.api_key, 'Should NOT return api_key');
    assert(validateActivationCode(result.activationCode), 'Code should be valid format');

    // Should have instructions
    assertDefined(result.instructions, 'Should have instructions');
    assert(result.instructions.command.includes(result.activationCode), 'Command should include code');

    // Should have expiration
    assertDefined(result.expiresAt, 'Should have expiresAt');
    const expiresAt = new Date(result.expiresAt);
    const now = new Date();
    const hoursDiff = (expiresAt - now) / (1000 * 60 * 60);
    assert(hoursDiff > 23 && hoursDiff < 25, 'Should expire in ~24 hours');
  });

  test('agent is created in pending_activation status', async () => {
    const name = uniqueTestName('status');
    await AgentService.registerWithPayment({
      name,
      payerEoa: '0x742d35Cc6634C0532925a3b844Bc91e5dEb4dEe2'
    });

    const agent = await AgentService.findByName(name);
    assertEqual(agent.status, 'pending_activation', 'Status should be pending_activation');
    assertEqual(agent.api_key_hash, null, 'Should not have API key yet');
  });
});

describe('AgentService.activateAgent', () => {
  test('exchanges valid code for API key', async () => {
    const name = uniqueTestName('activate');
    const regResult = await AgentService.registerWithPayment({
      name,
      payerEoa: '0x742d35Cc6634C0532925a3b844Bc91e5dEb4dEe2'
    });

    const result = await AgentService.activateAgent(regResult.activationCode);

    assertDefined(result.apiKey, 'Should return apiKey');
    assert(result.apiKey.startsWith('clawdaq_'), 'API key should have prefix');
    assertEqual(result.agent.name, name, 'Should return correct agent name');
    assertDefined(result.config.apiBase, 'Should return API base URL');
  });

  test('marks agent as active after activation', async () => {
    const name = uniqueTestName('active');
    const regResult = await AgentService.registerWithPayment({
      name,
      payerEoa: '0x742d35Cc6634C0532925a3b844Bc91e5dEb4dEe2'
    });

    await AgentService.activateAgent(regResult.activationCode);

    const agent = await AgentService.findByName(name);
    assertEqual(agent.status, 'active', 'Status should be active');
    assertDefined(agent.api_key_hash, 'Should have API key hash');
  });

  test('API key works after activation', async () => {
    const name = uniqueTestName('key');
    const regResult = await AgentService.registerWithPayment({
      name,
      payerEoa: '0x742d35Cc6634C0532925a3b844Bc91e5dEb4dEe2'
    });

    const result = await AgentService.activateAgent(regResult.activationCode);

    // Should be able to find agent by API key
    const agent = await AgentService.findByApiKey(result.apiKey);
    assertDefined(agent, 'Should find agent by API key');
    assertEqual(agent.name, name, 'Should be correct agent');
  });

  test('rejects already used activation code', async () => {
    const name = uniqueTestName('used');
    const regResult = await AgentService.registerWithPayment({
      name,
      payerEoa: '0x742d35Cc6634C0532925a3b844Bc91e5dEb4dEe2'
    });

    // First activation should succeed
    await AgentService.activateAgent(regResult.activationCode);

    // Second activation should fail
    try {
      await AgentService.activateAgent(regResult.activationCode);
      throw new Error('Should have thrown');
    } catch (error) {
      assert(error.message.includes('already been used'), 'Should reject used code');
    }
  });

  test('rejects invalid activation code', async () => {
    try {
      await AgentService.activateAgent('CLAW-FAKE-CODE-HERE');
      throw new Error('Should have thrown');
    } catch (error) {
      assert(
        error.message.includes('Invalid') || error.message.includes('not found'),
        'Should reject invalid code'
      );
    }
  });

  test('rejects expired activation code', async () => {
    const name = uniqueTestName('expired');
    const regResult = await AgentService.registerWithPayment({
      name,
      payerEoa: '0x742d35Cc6634C0532925a3b844Bc91e5dEb4dEe2'
    });

    // Manually expire the code
    const codeHash = hashToken(regResult.activationCode.toUpperCase().trim());
    await queryOne(
      `UPDATE agents SET activation_expires_at = NOW() - INTERVAL '1 hour'
       WHERE activation_code_hash = $1`,
      [codeHash]
    );

    try {
      await AgentService.activateAgent(regResult.activationCode);
      throw new Error('Should have thrown');
    } catch (error) {
      assert(error.message.includes('expired'), 'Should reject expired code');
    }
  });

  test('case insensitive activation code', async () => {
    const name = uniqueTestName('case');
    const regResult = await AgentService.registerWithPayment({
      name,
      payerEoa: '0x742d35Cc6634C0532925a3b844Bc91e5dEb4dEe2'
    });

    // Use lowercase version
    const lowerCode = regResult.activationCode.toLowerCase();
    const result = await AgentService.activateAgent(lowerCode);

    assertDefined(result.apiKey, 'Should work with lowercase code');
  });
});

describe('findByActivationCode', () => {
  test('finds agent by hashed activation code', async () => {
    const name = uniqueTestName('find');
    const regResult = await AgentService.registerWithPayment({
      name,
      payerEoa: '0x742d35Cc6634C0532925a3b844Bc91e5dEb4dEe2'
    });

    const codeHash = hashToken(regResult.activationCode.toUpperCase().trim());
    const agent = await AgentService.findByActivationCode(codeHash);

    assertDefined(agent, 'Should find agent');
    assertEqual(agent.name, name, 'Should be correct agent');
  });

  test('returns null for unknown code', async () => {
    const agent = await AgentService.findByActivationCode(hashToken('CLAW-XXXX-XXXX-XXXX'));
    assertEqual(agent, null, 'Should return null for unknown code');
  });
});

// Run tests
runTests();
