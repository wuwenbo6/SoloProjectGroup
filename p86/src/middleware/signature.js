const crypto = require('crypto');

const SIGNATURE_ALGORITHM = 'sha256';
const SIGNATURE_HEADER = 'x-signature';
const TIMESTAMP_HEADER = 'x-timestamp';
const NONCE_HEADER = 'x-nonce';
const ACCESS_KEY_HEADER = 'x-access-key';
const MAX_TIMESTAMP_DIFF = 5 * 60 * 1000;

const nonceCache = new Map();

const cleanExpiredNonces = () => {
  const now = Date.now();
  for (const [nonce, timestamp] of nonceCache.entries()) {
    if (now - timestamp > MAX_TIMESTAMP_DIFF) {
      nonceCache.delete(nonce);
    }
  }
};

setInterval(cleanExpiredNonces, 60 * 1000);

const generateSignature = (payload, secretKey, timestamp, nonce) => {
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const data = `${timestamp}\n${nonce}\n${payloadStr}`;
  return crypto
    .createHmac(SIGNATURE_ALGORITHM, secretKey)
    .update(data)
    .digest('hex');
};

const getSecretKey = (accessKey) => {
  const apiKeys = {
    [process.env.API_ACCESS_KEY || 'woodcarving_api_key']: process.env.API_SECRET_KEY || 'woodcarving_secret_key_2024',
  };
  return apiKeys[accessKey];
};

const signatureVerification = (options = {}) => {
  return async (req, res, next) => {
    if (options.skipPaths && options.skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    if (options.skipMethods && options.skipMethods.includes(req.method)) {
      return next();
    }

    const signature = req.get(SIGNATURE_HEADER);
    const timestamp = req.get(TIMESTAMP_HEADER);
    const nonce = req.get(NONCE_HEADER);
    const accessKey = req.get(ACCESS_KEY_HEADER);

    if (!signature || !timestamp || !nonce || !accessKey) {
      return res.status(401).json({
        success: false,
        message: '缺少签名验证头信息',
        requiredHeaders: [SIGNATURE_HEADER, TIMESTAMP_HEADER, NONCE_HEADER, ACCESS_KEY_HEADER],
      });
    }

    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime)) {
      return res.status(401).json({
        success: false,
        message: '无效的时间戳格式',
      });
    }

    const now = Date.now();
    if (Math.abs(now - requestTime) > MAX_TIMESTAMP_DIFF) {
      return res.status(401).json({
        success: false,
        message: '请求已过期，请检查系统时间',
        serverTime: now,
        requestTime,
      });
    }

    if (nonceCache.has(nonce)) {
      return res.status(401).json({
        success: false,
        message: '重复请求，请更换nonce重试',
      });
    }
    nonceCache.set(nonce, requestTime);

    const secretKey = getSecretKey(accessKey);
    if (!secretKey) {
      return res.status(401).json({
        success: false,
        message: '无效的访问密钥',
      });
    }

    let payload = '';
    if (req.method === 'GET' || req.method === 'DELETE') {
      payload = JSON.stringify(req.query);
    } else {
      payload = JSON.stringify(req.body);
    }

    const expectedSignature = generateSignature(payload, secretKey, timestamp, nonce);

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return res.status(401).json({
        success: false,
        message: '签名验证失败',
      });
    }

    req.signatureVerified = true;
    req.accessKey = accessKey;
    next();
  };
};

const encryptData = (data, secretKey) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey).slice(0, 32), iv);
  let encrypted = cipher.update(typeof data === 'string' ? data : JSON.stringify(data));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decryptData = (encryptedData, secretKey) => {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey).slice(0, 32), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

const responseEncryption = (options = {}) => {
  return (req, res, next) => {
    const originalJson = res.json;
    res.json = function(data) {
      const shouldEncrypt = req.get('x-encrypt-response') === 'true' || options.alwaysEncrypt;

      if (shouldEncrypt && req.accessKey) {
        const secretKey = getSecretKey(req.accessKey);
        if (secretKey) {
          const encrypted = encryptData(data, secretKey);
          return originalJson.call(this, {
            encrypted: true,
            data: encrypted,
          });
        }
      }

      return originalJson.call(this, data);
    };
    next();
  };
};

const sanitizeInput = (options = {}) => {
  return (req, res, next) => {
    const sanitize = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;

      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          result[key] = value
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .trim();
        } else if (typeof value === 'object') {
          result[key] = sanitize(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    if (req.body && typeof req.body === 'object') {
      req.body = sanitize(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitize(req.query);
    }

    next();
  };
};

const rateLimitByUser = (options = {}) => {
  const userRequests = new Map();
  const maxRequests = options.maxRequests || 100;
  const windowMs = options.windowMs || 60 * 1000;

  return (req, res, next) => {
    const userId = req.user?._id?.toString() || req.ip;
    const now = Date.now();

    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }

    const requests = userRequests.get(userId);
    const windowStart = now - windowMs;
    const recentRequests = requests.filter(time => time > windowStart);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: '请求过于频繁，请稍后再试',
        limit: maxRequests,
        windowSeconds: windowMs / 1000,
      });
    }

    recentRequests.push(now);
    userRequests.set(userId, recentRequests);
    next();
  };
};

const auditLog = (options = {}) => {
  return (req, res, next) => {
    const startTime = Date.now();
    const originalEnd = res.end;

    res.end = function(...args) {
      const duration = Date.now() - startTime;
      const log = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.user?._id,
        statusCode: res.statusCode,
        durationMs: duration,
        userAgent: req.get('user-agent'),
      };

      if (options.logSuccess || res.statusCode >= 400) {
        console.log('[Audit]', JSON.stringify(log));
      }

      return originalEnd.apply(this, args);
    };

    next();
  };
};

module.exports = {
  signatureVerification,
  generateSignature,
  encryptData,
  decryptData,
  responseEncryption,
  sanitizeInput,
  rateLimitByUser,
  auditLog,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  NONCE_HEADER,
  ACCESS_KEY_HEADER,
};
