const { verifySignature, sanitizeInput, checkRateLimit, decrypt, encrypt } = require('../config/security');
const logger = require('../config/logger');

const requestDecryption = (req, res, next) => {
  try {
    if (req.headers['x-encrypted'] === 'true' && req.body && req.body.encryptedData) {
      const decryptedData = decrypt(req.body.encryptedData);
      req.body = decryptedData;
      logger.info('请求数据解密成功');
    }
    next();
  } catch (error) {
    logger.error('请求解密失败:', error);
    res.status(400).json({
      success: false,
      message: '请求数据解密失败',
      error: error.message
    });
  }
};

const responseEncryption = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    try {
      if (req.headers['x-accept-encrypted'] === 'true' && data) {
        const encryptedData = encrypt(data);
        return originalJson.call(this, {
          encrypted: true,
          data: encryptedData
        });
      }
      return originalJson.call(this, data);
    } catch (error) {
      logger.error('响应加密失败:', error);
      return originalJson.call(this, data);
    }
  };

  next();
};

const signatureValidation = (req, res, next) => {
  try {
    const sensitiveRoutes = ['/api/auth', '/api/quality', '/api/third-party'];
    const isSensitiveRoute = sensitiveRoutes.some(route => req.path.startsWith(route));

    if (isSensitiveRoute && req.method !== 'GET') {
      const signature = req.headers['x-signature'];
      const timestamp = req.headers['x-timestamp'];

      if (!signature || !timestamp) {
        return res.status(400).json({
          success: false,
          message: '缺少签名或时间戳'
        });
      }

      const verification = verifySignature(req.body, signature, timestamp);
      if (!verification.valid) {
        logger.warn(`签名验证失败: ${verification.reason} - IP: ${req.ip}`);
        return res.status(403).json({
          success: false,
          message: verification.reason
        });
      }
    }
    next();
  } catch (error) {
    logger.error('签名验证异常:', error);
    res.status(500).json({
      success: false,
      message: '签名验证失败'
    });
  }
};

const inputSanitization = (req, res, next) => {
  try {
    if (req.body) {
      req.body = sanitizeInput(req.body);
    }
    if (req.query) {
      req.query = sanitizeInput(req.query);
    }
    if (req.params) {
      req.params = sanitizeInput(req.params);
    }
    next();
  } catch (error) {
    logger.error('输入清理异常:', error);
    next();
  }
};

const enhancedRateLimit = (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const isAuthRoute = req.path.startsWith('/api/auth');
    const limit = isAuthRoute ? 10 : 100;
    const window = isAuthRoute ? 300000 : 60000;

    const rateCheck = checkRateLimit(ip, limit, window);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);
    res.setHeader('X-RateLimit-Reset', rateCheck.resetTime);

    if (!rateCheck.allowed) {
      logger.warn(`速率限制触发 - IP: ${ip}, 路由: ${req.path}`);
      return res.status(429).json({
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil((rateCheck.resetTime - Date.now()) / 1000)
      });
    }

    next();
  } catch (error) {
    logger.error('速率限制检查异常:', error);
    next();
  }
};

const csrfProtection = (req, res, next) => {
  if (req.method === 'GET') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] || req.body.csrfToken;
  const sessionToken = req.session?.csrfToken;

  if (!csrfToken || csrfToken !== sessionToken) {
    logger.warn(`CSRF 验证失败 - IP: ${req.ip}`);
    return res.status(403).json({
      success: false,
      message: 'CSRF 令牌无效'
    });
  }

  next();
};

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.removeHeader('X-Powered-By');
  next();
};

const auditLog = (req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function(data) {
    const duration = Date.now() - start;
    const userInfo = req.user ? { userId: req.user.id, role: req.user.role } : {};

    logger.info('请求审计', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ...userInfo
    });

    return originalSend.call(this, data);
  };

  next();
};

module.exports = {
  requestDecryption,
  responseEncryption,
  signatureValidation,
  inputSanitization,
  enhancedRateLimit,
  csrfProtection,
  securityHeaders,
  auditLog
};
