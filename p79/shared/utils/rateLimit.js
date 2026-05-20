const rateLimit = require('express-rate-limit');
const logger = require('./logger');

const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`请求频率超限: ${req.ip} - ${req.method} ${req.path}`);
      res.status(429).json({
        success: false,
        message: '请求频率过高，请稍后再试',
        error: 'TOO_MANY_REQUESTS',
        retryAfter: Math.ceil(options.windowMs / 1000 || 900)
      });
    },
    keyGenerator: (req) => {
      return req.ip || req.connection.remoteAddress || 'unknown';
    },
    ...options
  };

  return rateLimit(defaultOptions);
};

const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'API 请求频率过高，请15分钟后再试'
});

const strictLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 50,
  message: '操作过于频繁，请5分钟后再试'
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: '登录尝试次数过多，请15分钟后再试'
});

const createSlowDown = (options = {}) => {
  const slowDown = require('express-slow-down');
  return slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: (hits) => hits * 100,
    ...options
  });
};

module.exports = {
  createRateLimiter,
  apiLimiter,
  strictLimiter,
  authLimiter,
  createSlowDown
};
