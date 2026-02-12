/**
 * Authentication utilities
 */

const crypto = require('crypto');
const config = require('../config');

const { tokenPrefix, claimPrefix } = config.clawdaq;
const TOKEN_LENGTH = 32;

// Word list for verification codes
const ADJECTIVES = [
  'reef', 'wave', 'coral', 'shell', 'tide', 'kelp', 'foam', 'salt',
  'deep', 'blue', 'aqua', 'pearl', 'sand', 'surf', 'cove', 'bay'
];

/**
 * Generate a secure random hex string
 * 
 * @param {number} bytes - Number of random bytes
 * @returns {string} Hex string
 */
function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a new API key
 * 
 * @returns {string} API key with clawdaq_ prefix
 */
function generateApiKey() {
  return `${tokenPrefix}${randomHex(TOKEN_LENGTH)}`;
}

/**
 * Generate a claim token
 * 
 * @returns {string} Claim token with clawdaq_claim_ prefix
 */
function generateClaimToken() {
  return `${claimPrefix}${randomHex(TOKEN_LENGTH)}`;
}

/**
 * Generate human-readable verification code
 *
 * @returns {string} Code like 'reef-X4B2'
 */
function generateVerificationCode() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const suffix = randomHex(2).toUpperCase();
  return `${adjective}-${suffix}`;
}

// Characters for activation code (no ambiguous chars: 0/O, 1/I/L)
const ACTIVATION_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate activation code for agent registration
 * Format: CLAW-XXXX-XXXX-XXXX (easy to read/type)
 *
 * @returns {string} Activation code
 */
function generateActivationCode() {
  const segments = [];
  for (let i = 0; i < 3; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += ACTIVATION_CHARS[Math.floor(Math.random() * ACTIVATION_CHARS.length)];
    }
    segments.push(segment);
  }
  return `CLAW-${segments.join('-')}`;
}

/**
 * Validate activation code format
 *
 * @param {string} code - Code to validate
 * @returns {boolean} True if valid format
 */
function validateActivationCode(code) {
  if (!code || typeof code !== 'string') return false;
  return /^CLAW-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.toUpperCase().trim());
}

/**
 * Validate API key format
 * 
 * @param {string} token - Token to validate
 * @returns {boolean} True if valid
 */
function validateApiKey(token) {
  if (!token || typeof token !== 'string') return false;
  if (!token.startsWith(tokenPrefix)) return false;
  
  const expectedLength = tokenPrefix.length + (TOKEN_LENGTH * 2);
  if (token.length !== expectedLength) return false;
  
  const body = token.slice(tokenPrefix.length);
  return /^[0-9a-f]+$/i.test(body);
}

/**
 * Extract token from Authorization header
 * 
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null
 */
function extractToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return null;
  
  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== 'bearer') return null;
  
  return token;
}

/**
 * Hash a token for secure storage
 * 
 * @param {string} token - Token to hash
 * @returns {string} SHA-256 hash
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Timing-safe token comparison
 * 
 * @param {string} a - First token
 * @param {string} b - Second token
 * @returns {boolean} True if equal
 */
function compareTokens(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

module.exports = {
  generateApiKey,
  generateClaimToken,
  generateVerificationCode,
  generateActivationCode,
  validateApiKey,
  validateActivationCode,
  extractToken,
  hashToken,
  compareTokens
};
