const crypto = require('crypto');
const logger = require('./logger');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'opera-prop-32byte-encryption-key-2024';
const IV_LENGTH = 16;

const encrypt = (text) => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let encrypted = cipher.update(JSON.stringify(text));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (error) {
    logger.error('加密失败:', error);
    throw new Error('数据加密失败');
  }
};

const decrypt = (encryptedText) => {
  try {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedTextBuffer = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedTextBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
  } catch (error) {
    logger.error('解密失败:', error);
    throw new Error('数据解密失败');
  }
};

const generateHash = (data, salt = '') => {
  const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
  return crypto.createHmac('sha256', ENCRYPTION_KEY + salt).update(dataString).digest('hex');
};

const verifySignature = (payload, signature, timestamp) => {
  const currentTimestamp = Date.now();
  const timeWindow = 5 * 60 * 1000;

  if (Math.abs(currentTimestamp - parseInt(timestamp)) > timeWindow) {
    return { valid: false, reason: '请求已过期' };
  }

  const expectedSignature = generateHash(payload, timestamp);
  if (signature !== expectedSignature) {
    return { valid: false, reason: '签名验证失败' };
  }

  return { valid: true };
};

const sanitizeInput = (data) => {
  if (typeof data === 'string') {
    return data.replace(/[<>\"'&]/g, '').trim();
  }
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(sanitizeInput);
    }
    const sanitized = {};
    for (const key in data) {
      sanitized[key] = sanitizeInput(data[key]);
    }
    return sanitized;
  }
  return data;
};

const maskSensitiveData = (data) => {
  if (typeof data === 'object' && data !== null) {
    const masked = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

    for (const field of sensitiveFields) {
      if (masked[field]) {
        const value = String(masked[field]);
        masked[field] = value.length > 6
          ? `${value.slice(0, 3)}***${value.slice(-3)}`
          : '***';
      }
    }

    for (const key in masked) {
      if (typeof masked[key] === 'object') {
        masked[key] = maskSensitiveData(masked[key]);
      }
    }

    return masked;
  }
  return data;
};

const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const rateLimitStore = new Map();

const checkRateLimit = (ip, limit = 100, window = 60000) => {
  const now = Date.now();
  const userRequests = rateLimitStore.get(ip) || [];
  const recentRequests = userRequests.filter(time => now - time < window);

  if (recentRequests.length >= limit) {
    return { allowed: false, remaining: 0, resetTime: Math.min(...recentRequests) + window };
  }

  recentRequests.push(now);
  rateLimitStore.set(ip, recentRequests);

  return {
    allowed: true,
    remaining: limit - recentRequests.length,
    resetTime: now + window
  };
};

setInterval(() => {
  const now = Date.now();
  for (const [ip, requests] of rateLimitStore.entries()) {
    const validRequests = requests.filter(time => now - time < 60000);
    if (validRequests.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, validRequests);
    }
  }
}, 60000);

module.exports = {
  encrypt,
  decrypt,
  generateHash,
  verifySignature,
  sanitizeInput,
  maskSensitiveData,
  generateCSRFToken,
  checkRateLimit
};
