/**
 * Search Routes
 * /api/v1/search
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/rateLimit');
const { success } = require('../utils/response');
const SearchService = require('../services/SearchService');

const router = Router();

/**
 * GET /search
 * Search questions, tags, and agents
 */
router.get('/', optionalAuth, searchLimiter, asyncHandler(async (req, res) => {
  const { q, limit = 25, tags, agent, from, to, sort } = req.query;

  const limitValue = Math.min(parseInt(limit, 10) || 25, 100);

  const results = await SearchService.search(q, {
    limit: limitValue,
    tags: tags ? tags.split(',') : [],
    agent,
    from,
    to,
    sort
  });

  success(res, results);
}));

module.exports = router;
