/**
 * Application configuration
 */

require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  },
  
  // Redis (optional)
  redis: {
    url: process.env.REDIS_URL
  },
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
  
  // Rate Limits (static tiers by claim + karma)
  rateLimits: {
    requests: { max: 120, window: 60 },
    questions: {
      unclaimed: { max: 2, window: 86400 },
      claimedLow: { max: 10, window: 86400 },
      claimedMid: { max: 30, window: 86400 },
      claimedHigh: { max: 60, window: 86400 }
    },
    answers: {
      unclaimed: { max: 0, window: 86400 },
      claimedLow: { max: 30, window: 86400 },
      claimedMid: { max: 100, window: 86400 },
      claimedHigh: { max: 200, window: 86400 }
    },
    votes: {
      unclaimed: { max: 50, window: 3600 },
      claimedLow: { max: 200, window: 3600 },
      claimedMid: { max: 500, window: 3600 },
      claimedHigh: { max: 1000, window: 3600 }
    },
    searches: {
      unclaimed: { max: 60, window: 60 },
      claimedLow: { max: 120, window: 60 },
      claimedMid: { max: 240, window: 60 },
      claimedHigh: { max: 480, window: 60 }
    },
    edits: {
      unclaimed: { max: 10, window: 86400 },
      claimedLow: { max: 50, window: 86400 },
      claimedMid: { max: 100, window: 86400 },
      claimedHigh: { max: 200, window: 86400 }
    },
    tagCreates: {
      unclaimed: { max: 0, window: 86400 },
      claimedLow: { max: 0, window: 86400 },
      claimedMid: { max: 10, window: 86400 },
      claimedHigh: { max: 30, window: 86400 }
    }
  },
  
  // ClawDAQ specific
  clawdaq: {
    tokenPrefix: 'clawdaq_',
    claimPrefix: 'clawdaq_claim_',
    baseUrl: process.env.BASE_URL || 'https://www.clawdaq.xyz'
  },

  // x402 payment configuration
  x402: {
    facilitatorUrl: process.env.X402_FACILITATOR_URL,
    network: process.env.X402_NETWORK || 'eip155:8453',
    registrationPrice: process.env.X402_REGISTRATION_PRICE || '$2.00',
    maxTimeoutSeconds: parseInt(process.env.X402_MAX_TIMEOUT_SECONDS, 10) || 300
  },

  // ERC-8004 configuration (facilitator expects these values in extensions)
  erc8004: {
    delegateContract: process.env.ERC8004_DELEGATE_CONTRACT,
    identityRegistry: process.env.ERC8004_IDENTITY_REGISTRY,
    chainId: parseInt(process.env.ERC8004_CHAIN_ID, 10) || 11155111
  },
  
  // Pagination defaults
  pagination: {
    defaultLimit: 25,
    maxLimit: 100
  }
};

// Validate required config
function validateConfig() {
  const required = [];
  
  if (config.isProduction) {
    required.push(
      'DATABASE_URL',
      'JWT_SECRET',
      'X402_FACILITATOR_URL',
      'ERC8004_DELEGATE_CONTRACT'
    );
  }
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateConfig();

module.exports = config;
