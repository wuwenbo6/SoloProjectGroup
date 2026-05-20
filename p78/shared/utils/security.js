const crypto = require('crypto');

const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }
  return input;
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const result = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
};

const sqlInjectionFilter = (input) => {
  if (typeof input === 'string') {
    const dangerousPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|WHERE)\b)/gi,
      /(--|;|\/\*|\*\/)/g,
      /(['"])\s*(OR|AND)\s*\1\s*=\s*\1/gi,
      /xp_\w+/gi,
      /sp_\w+/gi
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        throw new Error('检测到潜在的SQL注入攻击');
      }
    }
  }
  return input;
};

const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const issues = [];
  
  if (password.length < minLength) issues.push('密码长度至少8位');
  if (!hasUpperCase) issues.push('密码需包含大写字母');
  if (!hasLowerCase) issues.push('密码需包含小写字母');
  if (!hasNumbers) issues.push('密码需包含数字');
  if (!hasSpecialChar) issues.push('密码需包含特殊字符');
  
  return {
    valid: issues.length === 0,
    issues,
    strength: issues.length === 0 ? 'strong' : issues.length <= 2 ? 'medium' : 'weak'
  };
};

const maskSensitiveData = (data, type = 'default') => {
  if (!data) return data;
  
  const str = String(data);
  
  switch (type) {
    case 'phone':
      if (str.length >= 11) {
        return str.slice(0, 3) + '****' + str.slice(-4);
      }
      return str;
      
    case 'email':
      const [local, domain] = str.split('@');
      if (local && domain) {
        const maskedLocal = local.length > 3 
          ? local.slice(0, 3) + '*'.repeat(local.length - 3) 
          : '*'.repeat(local.length);
        return `${maskedLocal}@${domain}`;
      }
      return str;
      
    case 'idcard':
      if (str.length >= 18) {
        return str.slice(0, 6) + '********' + str.slice(-4);
      }
      return str;
      
    case 'name':
      if (str.length <= 1) return str;
      if (str.length === 2) return str[0] + '*';
      return str[0] + '*'.repeat(str.length - 2) + str.slice(-1);
      
    default:
      if (str.length <= 4) return '*'.repeat(str.length);
      return str.slice(0, 2) + '*'.repeat(Math.min(str.length - 4, 8)) + str.slice(-2);
  }
};

const generateRandomToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('base64url');
};

const verifyCSRFToken = (token, storedToken) => {
  if (!token || !storedToken) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(storedToken));
  } catch {
    return false;
  }
};

const createSecureHash = (data, salt = null) => {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
};

const verifySecureHash = (data, hash, salt) => {
  const verifyHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
};

const validateUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const validateBatchNo = (batchNo) => {
  const batchNoRegex = /^[A-Z0-9-]{6,32}$/i;
  return batchNoRegex.test(batchNo);
};

const auditLog = (action, user, resource, details = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    user_id: user?.id,
    username: user?.username,
    resource,
    ip: details.ip,
    user_agent: details.userAgent,
    success: details.success !== false,
    ...details
  };
  
  console.log('[AUDIT]', JSON.stringify(logEntry));
  return logEntry;
};

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const addSecurityHeaders = (req, res, next) => {
  for (const [key, value] of Object.entries(securityHeaders)) {
    res.setHeader(key, value);
  }
  next();
};

const rateLimit = (options = {}) => {
  const {
    windowMs = 60 * 1000,
    max = 100,
    message = '请求过于频繁，请稍后再试'
  } = options;
  
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const windowStart = now - windowMs;
    const recentRequests = requests.get(key).filter(time => time > windowStart);
    requests.set(key, recentRequests);
    
    if (recentRequests.length >= max) {
      return res.status(429).json({
        success: false,
        message,
        retry_after: Math.ceil(windowMs / 1000)
      });
    }
    
    recentRequests.push(now);
    next();
  };
};

module.exports = {
  sanitizeInput,
  sanitizeObject,
  sqlInjectionFilter,
  validateEmail,
  validatePassword,
  maskSensitiveData,
  generateRandomToken,
  generateCSRFToken,
  verifyCSRFToken,
  createSecureHash,
  verifySecureHash,
  validateUUID,
  validateBatchNo,
  auditLog,
  addSecurityHeaders,
  rateLimit
};
