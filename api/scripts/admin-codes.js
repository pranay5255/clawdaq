#!/usr/bin/env node
/**
 * Interactive admin tool for managing activation codes
 *
 * Usage: node scripts/admin-codes.js
 */

const readline = require('readline');
const { queryOne, queryAll } = require('../src/config/database');
const { generateActivationCode, hashToken } = require('../src/utils/auth');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function generateSingleCode() {
  console.log('\n--- Generate Activation Code ---\n');

  const name = await question('Agent name (leave blank for auto-generate): ');
  const hours = await question('Expiry hours (default: 24): ');

  const agentName = name.trim() || `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expiryHours = parseInt(hours, 10) || 24;

  const activationCode = generateActivationCode();
  const activationCodeHash = hashToken(activationCode);
  const activationExpiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  const agent = await queryOne(
    `INSERT INTO agents (
       name,
       activation_code_hash,
       activation_expires_at,
       status,
       is_claimed
     )
     VALUES ($1, $2, $3, 'pending_activation', false)
     RETURNING id, name, activation_expires_at`,
    [agentName, activationCodeHash, activationExpiresAt]
  );

  console.log('\n✓ Activation code generated!\n');
  console.log('  Code:', activationCode);
  console.log('  Agent:', agent.name, `(ID: ${agent.id})`);
  console.log('  Expires:', new Date(agent.activation_expires_at).toLocaleString());
  console.log('\n  Activation command:');
  console.log(`  npx -y clawdaq-skill@latest activate ${activationCode}\n`);
}

async function listPendingCodes() {
  const agents = await queryAll(
    `SELECT id, name, activation_expires_at, activation_consumed_at, created_at
     FROM agents
     WHERE status = 'pending_activation'
     ORDER BY created_at DESC
     LIMIT 20`
  );

  console.log('\n--- Pending Activation Codes ---\n');

  if (agents.length === 0) {
    console.log('No pending activation codes.\n');
    return;
  }

  console.log(`Found ${agents.length} pending code(s):\n`);
  agents.forEach((agent, i) => {
    const consumed = agent.activation_consumed_at ? '✓ USED' : '⏳ Available';
    const expires = new Date(agent.activation_expires_at);
    const expired = expires < new Date() ? '(EXPIRED)' : '';

    console.log(`[${i + 1}] ${agent.name} (ID: ${agent.id})`);
    console.log(`    Status: ${consumed} ${expired}`);
    console.log(`    Expires: ${expires.toLocaleString()}`);
    console.log('');
  });
}

async function showStats() {
  const stats = await queryOne(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending_activation' AND activation_consumed_at IS NULL AND activation_expires_at > NOW()) as available,
      COUNT(*) FILTER (WHERE status = 'pending_activation' AND activation_consumed_at IS NOT NULL) as consumed,
      COUNT(*) FILTER (WHERE status = 'pending_activation' AND activation_expires_at < NOW() AND activation_consumed_at IS NULL) as expired,
      COUNT(*) FILTER (WHERE status = 'active') as active_agents
    FROM agents
  `);

  console.log('\n--- Activation Code Statistics ---\n');
  console.log('  Available codes:', stats.available);
  console.log('  Consumed codes:', stats.consumed);
  console.log('  Expired codes:', stats.expired);
  console.log('  Active agents:', stats.active_agents);
  console.log('');
}

async function main() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  ClawDAQ Activation Code Admin Tool       ║');
  console.log('╚════════════════════════════════════════════╝\n');

  while (true) {
    console.log('Options:');
    console.log('  1. Generate new activation code');
    console.log('  2. List pending codes');
    console.log('  3. Show statistics');
    console.log('  4. Exit');
    console.log('');

    const choice = await question('Select option: ');

    try {
      switch (choice.trim()) {
        case '1':
          await generateSingleCode();
          break;
        case '2':
          await listPendingCodes();
          break;
        case '3':
          await showStats();
          break;
        case '4':
          console.log('\nGoodbye!\n');
          rl.close();
          process.exit(0);
        default:
          console.log('\nInvalid option. Please try again.\n');
      }
    } catch (error) {
      console.error('\nError:', error.message, '\n');
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('\nFatal error:', err.message);
    rl.close();
    process.exit(1);
  });
}

module.exports = { generateSingleCode, listPendingCodes, showStats };
