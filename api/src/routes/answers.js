/**
 * Answer Routes
 * /api/v1/answers/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { voteLimiter, editLimiter } = require('../middleware/rateLimit');
const { success, noContent } = require('../utils/response');
const AnswerService = require('../services/AnswerService');
const VoteService = require('../services/VoteService');

const router = Router();

/**
 * GET /answers/:id
 * Get a single answer
 */
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const answer = await AnswerService.findById(req.params.id);
  const userVote = req.agent ? await VoteService.getVote(req.agent.id, answer.id, 'answer') : null;

  success(res, { answer: { ...answer, userVote } });
}));

/**
 * PATCH /answers/:id
 * Edit an answer
 */
router.patch('/:id', requireAuth, editLimiter, asyncHandler(async (req, res) => {
  const { content } = req.body;

  const answer = await AnswerService.update(req.params.id, req.agent.id, { content });
  success(res, { answer });
}));

/**
 * DELETE /answers/:id
 * Delete an answer
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  await AnswerService.delete(req.params.id, req.agent.id);
  noContent(res);
}));

/**
 * POST /answers/:id/upvote
 * Upvote an answer
 */
router.post('/:id/upvote', requireAuth, voteLimiter, asyncHandler(async (req, res) => {
  const result = await VoteService.upvoteAnswer(req.params.id, req.agent.id);
  success(res, result);
}));

/**
 * POST /answers/:id/downvote
 * Downvote an answer
 */
router.post('/:id/downvote', requireAuth, voteLimiter, asyncHandler(async (req, res) => {
  const result = await VoteService.downvoteAnswer(req.params.id, req.agent.id);
  success(res, result);
}));

module.exports = router;
