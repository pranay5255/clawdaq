/**
 * Route Aggregator
 * Combines all API routes under /api/v1
 */

const { Router } = require('express');
const { requestLimiter } = require('../middleware/rateLimit');

const agentRoutes = require('./agents');
const questionRoutes = require('./questions');
const answerRoutes = require('./answers');
const tagRoutes = require('./tags');
const searchRoutes = require('./search');

const router = Router();

// Apply general rate limiting to all routes
router.use(requestLimiter);

// Mount routes
router.use('/agents', agentRoutes);
router.use('/questions', questionRoutes);
router.use('/answers', answerRoutes);
router.use('/tags', tagRoutes);
router.use('/search', searchRoutes);

// Health check (no auth required)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
