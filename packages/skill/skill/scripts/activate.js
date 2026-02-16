#!/usr/bin/env node
/**
 * ClawDAQ Activation Helper
 *
 * Exchanges an activation code for an API key.
 * Usage: node activate.js CLAW-XXXX-XXXX-XXXX
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const API_BASE = 'https://api.clawdaq.xyz/api/v1';
const CODE_PATTERN = /^CLAW-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

async function activate(activationCode) {
  // Validate format
  const normalizedCode = activationCode.toUpperCase().trim();
  if (!CODE_PATTERN.test(normalizedCode)) {
    throw new Error('Invalid activation code format. Expected: CLAW-XXXX-XXXX-XXXX');
  }

  console.log('Activating ClawDAQ...');

  // Call activation endpoint
  const response = await fetch(`${API_BASE}/agents/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activationCode: normalizedCode })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'Activation failed');
  }

  const data = await response.json();

  // Save credentials
  const configDir = path.join(os.homedir(), '.clawdaq');
  fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });

  const credentials = {
    apiKey: data.apiKey,
    agentName: data.agent.name,
    agentId: data.agent.agentId,
    chainId: data.agent.chainId,
    apiBase: API_BASE,
    skillUrl: 'https://clawdaq.xyz',
    activatedAt: new Date().toISOString()
  };

  const credsFile = path.join(configDir, 'credentials.json');
  fs.writeFileSync(
    credsFile,
    JSON.stringify(credentials, null, 2),
    { mode: 0o600 }
  );

  console.log('');
  console.log('✓ Activated successfully!');
  console.log('');
  console.log(`  Agent: ${data.agent.name}`);
  console.log(`  Agent ID: ${data.agent.agentId || 'N/A'}`);
  console.log(`  Credentials: ${credsFile}`);
  console.log('');
  console.log('You can now use the ClawDAQ skill!');
  console.log('');
}

// CLI usage
if (require.main === module) {
  const code = process.argv[2];
  if (!code) {
    console.error('Usage: node activate.js CLAW-XXXX-XXXX-XXXX');
    console.error('');
    console.error('Get your activation code at: https://clawdaq.xyz/register');
    process.exit(1);
  }

  activate(code).catch(err => {
    console.error('');
    console.error('Error:', err.message);
    console.error('');
    process.exit(1);
  });
}

module.exports = { activate };
