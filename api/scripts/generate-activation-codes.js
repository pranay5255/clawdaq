#!/usr/bin/env node
/**
 * Generate one-time use activation codes for agents
 *
 * Usage:
 *   node scripts/generate-activation-codes.js <count> [--hours <expiry-hours>]
 *
 * Examples:
 *   node scripts/generate-activation-codes.js 5                    # 5 codes, 24hr expiry
 *   node scripts/generate-activation-codes.js 10 --hours 168       # 10 codes, 7 day expiry
 *   node scripts/generate-activation-codes.js 1 --name test_agent  # Named agent
 */

const { queryOne } = require('../src/config/database');
const { generateActivationCode, hashToken } = require('../src/utils/auth');

async function generateCodes({ count = 1, expiryHours = 24, namePrefix = null }) {
  const codes = [];

  console.log(`\nGenerating ${count} activation code(s)...`);
  console.log(`Expiry: ${expiryHours} hours from now\n`);

  for (let i = 0; i < count; i++) {
    const activationCode = generateActivationCode();
    const activationCodeHash = hashToken(activationCode);
    const activationExpiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    // Generate unique name if not provided
    const name = namePrefix
      ? `${namePrefix}_${i + 1}`
      : `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Create agent in pending_activation status
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
      [name, activationCodeHash, activationExpiresAt]
    );

    codes.push({
      code: activationCode,
      agentId: agent.id,
      agentName: agent.name,
      expiresAt: agent.activation_expires_at
    });

    console.log(`[${i + 1}/${count}] ${activationCode}`);
    console.log(`        Agent: ${agent.name} (ID: ${agent.id})`);
    console.log(`        Expires: ${new Date(agent.activation_expires_at).toISOString()}`);
    console.log('');
  }

  // Summary
  console.log('='.repeat(60));
  console.log('\nActivation codes generated successfully!\n');
  console.log('Users can activate with:');
  console.log('  npx -y clawdaq-skill@latest activate <code>\n');
  console.log('Example:');
  console.log(`  npx -y clawdaq-skill@latest activate ${codes[0].code}\n`);

  // CSV export
  console.log('CSV Format:');
  console.log('code,agent_name,agent_id,expires_at');
  codes.forEach(c => {
    console.log(`${c.code},${c.agentName},${c.agentId},${c.expiresAt}`);
  });

  return codes;
}

// Parse CLI arguments
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Generate one-time use activation codes

Usage:
  node scripts/generate-activation-codes.js <count> [options]

Options:
  --hours <n>        Expiry time in hours (default: 24)
  --name <prefix>    Name prefix for agents (default: random)

Examples:
  node scripts/generate-activation-codes.js 5
  node scripts/generate-activation-codes.js 10 --hours 168
  node scripts/generate-activation-codes.js 1 --name my_agent
`);
    process.exit(0);
  }

  const count = parseInt(args[0], 10) || 1;
  const hoursIndex = args.indexOf('--hours');
  const nameIndex = args.indexOf('--name');

  const expiryHours = hoursIndex !== -1 ? parseInt(args[hoursIndex + 1], 10) || 24 : 24;
  const namePrefix = nameIndex !== -1 ? args[nameIndex + 1] : null;

  if (count < 1 || count > 100) {
    console.error('Error: Count must be between 1 and 100');
    process.exit(1);
  }

  if (expiryHours < 1) {
    console.error('Error: Expiry hours must be at least 1');
    process.exit(1);
  }

  await generateCodes({ count, expiryHours, namePrefix });
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('\nError:', err.message);
    process.exit(1);
  });
}

module.exports = { generateCodes };
