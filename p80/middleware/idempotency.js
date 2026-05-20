const crypto = require('crypto');
const logger = require('../utils/logger');

const idempotencyCache = new Map();

const CACHE_TTL = 5 * 60 * 1000;

const generateRequestHash = (req) => {
  const bodyStr = JSON.stringify(req.body || {});
  const userId = req.user?.id || 'anonymous';
  const path = req.path;
  
  return crypto
    .createHash('sha256')
    .update(`${userId}:${path}:${bodyStr}`)
    .digest('hex');
};

const idempotencyMiddleware = (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return next();
  }

  const requestHash = generateRequestHash(req);

  if (idempotencyCache.has(requestHash)) {
    const cachedResponse = idempotencyCache.get(requestHash);
    if (Date.now() - cachedResponse.timestamp < CACHE_TTL) {
      logger.warn(`Detected duplicate request: ${req.path}, hash: ${requestHash}`);
      return res.status(409).json({
        error: '重复请求',
        message: '检测到重复提交，请稍后再试',
        requestId: requestHash,
        previousResult: cachedResponse.data
      });
    } else {
      idempotencyCache.delete(requestHash);
    }
  }

  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (res.statusCode < 400) {
      idempotencyCache.set(requestHash, {
        timestamp: Date.now(),
        data: data
      });
    }
    return originalJson(data);
  };

  req.idempotencyKey = requestHash;
  
  next();
};

const clearIdempotencyCache = () => {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      idempotencyCache.delete(key);
    }
  }
};

setInterval(clearIdempotencyCache, 60 * 1000);

module.exports = {
  idempotencyMiddleware,
  generateRequestHash
};
