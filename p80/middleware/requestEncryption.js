const crypto = require('crypto');
const logger = require('../utils/logger');

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

class RequestEncryption {
  constructor() {
    this.masterKey = process.env.ENCRYPTION_MASTER_KEY || 'default-secret-key-change-in-production-32-chars';
    this.requestTimeout = parseInt(process.env.REQUEST_TIMEOUT) || 5 * 60 * 1000;
    this.nonceCache = new Set();
  }

  generateKey(salt) {
    return crypto.pbkdf2Sync(this.masterKey, salt, 100000, 32, 'sha256');
  }

  encrypt(text, customKey = null) {
    try {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key = customKey || this.generateKey(salt);
      const iv = crypto.randomBytes(IV_LENGTH);
      
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const authTag = cipher.getAuthTag().toString('base64');
      
      return {
        encrypted,
        iv: iv.toString('base64'),
        salt: salt.toString('base64'),
        authTag,
        algorithm: ENCRYPTION_ALGORITHM
      };
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('加密失败');
    }
  }

  decrypt(encryptedData, customKey = null) {
    try {
      const { encrypted, iv, salt, authTag } = encryptedData;
      const key = customKey || this.generateKey(Buffer.from(salt, 'base64'));
      
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_ALGORITHM,
        key,
        Buffer.from(iv, 'base64')
      );
      decipher.setAuthTag(Buffer.from(authTag, 'base64'));
      
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('解密失败');
    }
  }

  generateSignature(payload, timestamp, nonce) {
    const message = `${timestamp}:${nonce}:${payload}`;
    return crypto
      .createHmac('sha256', this.masterKey)
      .update(message)
      .digest('hex');
  }

  verifySignature(payload, timestamp, nonce, signature) {
    const expectedSignature = this.generateSignature(payload, timestamp, nonce);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  isValidNonce(nonce) {
    if (this.nonceCache.has(nonce)) {
      return false;
    }
    this.nonceCache.add(nonce);
    setTimeout(() => {
      this.nonceCache.delete(nonce);
    }, this.requestTimeout + 1000);
    return true;
  }

  isTimestampValid(timestamp) {
    const now = Date.now();
    const diff = Math.abs(now - parseInt(timestamp));
    return diff <= this.requestTimeout;
  }

  hashData(data, algorithm = 'sha256') {
    return crypto
      .createHash(algorithm)
      .update(JSON.stringify(data))
      .digest('hex');
  }

  generateApiKey() {
    return `ak_${crypto.randomBytes(24).toString('hex')}`;
  }

  generateApiSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  maskSensitiveData(data, fields) {
    const masked = { ...data };
    fields.forEach(field => {
      if (masked[field]) {
        const value = String(masked[field]);
        if (value.length > 6) {
          masked[field] = value.substring(0, 2) + '***' + value.substring(value.length - 2);
        } else {
          masked[field] = '***';
        }
      }
    });
    return masked;
  }
}

const encryption = new RequestEncryption();

const requestEncryptionMiddleware = (options = {}) => {
  const {
    encryptResponse = true,
    verifySignature = true,
    sensitiveFields = ['password', 'secret', 'token', 'apiKey']
  } = options;

  return (req, res, next) => {
    try {
      const encryptedPayload = req.headers['x-encrypted-payload'] === 'true';
      const requiresEncryption = req.path.includes('/sensitive/') || req.path.includes('/auth/');

      if (encryptedPayload || requiresEncryption) {
        if (verifySignature) {
          const timestamp = req.headers['x-timestamp'];
          const nonce = req.headers['x-nonce'];
          const signature = req.headers['x-signature'];

          if (!timestamp || !nonce || !signature) {
            return res.status(400).json({
              error: '缺少加密请求头',
              message: '需要 x-timestamp, x-nonce, x-signature 头'
            });
          }

          if (!encryption.isTimestampValid(timestamp)) {
            return res.status(401).json({
              error: '请求超时',
              message: '请求已过期，请重新发送'
            });
          }

          if (!encryption.isValidNonce(nonce)) {
            return res.status(401).json({
              error: '重复请求',
              message: '检测到重放攻击'
            });
          }

          const payload = JSON.stringify(req.body || {});
          if (!encryption.verifySignature(payload, timestamp, nonce, signature)) {
            return res.status(401).json({
              error: '签名验证失败',
              message: '请求签名无效'
            });
          }
        }

        if (encryptedPayload && req.body?.encryptedData) {
          try {
            const decrypted = encryption.decrypt(req.body.encryptedData);
            req.body = JSON.parse(decrypted);
          } catch (decryptError) {
            return res.status(400).json({
              error: '解密失败',
              message: '无法解密请求数据'
            });
          }
        }
      }

      if (req.body && Object.keys(req.body).length > 0) {
        req.body = encryption.maskSensitiveData(req.body, sensitiveFields);
      }

      if (encryptResponse) {
        const originalJson = res.json.bind(res);
        res.json = (data) => {
          if (res.statusCode < 400 && requiresEncryption) {
            const encrypted = encryption.encrypt(JSON.stringify(data));
            return originalJson({
              encrypted: true,
              data: encrypted
            });
          }
          return originalJson(data);
        };
      }

      req.encryption = encryption;
      next();
    } catch (error) {
      logger.error('加密中间件错误:', error);
      res.status(500).json({
        error: '加密处理失败',
        message: error.message
      });
    }
  };
};

const sensitiveDataMiddleware = (req, res, next) => {
  const sensitivePaths = ['/auth/', '/permissions/', '/settings/'];
  const isSensitive = sensitivePaths.some(path => req.path.includes(path));

  if (isSensitive) {
    req.headers['x-encrypted-payload'] = 'true';
  }

  next();
};

const auditLogMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send.bind(res);
  
  res.send = (body) => {
    const duration = Date.now() - startTime;
    const auditLog = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: req.user?.id,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      hasSignature: !!req.headers['x-signature'],
      isEncrypted: req.headers['x-encrypted-payload'] === 'true'
    };
    logger.info('API调用审计:', auditLog);
    return originalSend(body);
  };
  
  next();
};

module.exports = {
  RequestEncryption,
  requestEncryptionMiddleware,
  sensitiveDataMiddleware,
  auditLogMiddleware,
  encryption
};
