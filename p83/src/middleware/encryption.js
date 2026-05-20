const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-secret-key-here-!';
const IV_LENGTH = 16;
const NONCE_LENGTH = 12;
const KEY_LENGTH = 32;

const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY || ENCRYPTION_KEY;
  return crypto.createHash('sha256').update(key).digest();
};

const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (encryptedText) => {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: ' + error.message);
  }
};

const encryptGCM = (text) => {
  const nonce = crypto.randomBytes(NONCE_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), nonce);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return nonce.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
};

const decryptGCM = (encryptedText) => {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    const nonce = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), nonce);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: ' + error.message);
  }
};

const generateSignature = (data, timestamp, nonce) => {
  const payload = JSON.stringify(data) + timestamp + nonce;
  return crypto
    .createHmac('sha256', getEncryptionKey())
    .update(payload)
    .digest('hex');
};

const verifySignature = (data, timestamp, nonce, signature) => {
  const expectedSignature = generateSignature(data, timestamp, nonce);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

const requestDecrypt = (req, res, next) => {
  const encryptionHeader = req.headers['x-encrypted'];
  if (!encryptionHeader || encryptionHeader !== 'true') {
    return next();
  }

  try {
    if (req.body && req.body.encrypted) {
      const decrypted = decryptGCM(req.body.encrypted);
      req.body = JSON.parse(decrypted);
      req.decrypted = true;
    }
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: '请求解密失败',
      code: 'DECRYPTION_ERROR'
    });
  }
};

const responseEncrypt = (req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    const encryptionHeader = req.headers['x-encrypt-response'];
    if (encryptionHeader === 'true' && typeof data === 'string') {
      try {
        const encrypted = encryptGCM(data);
        res.setHeader('x-encrypted', 'true');
        return originalSend.call(this, JSON.stringify({ encrypted }));
      } catch (error) {
        return originalSend.call(this, data);
      }
    }
    return originalSend.call(this, data);
  };
  next();
};

const signatureValidation = (req, res, next) => {
  const requireSignature = process.env.REQUIRE_SIGNATURE === 'true';
  if (!requireSignature) {
    return next();
  }

  const timestamp = req.headers['x-timestamp'];
  const nonce = req.headers['x-nonce'];
  const signature = req.headers['x-signature'];

  if (!timestamp || !nonce || !signature) {
    return res.status(400).json({
      success: false,
      message: '缺少签名验证头',
      code: 'MISSING_SIGNATURE_HEADERS'
    });
  }

  const now = Date.now();
  const requestTime = parseInt(timestamp);
  const timeDiff = Math.abs(now - requestTime);
  const maxTimeDiff = 5 * 60 * 1000;

  if (timeDiff > maxTimeDiff) {
    return res.status(400).json({
      success: false,
      message: '请求已过期',
      code: 'REQUEST_EXPIRED'
    });
  }

  try {
    const isValid = verifySignature(req.body, timestamp, nonce, signature);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: '签名验证失败',
        code: 'INVALID_SIGNATURE'
      });
    }
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: '签名验证失败',
      code: 'SIGNATURE_VERIFICATION_ERROR'
    });
  }
};

const cryptoRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const encryptSensitiveData = (data, sensitiveFields = []) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const result = { ...data };
  
  sensitiveFields.forEach(field => {
    if (result[field]) {
      result[field] = encrypt(result[field].toString());
      result[`${field}_encrypted`] = true;
    }
  });

  return result;
};

const decryptSensitiveData = (data, sensitiveFields = []) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const result = { ...data };
  
  sensitiveFields.forEach(field => {
    if (result[`${field}_encrypted`] && result[field]) {
      try {
        result[field] = decrypt(result[field]);
        delete result[`${field}_encrypted`];
      } catch (error) {
      }
    }
  });

  return result;
};

const hashSensitiveData = (data, algorithm = 'sha256') => {
  return crypto
    .createHash(algorithm)
    .update(data.toString())
    .digest('hex');
};

const generateApiKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

const generateSecret = () => {
  return crypto.randomBytes(64).toString('base64');
};

module.exports = {
  encrypt,
  decrypt,
  encryptGCM,
  decryptGCM,
  generateSignature,
  verifySignature,
  requestDecrypt,
  responseEncrypt,
  signatureValidation,
  cryptoRateLimiter,
  encryptSensitiveData,
  decryptSensitiveData,
  hashSensitiveData,
  generateApiKey,
  generateSecret
};
