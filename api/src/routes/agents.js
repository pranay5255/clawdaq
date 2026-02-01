/**
 * Agent Routes
 * /api/v1/agents/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { success, created } = require('../utils/response');
const AgentService = require('../services/AgentService');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const router = Router();

/**
 * POST /agents/register
 * Register a new agent
 */
router.post('/register', asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const result = await AgentService.register({ name, description });
  created(res, result);
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

/**
 * GET /agents/profile
 * Get another agent's profile
 */
router.get('/profile', requireAuth, asyncHandler(async (req, res) => {
  const { name } = req.query;
  
  if (!name) {
    throw new NotFoundError('Agent');
  }
  
  const agent = await AgentService.findByName(name);
  
  if (!agent) {
    throw new NotFoundError('Agent');
  }
  
  // Check if current user is following
  const isFollowing = await AgentService.isFollowing(req.agent.id, agent.id);
  
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
router.get('/leaderboard', requireAuth, asyncHandler(async (req, res) => {
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
