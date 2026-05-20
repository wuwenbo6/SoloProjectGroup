const rateLimitMap = new Map();

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_REQUESTS = 100;

const getClientIP = (req) => {
  return req.ip || 
    req.connection?.remoteAddress || 
    req.socket?.remoteAddress || 
    req.connection?.socket?.remoteAddress || 
    'unknown';
};

exports.rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = options.max || DEFAULT_MAX_REQUESTS;
  const keyPrefix = options.keyPrefix || 'global';

  return (req, res, next) => {
    const clientIP = getClientIP(req);
    const key = `${keyPrefix}:${clientIP}`;

    const now = Date.now();
    const windowStart = now - windowMs;

    let requestHistory = rateLimitMap.get(key) || [];
    requestHistory = requestHistory.filter(time => time > windowStart);

    if (requestHistory.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    }

    requestHistory.push(now);
    rateLimitMap.set(key, requestHistory);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - requestHistory.length);
    res.setHeader('X-RateLimit-Reset', Math.ceil(windowStart / 1000));

    next();
  };
};

exports.apiRateLimiter = exports.rateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  keyPrefix: 'api',
});

exports.authRateLimiter = exports.rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'auth',
});

exports.batchRateLimiter = exports.rateLimiter({
  windowMs: 60 * 1000,
  max: 50,
  keyPrefix: 'batch',
});

const cleanupRateLimitMap = () => {
  const now = Date.now();
  const maxAge = 2 * 60 * 1000;
  
  for (const [key, history] of rateLimitMap) {
    const filtered = history.filter(time => time > (now - maxAge));
    if (filtered.length === 0) {
      rateLimitMap.delete(key);
    } else if (filtered.length !== history.length) {
      rateLimitMap.set(key, filtered);
    }
  }
};

setInterval(cleanupRateLimitMap, 5 * 60 * 1000);
