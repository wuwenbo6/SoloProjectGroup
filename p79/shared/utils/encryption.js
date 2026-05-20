const crypto = require('crypto');
const logger = require('./logger');
const { AppError } = require('./errorHandler');

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const NONCE_EXPIRE_TIME = 5 * 60 * 1000;

const usedNonces = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [nonce, timestamp] of usedNonces.entries()) {
    if (now - timestamp > NONCE_EXPIRE_TIME) {
      usedNonces.delete(nonce);
    }
  }
}, 60000);

const getSecretKey = () => {
  const key = process.env.ENCRYPTION_SECRET_KEY || 'default-secret-key-change-in-production';
  return crypto.scryptSync(key, 'salt', 32);
};

const encrypt = (data) => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getSecretKey();
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag().toString('base64');

    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag,
      algorithm: ENCRYPTION_ALGORITHM
    };
  } catch (error) {
    logger.error('加密失败:', error);
    throw new AppError('数据加密失败', 500);
  }
};

const decrypt = (encryptedData, iv, authTag) => {
  try {
    const key = getSecretKey();
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(iv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    logger.error('解密失败:', error);
    throw new AppError('数据解密失败，数据可能被篡改', 400);
  }
};

const generateSignature = (data, timestamp, nonce) => {
  const key = getSecretKey();
  const signatureString = `${JSON.stringify(data)}${timestamp}${nonce}`;
  return crypto
    .createHmac('sha256', key)
    .update(signatureString)
    .digest('hex');
};

const verifySignature = (data, timestamp, nonce, signature) => {
  const expectedSignature = generateSignature(data, timestamp, nonce);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

const validateNonce = (nonce) => {
  if (usedNonces.has(nonce)) {
    return false;
  }
  usedNonces.set(nonce, Date.now());
  return true;
};

const encryptionMiddleware = (req, res, next) => {
  const contentType = req.get('Content-Type');
  const encryptionHeader = req.get('X-Encryption');

  if (encryptionHeader === 'enabled' && contentType === 'application/json') {
    try {
      const { encryptedData, iv, authTag, timestamp, nonce, signature } = req.body;

      if (!encryptedData || !iv || !authTag || !timestamp || !nonce || !signature) {
        throw new AppError('缺少加密必需的参数', 400);
      }

      const timeDiff = Math.abs(Date.now() - parseInt(timestamp));
      if (timeDiff > NONCE_EXPIRE_TIME) {
        throw new AppError('请求已过期，请重试', 401);
      }

      if (!validateNonce(nonce)) {
        throw new AppError('请求重复，请不要重复提交', 409);
      }

      const decryptedData = decrypt(encryptedData, iv, authTag);

      if (!verifySignature(decryptedData, timestamp, nonce, signature)) {
        logger.warn(`签名验证失败: IP=${req.ip}, Path=${req.path}`);
        throw new AppError('签名验证失败，数据可能被篡改', 403);
      }

      req.body = decryptedData;
      req.isEncrypted = true;

      logger.debug(`请求解密成功: ${req.method} ${req.path}`);
    } catch (error) {
      return next(error);
    }
  }

  const originalSend = res.send;
  res.send = function(data) {
    const acceptEncryption = req.get('X-Accept-Encryption');
    
    if (acceptEncryption === 'enabled' && typeof data === 'object') {
      try {
        const timestamp = Date.now().toString();
        const nonce = crypto.randomBytes(16).toString('hex');
        const encrypted = encrypt(data);
        const signature = generateSignature(data, timestamp, nonce);

        res.setHeader('X-Encryption', 'enabled');
        res.setHeader('Content-Type', 'application/json');
        
        return originalSend.call(this, JSON.stringify({
          ...encrypted,
          timestamp,
          nonce,
          signature
        }));
      } catch (error) {
        logger.error('响应加密失败:', error);
      }
    }

    return originalSend.call(this, data);
  };

  next();
};

const hashData = (data) => {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
};

const generateApiKey = () => {
  return 'ak_' + crypto.randomBytes(32).toString('hex');
};

const encryptPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString('hex');
  return { salt, hash };
};

const verifyPassword = (password, salt, hash) => {
  const verifyHash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
};

module.exports = {
  encrypt,
  decrypt,
  generateSignature,
  verifySignature,
  encryptionMiddleware,
  hashData,
  generateApiKey,
  encryptPassword,
  verifyPassword
};
