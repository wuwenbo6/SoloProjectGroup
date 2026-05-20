const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;
const REQUEST_TIMEOUT = 5 * 60 * 1000;
const NONCE_CACHE_SIZE = 10000;

const usedNonces = new Map();

const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(JSON.stringify(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (encryptedText) => {
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = parts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (err) {
    throw new Error('解密失败: 数据可能已被篡改');
  }
};

const generateSignature = (data, timestamp, nonce, method, path) => {
  const signString = `${timestamp}:${nonce}:${method}:${path}:${JSON.stringify(data)}:${ENCRYPTION_KEY}`;
  return crypto.createHash('sha256').update(signString).digest('hex');
};

const verifySignature = (data, signature, timestamp, nonce, method, path) => {
  const expectedSignature = generateSignature(data, timestamp, nonce, method, path);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};

const isReplayAttack = (nonce, timestamp) => {
  const now = Date.now();
  
  if (Math.abs(now - timestamp) > REQUEST_TIMEOUT) {
    return true;
  }
  
  if (usedNonces.has(nonce)) {
    return true;
  }
  
  usedNonces.set(nonce, now);
  if (usedNonces.size > NONCE_CACHE_SIZE) {
    const oldest = Array.from(usedNonces.keys()).slice(0, 1000);
    oldest.forEach(key => usedNonces.delete(key));
  }
  
  return false;
};

const requestEncryptionMiddleware = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'DELETE') {
    return next();
  }

  const contentType = req.headers['content-type'];
  if (contentType && contentType.includes('multipart/form-data')) {
    return next();
  }

  if (req.headers['x-encrypted'] === 'true') {
    try {
      if (!req.body || !req.body.encrypted_data) {
        return res.status(400).json({
          success: false,
          message: '缺少加密数据'
        });
      }

      const timestamp = parseInt(req.headers['x-timestamp']);
      const nonce = req.headers['x-nonce'];
      const signature = req.headers['x-signature'];

      if (!timestamp || !nonce || !signature) {
        return res.status(400).json({
          success: false,
          message: '缺少安全头信息'
        });
      }

      if (isReplayAttack(nonce, timestamp)) {
        return res.status(401).json({
          success: false,
          message: '请求已过期或存在重放攻击'
        });
      }

      const decryptedData = decrypt(req.body.encrypted_data);
      
      if (!verifySignature(decryptedData, signature, timestamp, nonce, req.method, req.path)) {
        return res.status(401).json({
          success: false,
          message: '签名验证失败，数据可能已被篡改'
        });
      }

      req.body = decryptedData;
      req.isEncrypted = true;
      next();
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message || '请求解密失败'
      });
    }
  } else {
    next();
  }
};

const responseEncryptionMiddleware = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (req.isEncrypted && req.headers['x-encrypt-response'] === 'true') {
      try {
        const encryptedData = encrypt(data);
        const timestamp = Date.now();
        const nonce = crypto.randomBytes(16).toString('hex');
        const signature = generateSignature(data, timestamp, nonce, req.method, req.path);
        
        res.setHeader('x-encrypted', 'true');
        res.setHeader('x-timestamp', timestamp);
        res.setHeader('x-nonce', nonce);
        res.setHeader('x-signature', signature);
        
        return originalSend.call(res, { encrypted_data: encryptedData });
      } catch (err) {
        console.error('响应加密失败:', err);
      }
    }
    return originalSend.call(res, data);
  };
  
  next();
};

const encryptSensitiveData = (data, fields = []) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const result = { ...data };
  
  fields.forEach(field => {
    if (result[field] !== undefined) {
      result[field] = encrypt(result[field]);
      result[`${field}_encrypted`] = true;
    }
  });
  
  return result;
};

const decryptSensitiveData = (data, fields = []) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const result = { ...data };
  
  fields.forEach(field => {
    if (result[`${field}_encrypted`] && result[field]) {
      try {
        result[field] = decrypt(result[field]);
        delete result[`${field}_encrypted`];
      } catch (err) {
        console.error(`解密字段 ${field} 失败:`, err);
      }
    }
  });
  
  return result;
};

const hashSensitiveData = (data, algorithm = 'sha256') => {
  return crypto.createHash(algorithm).update(String(data)).digest('hex');
};

const generateApiKey = () => {
  return 'ak_' + crypto.randomBytes(32).toString('hex');
};

const generateApiSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

module.exports = {
  encrypt,
  decrypt,
  generateSignature,
  verifySignature,
  requestEncryptionMiddleware,
  responseEncryptionMiddleware,
  encryptSensitiveData,
  decryptSensitiveData,
  hashSensitiveData,
  generateApiKey,
  generateApiSecret,
  ENCRYPTION_KEY
};
