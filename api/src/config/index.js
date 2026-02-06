/**
 * Application configuration
 */

require('dotenv').config();

function parseIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUsdcBaseUnits(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(raw)) return fallback;
  const [whole, fraction = ''] = raw.split('.');
  const padded = (fraction + '000000').slice(0, 6);
  const amount = Number(whole) * 1_000_000 + Number(padded);
  return Number.isFinite(amount) ? amount : fallback;
}

function resolveRegistrationFeeBaseUnits() {
  const baseUnits = parseIntOrNull(process.env.AGENT_REGISTER_USDC_BASE_UNITS);
  if (baseUnits !== null) return baseUnits;
  return parseUsdcBaseUnits(process.env.AGENT_REGISTER_USDC || '5', 5_000_000);
}

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

  // x402 payment (optional)
  x402: {
    address: process.env.ADDRESS,
    env: process.env.X402_ENV || 'testnet',
    facilitatorUrl: process.env.FACILITATOR_URL || 'https://x402.org/facilitator',
    agentRegisterPrice: process.env.AGENT_REGISTER_PRICE || '$5.00'
  },

  // Blockchain (registry + payments)
  blockchain: {
    registryAddress: process.env.REGISTRY_ADDRESS,
    usdcAddress: process.env.USDC_ADDRESS,
    rpcUrl: process.env.BASE_RPC_URL
      || process.env.BASE_SEPOLIA_RPC_URL
      || process.env.ERC8004_RPC_URL
      || 'https://sepolia.base.org',
    chainId: parseIntOrNull(process.env.BLOCKCHAIN_CHAIN_ID)
      || parseIntOrNull(process.env.BASE_CHAIN_ID)
      || parseIntOrNull(process.env.ERC8004_CHAIN_ID),
    custodialAddress: process.env.CUSTODIAL_WALLET_ADDRESS || process.env.ADDRESS,
    custodialPrivateKey: process.env.CUSTODIAL_PRIVATE_KEY || process.env.ERC8004_DEPLOYER_PRIVATE_KEY,
    paymentRecipient: process.env.ADDRESS || process.env.REGISTRY_ADDRESS,
    minConfirmations: parseIntOrNull(process.env.USDC_MIN_CONFIRMATIONS) || 1,
    registrationFeeUsdc: resolveRegistrationFeeBaseUnits()
  },

  // Agent0 (ERC-8004) identity
  agent0: {
    chainId: parseIntOrNull(process.env.AGENT0_CHAIN_ID),
    rpcUrl: process.env.AGENT0_RPC_URL || process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    identityContract: process.env.AGENT0_IDENTITY_CONTRACT,
    ipfsProvider: process.env.AGENT0_IPFS_PROVIDER || process.env.IPFS_PROVIDER || 'pinata',
    pinataJwt: process.env.PINATA_JWT,
    filecoinToken: process.env.FILECOIN_TOKEN,
    subgraphUrl: process.env.AGENT0_SUBGRAPH_URL,
    adapterPath: process.env.AGENT0_ADAPTER_PATH,
    mockMode: process.env.AGENT0_MOCK === 'true' || (!process.env.AGENT0_IDENTITY_CONTRACT && process.env.NODE_ENV !== 'production')
  },

  // ERC-8004 identity (optional)
  erc8004: {
    registryAddress: process.env.ERC8004_REGISTRY_ADDRESS,
    rpcUrl: process.env.ERC8004_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    chainId: process.env.ERC8004_CHAIN_ID ? parseInt(process.env.ERC8004_CHAIN_ID, 10) : null,
    authRequired: process.env.ERC8004_AUTH_REQUIRED
      ? process.env.ERC8004_AUTH_REQUIRED === 'true'
      : process.env.NODE_ENV === 'production',
    signatureTtlSeconds: (() => {
      if (!process.env.ERC8004_SIGNATURE_TTL_SECONDS) return 600;
      const parsed = parseInt(process.env.ERC8004_SIGNATURE_TTL_SECONDS, 10);
      return Number.isFinite(parsed) ? parsed : 600;
    })()
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

  if (config.erc8004?.authRequired && !config.erc8004.registryAddress) {
    console.warn('[config] ERC8004_AUTH_REQUIRED is enabled but ERC8004_REGISTRY_ADDRESS is not set.');
  }

  if (!config.agent0?.mockMode && !config.agent0?.identityContract) {
    console.warn('[config] Agent0 identity contract not configured; set AGENT0_IDENTITY_CONTRACT or AGENT0_MOCK=true.');
  }

  if (!config.blockchain?.registryAddress) {
    console.warn('[config] REGISTRY_ADDRESS not set; custodial registry writes are disabled.');
  }
}

validateConfig();

module.exports = config;
