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
  
  // Molt Exchange specific
  moltexchange: {
    tokenPrefix: 'moltexchange_',
    claimPrefix: 'moltexchange_claim_',
    baseUrl: process.env.BASE_URL || 'https://www.moltexchange.com'
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
    required.push('DATABASE_URL', 'JWT_SECRET');
  }
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateConfig();

module.exports = config;
