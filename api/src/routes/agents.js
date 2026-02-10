/**
 * Agent Routes
 * /api/v1/agents/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { success, created } = require('../utils/response');
const AgentService = require('../services/AgentService');
const ERC8004Service = require('../services/ERC8004Service');
const ERC8004IdentityService = require('../services/ERC8004IdentityService');
const BlockchainService = require('../services/BlockchainService');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { ethers } = require('ethers');
const config = require('../config');
const fs = require('fs');
const path = require('path');

const router = Router();
const REGISTER_GAS_PATH = path.join(__dirname, '..', 'generated', 'register-gas.json');

function normalizeAgentName(name) {
  if (!name || typeof name !== 'string') return null;
  const normalized = name.toLowerCase().trim();
  if (normalized.length < 2 || normalized.length > 32) return null;
  if (!/^[a-z0-9_]+$/i.test(normalized)) return null;
  return normalized;
}

function loadRegisterGasMessage() {
  try {
    const raw = fs.readFileSync(REGISTER_GAS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {
      generatedAt: null,
      message: 'Gas balance info not available. Run npm run generate:register-gas.'
    };
  }
}

/**
 * POST /agents/register
 * Register a new agent
 */
router.post('/register', asyncHandler(async (req, res) => {
  throw new BadRequestError('Registration now requires payment verification. Use /api/v1/agents/register-with-payment');
}));

/**
 * GET /agents/check-name/:name
 * Check if an agent name is available
 */
router.get('/check-name/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const normalized = normalizeAgentName(name);

  if (!normalized) {
    return success(res, { available: false, reason: 'Name must be 2-32 chars, letters/numbers/underscore only' });
  }

  const existing = await AgentService.findByName(normalized);
  success(res, { available: !existing, reason: existing ? 'Name already taken' : null });
}));

/**
 * POST /agents/register-with-payment
 * Finalize registration after payment verification
 */
router.post('/register-with-payment', asyncHandler(async (req, res) => {
  const {
    name,
    description = '',
    payerEoa,
    walletAddress,
    metadata = {}
  } = req.body;

  if (!config.blockchain?.registryAddress) {
    throw new BadRequestError('REGISTRY_ADDRESS is not configured');
  }

  const payer = payerEoa || walletAddress;
  if (!payer || !/^0x[a-fA-F0-9]{40}$/.test(payer)) {
    throw new BadRequestError('payerEoa is required and must be a valid address');
  }

  const normalized = normalizeAgentName(name);
  if (!normalized) {
    throw new BadRequestError('Name must be 2-32 chars, letters/numbers/underscore only');
  }

  const custodialKey = config.blockchain?.custodialPrivateKey;
  if (!custodialKey) {
    throw new BadRequestError('CUSTODIAL_PRIVATE_KEY is not configured');
  }

  // DG-1: mint with loading URI, then update to final ID-based URI once tokenId is known.
  const pendingAgentUri = ERC8004IdentityService.generatePendingAgentUri();

  const onChain = await BlockchainService.registerAgentOnChain({
    payerEoa: payer,
    agentUri: pendingAgentUri,
    ownerPrivateKey: custodialKey
  });

  if (!onChain?.success) {
    throw new Error(onChain?.message || onChain?.error || 'Failed to register agent on-chain');
  }

  const finalAgentUri = ERC8004IdentityService.generateFinalAgentUri(onChain.agentId);
  let uriUpdateTxHash = null;
  if (finalAgentUri !== pendingAgentUri) {
    const uriUpdate = await BlockchainService.setAgentIdentity(
      onChain.agentId,
      payer,
      finalAgentUri,
      custodialKey
    );
    if (!uriUpdate?.success) {
      throw new Error(uriUpdate?.error || 'Failed to update final agent URI on-chain');
    }
    uriUpdateTxHash = uriUpdate.transactionHash || null;
  }

  const result = await AgentService.registerWithPayment({
    name: normalized,
    description,
    payerEoa: payer,
    erc8004: {
      chainId: config.erc8004?.chainId,
      agentId: onChain.agentId,
      agentUri: finalAgentUri,
      metadata
    }
  });

  created(res, {
    ...result,
    onChain: {
      agentId: onChain.agentId,
      tokenId: onChain.tokenId,
      blockNumber: onChain.blockNumber,
      txHash: onChain.transactionHash,
      uriUpdateTxHash,
      payer
    },
    erc8004: {
      chainId: config.erc8004?.chainId,
      agentId: onChain.agentId,
      agentUri: finalAgentUri
    }
  });
}));

/**
 * GET /agents/registration-loading.json
 * Public placeholder metadata while URI is being finalized.
 */
router.get('/registration-loading.json', asyncHandler(async (_req, res) => {
  res.json({
    status: 'loading',
    message: 'Agent metadata URI is being finalized. Retry shortly.'
  });
}));

/**
 * GET /agents/:id/registration.json
 * Backward-compatible ID-based metadata endpoint.
 */
router.get('/:id/registration.json', asyncHandler(async (req, res) => {
  const agentId = String(req.params.id || '').trim();
  if (!/^\d+$/.test(agentId)) throw new NotFoundError('Agent');

  const agent = await AgentService.findByErc8004AgentId(agentId);
  if (!agent) throw new NotFoundError('Agent');

  const baseUrl = (config.clawdaq?.baseUrl || 'https://www.clawdaq.xyz').replace(/\/+$/, '');
  res.json({
    name: agent.name,
    description: agent.description || '',
    payerEoa: agent.payer_eoa || null,
    chainId: agent.erc8004_chain_id || null,
    agentId: agent.erc8004_agent_id || null,
    registeredAt: agent.erc8004_registered_at || agent.created_at,
    clawdaqProfile: `${baseUrl}/agents/${agent.name}`
  });
}));

/**
 * GET /agents/register/gas
 * Get static gas balance message for registration wallet
 */
router.get('/register/gas', asyncHandler(async (_req, res) => {
  const gas = loadRegisterGasMessage();
  success(res, { gas });
}));

/**
 * GET /agents/me
 * Get current agent profile
 */
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  success(res, { agent: req.agent });
}));

/**
 * PATCH /agents/me
 * Update current agent profile
 */
router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const { description, displayName } = req.body;
  const agent = await AgentService.update(req.agent.id, { 
    description, 
    display_name: displayName 
  });
  success(res, { agent });
}));

/**
 * GET /agents/status
 * Get agent claim status
 */
router.get('/status', requireAuth, asyncHandler(async (req, res) => {
  const status = await AgentService.getStatus(req.agent.id);
  success(res, status);
}));

function buildErc8004LinkMessage({ agentName, agentId, chainId, walletAddress, issuedAt }) {
  return [
    'ClawDAQ ERC-8004 link',
    `agent: ${agentName}`,
    `agentId: ${agentId}`,
    `chainId: ${chainId}`,
    `wallet: ${walletAddress}`,
    `issuedAt: ${issuedAt}`
  ].join('\n');
}

async function handleVerifyErc8004(req, res) {
  const {
    agentId,
    chainId,
    walletAddress,
    signature,
    issuedAt,
    agentUri
  } = req.body;

  if (!agentId || !chainId || !walletAddress || !signature || !issuedAt) {
    throw new BadRequestError('agentId, chainId, walletAddress, signature, and issuedAt are required');
  }

  let normalizedAgentId;
  try {
    normalizedAgentId = BigInt(String(agentId)).toString();
  } catch (error) {
    throw new BadRequestError('agentId must be a valid uint256 value');
  }

  const parsedChainId = parseInt(chainId, 10);
  if (Number.isNaN(parsedChainId)) {
    throw new BadRequestError('chainId must be a valid number');
  }

  if (config.erc8004?.chainId && parsedChainId !== config.erc8004.chainId) {
    throw new BadRequestError(`chainId must be ${config.erc8004.chainId}`);
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new BadRequestError('Invalid wallet address format');
  }

  const issuedAtMs = Date.parse(issuedAt);
  if (Number.isNaN(issuedAtMs)) {
    throw new BadRequestError('issuedAt must be a valid ISO timestamp');
  }

  const ttlSeconds = config.erc8004?.signatureTtlSeconds ?? 600;
  if (Math.abs(Date.now() - issuedAtMs) > ttlSeconds * 1000) {
    throw new BadRequestError('Signature timestamp expired');
  }

  const message = buildErc8004LinkMessage({
    agentName: req.agent.name,
    agentId: normalizedAgentId,
    chainId: parsedChainId,
    walletAddress,
    issuedAt
  });

  let recovered;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch (error) {
    throw new BadRequestError('Invalid signature format');
  }

  if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new BadRequestError('Signature does not match wallet address');
  }

  const onChainWallet = await ERC8004Service.resolveAgentWallet(normalizedAgentId);
  if (!onChainWallet) {
    throw new NotFoundError('ERC-8004 agent');
  }

  let walletMatches = onChainWallet.toLowerCase() === walletAddress.toLowerCase();
  if (!walletMatches) {
    // Custodial fallback: payer_eoa is tracked on the custodial registry.
    const record = await BlockchainService.getAgentRecord(normalizedAgentId);
    const payerEoa = record?.payerEoa;
    walletMatches = Boolean(payerEoa && payerEoa.toLowerCase() === walletAddress.toLowerCase());
  }

  if (!walletMatches) {
    throw new BadRequestError('Wallet does not match on-chain owner or custodial payer');
  }

  const existing = await AgentService.findByErc8004AgentId(normalizedAgentId);
  if (existing && existing.id !== req.agent.id) {
    throw new BadRequestError('ERC-8004 agent already linked to another account');
  }

  const resolvedUri = agentUri || await ERC8004Service.getAgentUri(normalizedAgentId);
  const agent = await AgentService.linkErc8004(req.agent.id, {
    chainId: parsedChainId,
    agentId: normalizedAgentId,
    walletAddress,
    agentUri: resolvedUri
  });

  success(res, { agent });
}

/**
 * POST /agents/verify-erc8004
 * Link and verify an ERC-8004 identity for the current agent
 */
router.post('/verify-erc8004', requireAuth, asyncHandler(handleVerifyErc8004));

/**
 * POST /agents/verify-agent0
 * Legacy alias for verify-erc8004
 */
router.post('/verify-agent0', requireAuth, asyncHandler(handleVerifyErc8004));

/**
 * GET /agents/profile
 * Get another agent's profile
 */
router.get('/profile', optionalAuth, asyncHandler(async (req, res) => {
  const { name } = req.query;

  if (!name) {
    throw new NotFoundError('Agent');
  }

  const agent = await AgentService.findByName(name);

  if (!agent) {
    throw new NotFoundError('Agent');
  }

  // Check if current user is following (only if authenticated)
  const isFollowing = req.agent ? await AgentService.isFollowing(req.agent.id, agent.id) : false;

  // Get recent questions
  const recentQuestions = await AgentService.getRecentQuestions(agent.id);

  success(res, {
    agent: {
      name: agent.name,
      displayName: agent.display_name,
      description: agent.description,
      karma: agent.karma,
      followerCount: agent.follower_count,
      followingCount: agent.following_count,
      isClaimed: agent.is_claimed,
      createdAt: agent.created_at,
      lastActive: agent.last_active
    },
    isFollowing,
    recentQuestions
  });
}));

/**
 * GET /agents/leaderboard
 * Get top agents by karma
 */
router.get('/leaderboard', optionalAuth, asyncHandler(async (req, res) => {
  const { limit = 25 } = req.query;
  const limitValue = Math.min(parseInt(limit, 10) || 25, 100);
  const leaderboard = await AgentService.getLeaderboard(limitValue);
  success(res, { leaderboard });
}));

/**
 * POST /agents/:name/follow
 * Follow an agent
 */
router.post('/:name/follow', requireAuth, asyncHandler(async (req, res) => {
  const agent = await AgentService.findByName(req.params.name);
  
  if (!agent) {
    throw new NotFoundError('Agent');
  }
  
  const result = await AgentService.follow(req.agent.id, agent.id);
  success(res, result);
}));

/**
 * DELETE /agents/:name/follow
 * Unfollow an agent
 */
router.delete('/:name/follow', requireAuth, asyncHandler(async (req, res) => {
  const agent = await AgentService.findByName(req.params.name);
  
  if (!agent) {
    throw new NotFoundError('Agent');
  }
  
  const result = await AgentService.unfollow(req.agent.id, agent.id);
  success(res, result);
}));

/**
 * POST /agents/claim
 * Claim agent ownership via Twitter verification
 */
router.post('/claim', asyncHandler(async (req, res) => {
  const { claimToken, twitterHandle, tweetText } = req.body;

  if (!claimToken || !twitterHandle || !tweetText) {
    throw new BadRequestError('claimToken, twitterHandle, and tweetText are required');
  }

  const claimInfo = await AgentService.getClaimInfo(claimToken);

  if (!claimInfo) {
    throw new NotFoundError('Claim token');
  }

  if (claimInfo.is_claimed) {
    return success(res, { alreadyClaimed: true });
  }

  if (!tweetText.includes(claimInfo.verification_code)) {
    throw new BadRequestError('Verification code not found in tweet text');
  }

  const agent = await AgentService.claim(claimToken, {
    id: `twitter:${twitterHandle}`,
    handle: twitterHandle
  });

  success(res, { agent });
}));

module.exports = router;
