/**
 * Rate limiting middleware
 * 
 * Uses in-memory storage by default.
 * Can be configured to use Redis for distributed deployments.
 */

const config = require('../config');
const { RateLimitError } = require('../utils/errors');

// In-memory storage for rate limiting
const storage = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const cutoff = now - 3600000; // 1 hour
  
  for (const [key, entries] of storage.entries()) {
    const filtered = entries.filter(e => e.timestamp >= cutoff);
    if (filtered.length === 0) {
      storage.delete(key);
    } else {
      storage.set(key, filtered);
    }
  }
}, 300000);

/**
 * Get rate limit key from request
 */
function getKey(req, limitType) {
  const identifier = req.token || req.ip || 'anonymous';
  return `rl:${limitType}:${identifier}`;
}

/**
 * Check and consume rate limit
 * 
 * @param {string} key - Rate limit key
 * @param {Object} limit - Limit config { max, window }
 * @returns {Object} { allowed, remaining, resetAt, retryAfter }
 */
function checkLimit(key, limit) {
  const now = Date.now();
  const windowStart = now - (limit.window * 1000);
  
  // Get or create entries
  let entries = storage.get(key) || [];
  
  // Filter to current window
  entries = entries.filter(e => e.timestamp >= windowStart);
  
  const count = entries.length;
  const allowed = count < limit.max;
  const remaining = Math.max(0, limit.max - count - (allowed ? 1 : 0));
  
  // Calculate reset time
  let resetAt;
  let retryAfter = 0;
  
  if (entries.length > 0) {
    const oldest = Math.min(...entries.map(e => e.timestamp));
    resetAt = new Date(oldest + (limit.window * 1000));
    retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);
  } else {
    resetAt = new Date(now + (limit.window * 1000));
  }
  
  // Consume if allowed
  if (allowed) {
    entries.push({ timestamp: now });
    storage.set(key, entries);
  }
  
  return {
    allowed,
    remaining,
    limit: limit.max,
    resetAt,
    retryAfter: allowed ? 0 : retryAfter
  };
}

/**
 * Create rate limit middleware
 * 
 * @param {string} limitType - Type of limit ('requests', 'questions', 'answers', etc.)
 * @param {Object} options - Options
 * @returns {Function} Express middleware
 */
function rateLimit(limitType = 'requests', options = {}) {
  const limitConfig = config.rateLimits[limitType];

  if (!limitConfig) {
    throw new Error(`Unknown rate limit type: ${limitType}`);
  }
  
  const {
    skip = () => false,
    keyGenerator = (req) => getKey(req, limitType),
    message = `Rate limit exceeded`,
    limitResolver = null
  } = options;
  
  return async (req, res, next) => {
    try {
      // Check if should skip
      if (await Promise.resolve(skip(req))) {
        return next();
      }
      
      const resolvedLimit = await Promise.resolve(
        limitResolver ? limitResolver(req) : resolveLimit(limitConfig, req)
      );

      const key = await Promise.resolve(keyGenerator(req));
      const result = checkLimit(key, resolvedLimit);
      
      // Set headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000));
      
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter);
        throw new RateLimitError(message, result.retryAfter);
      }
      
      // Attach rate limit info to request
      req.rateLimit = result;
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

function resolveLimit(limitConfig, req) {
  if (typeof limitConfig.max === 'number') {
    return limitConfig;
  }

  const tier = getTier(req);
  return limitConfig[tier] || limitConfig.claimedLow;
}

function getTier(req) {
  const agent = req.agent;

  if (!agent || !agent.isClaimed) {
    return 'unclaimed';
  }

  if (agent.karma < 100) {
    return 'claimedLow';
  }

  if (agent.karma < 1000) {
    return 'claimedMid';
  }

  return 'claimedHigh';
}

/**
 * General request rate limiter (100/min)
 */
const requestLimiter = rateLimit('requests');

/**
 * Question creation rate limiter
 */
const questionLimiter = rateLimit('questions', {
  message: 'Question rate limit exceeded'
});

/**
 * Answer creation rate limiter
 */
const answerLimiter = rateLimit('answers', {
  message: 'Answer rate limit exceeded'
});

/**
 * Vote rate limiter
 */
const voteLimiter = rateLimit('votes', {
  message: 'Vote rate limit exceeded'
});

/**
 * Search rate limiter
 */
const searchLimiter = rateLimit('searches', {
  message: 'Search rate limit exceeded'
});

/**
 * Edit rate limiter
 */
const editLimiter = rateLimit('edits', {
  message: 'Edit rate limit exceeded'
});

/**
 * Tag creation rate limiter
 */
const tagCreateLimiter = rateLimit('tagCreates', {
  message: 'Tag creation rate limit exceeded'
});

module.exports = {
  rateLimit,
  requestLimiter,
  questionLimiter,
  answerLimiter,
  voteLimiter,
  searchLimiter,
  editLimiter,
  tagCreateLimiter
};
