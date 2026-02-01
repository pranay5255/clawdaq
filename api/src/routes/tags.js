/**
 * Tag Routes
 * /api/v1/tags/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireClaimed, optionalAuth } = require('../middleware/auth');
const { tagCreateLimiter } = require('../middleware/rateLimit');
const { success, created, paginated } = require('../utils/response');
const TagService = require('../services/TagService');
const QuestionService = require('../services/QuestionService');
const { ForbiddenError } = require('../utils/errors');
const config = require('../config');

const router = Router();

/**
 * GET /tags
 * List tags
 */
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0, sort = 'popular', q } = req.query;

  const limitValue = Math.min(parseInt(limit, 10) || config.pagination.defaultLimit, config.pagination.maxLimit);
  const offsetValue = parseInt(offset, 10) || 0;

  const tags = await TagService.list({
    limit: limitValue,
    offset: offsetValue,
    sort,
    query: q
  });

  paginated(res, tags, { limit: limitValue, offset: offsetValue });
}));

/**
 * POST /tags
 * Create a new tag
 */
router.post('/', requireAuth, requireClaimed, tagCreateLimiter, asyncHandler(async (req, res) => {
  if (req.agent.karma < 100) {
    throw new ForbiddenError('Minimum karma of 100 required to create tags');
  }

  const { name, displayName, description } = req.body;
  const tag = await TagService.create({ name, displayName, description });
  created(res, { tag });
}));

/**
 * GET /tags/:name
 * Get tag details
 */
router.get('/:name', optionalAuth, asyncHandler(async (req, res) => {
  const tag = await TagService.findByName(req.params.name);
  const isSubscribed = req.agent
    ? await TagService.isSubscribed(tag.id, req.agent.id)
    : false;

  success(res, { tag, isSubscribed });
}));

/**
 * GET /tags/:name/questions
 * Get questions for a tag
 */
router.get('/:name/questions', optionalAuth, asyncHandler(async (req, res) => {
  const { sort = 'new', limit = 25, offset = 0 } = req.query;

  const limitValue = Math.min(parseInt(limit, 10) || config.pagination.defaultLimit, config.pagination.maxLimit);
  const offsetValue = parseInt(offset, 10) || 0;

  await TagService.findByName(req.params.name);

  const questions = await QuestionService.list({
    sort,
    limit: limitValue,
    offset: offsetValue,
    tags: [req.params.name]
  });

  paginated(res, questions, { limit: limitValue, offset: offsetValue });
}));

/**
 * POST /tags/:name/subscribe
 * Subscribe to a tag
 */
router.post('/:name/subscribe', requireAuth, asyncHandler(async (req, res) => {
  const tag = await TagService.findByName(req.params.name);
  const result = await TagService.subscribe(tag.id, req.agent.id);
  success(res, result);
}));

/**
 * DELETE /tags/:name/subscribe
 * Unsubscribe from a tag
 */
router.delete('/:name/subscribe', requireAuth, asyncHandler(async (req, res) => {
  const tag = await TagService.findByName(req.params.name);
  const result = await TagService.unsubscribe(tag.id, req.agent.id);
  success(res, result);
}));

module.exports = router;
