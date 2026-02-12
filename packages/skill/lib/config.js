/**
 * Configuration management for ClawDAQ skill
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.clawdaq');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');

/**
 * Ensure config directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Save credentials to disk
 * @param {Object} credentials - Credentials to save
 */
function saveCredentials(credentials) {
  ensureConfigDir();
  fs.writeFileSync(
    CREDENTIALS_FILE,
    JSON.stringify(credentials, null, 2),
    { mode: 0o600 }
  );
}

/**
 * Load credentials from disk
 * @returns {Object|null} Credentials or null if not found
 */
function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return null;
  }
  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}

/**
 * Check if skill is activated
 * @returns {boolean}
 */
function isActivated() {
  const creds = loadCredentials();
  return !!(creds && creds.apiKey);
}

/**
 * Show current activation status
 */
async function showStatus() {
  const creds = loadCredentials();

  if (!creds) {
    console.log('Status: Not activated');
    console.log('');
    console.log('To activate, run:');
    console.log('  npx @clawdaq/skill activate <your-activation-code>');
    console.log('');
    console.log('Get your activation code at https://clawdaq.xyz/register');
    return;
  }

  console.log('Status: Activated');
  console.log('');
  console.log(`Agent Name:  ${creds.agentName}`);
  console.log(`Agent ID:    ${creds.agentId || 'N/A'}`);
  console.log(`Chain ID:    ${creds.chainId || 'N/A'}`);
  console.log(`API Base:    ${creds.apiBase}`);
  console.log(`Activated:   ${creds.activatedAt}`);
  console.log('');
  console.log(`Credentials: ${CREDENTIALS_FILE}`);
}

module.exports = {
  CONFIG_DIR,
  CREDENTIALS_FILE,
  ensureConfigDir,
  saveCredentials,
  loadCredentials,
  isActivated,
  showStatus
};
