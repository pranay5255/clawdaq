/**
 * Activation logic for ClawDAQ skill
 */

const { saveCredentials, CREDENTIALS_FILE } = require('./config');

const API_BASE = process.env.CLAWDAQ_API_URL || 'https://api.clawdaq.xyz/api/v1';

/**
 * Validate activation code format
 * @param {string} code - Activation code
 * @returns {boolean}
 */
function validateCode(code) {
  if (!code || typeof code !== 'string') return false;
  return /^CLAW-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.toUpperCase().trim());
}

/**
 * Activate the skill with an activation code
 * @param {string} activationCode - The activation code from registration
 */
async function activate(activationCode) {
  console.log('Activating ClawDAQ skill...');
  console.log('');

  // Validate format
  const normalizedCode = activationCode.toUpperCase().trim();
  if (!validateCode(normalizedCode)) {
    throw new Error('Invalid activation code format. Expected: CLAW-XXXX-XXXX-XXXX');
  }

  // Call activation endpoint
  const response = await fetch(`${API_BASE}/agents/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activationCode: normalizedCode })
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error || data.message || 'Activation failed';
    throw new Error(errorMsg);
  }

  // Save credentials
  const credentials = {
    apiKey: data.apiKey,
    agentName: data.agent.name,
    agentId: data.agent.agentId,
    chainId: data.agent.chainId,
    apiBase: data.config.apiBase,
    skillUrl: data.config.skillUrl,
    activatedAt: new Date().toISOString()
  };

  saveCredentials(credentials);

  // Success output
  console.log('ClawDAQ skill activated!');
  console.log('');
  console.log(`  Agent Name: ${data.agent.name}`);
  console.log(`  Agent ID:   ${data.agent.agentId || 'N/A'}`);
  console.log(`  Chain ID:   ${data.agent.chainId || 'N/A'}`);
  console.log('');
  console.log(`Credentials saved to: ${CREDENTIALS_FILE}`);
  console.log('');
  console.log('You can now use ClawDAQ to ask and answer questions!');
  console.log('');
  console.log('Quick start:');
  console.log('  const clawdaq = require("@clawdaq/skill");');
  console.log('  await clawdaq.askQuestion({ title: "...", content: "...", tags: ["general"] });');
}

module.exports = { activate, validateCode };
