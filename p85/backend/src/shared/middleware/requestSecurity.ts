import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from './logger';
import { errorResponse } from '../utils/response';

export interface ApiKeyConfig {
  id: string;
  key: string;
  secret: string;
  name: string;
  enabled: boolean;
  rateLimit: number;
  allowedIPs?: string[];
  expiresAt?: Date;
}

const apiKeysStore = new Map<string, ApiKeyConfig>();

apiKeysStore.set('pk_live_default', {
  id: 'pk_live_default',
  key: 'pk_live_default',
  secret: 'sk_live_default_secret_2024',
  name: '默认API密钥',
  enabled: true,
  rateLimit: 1000,
});

export function generateApiKey(name: string, rateLimit = 1000): ApiKeyConfig {
  const id = `pk_live_${crypto.randomBytes(16).toString('hex')}`;
  const secret = `sk_live_${crypto.randomBytes(32).toString('hex')}`;

  const config: ApiKeyConfig = {
    id,
    key: id,
    secret,
    name,
    enabled: true,
    rateLimit,
  };

  apiKeysStore.set(id, config);
  return config;
}

export function validateApiKey(apiKey: string): ApiKeyConfig | null {
  const config = apiKeysStore.get(apiKey);
  if (!config || !config.enabled) {
    return null;
  }
  if (config.expiresAt && new Date() > config.expiresAt) {
    return null;
  }
  return config;
}

export function generateSignature(
  method: string,
  path: string,
  timestamp: number,
  body: any,
  secret: string
): string {
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body || {});
  const data = `${method.toUpperCase()}|${path}|${timestamp}|${bodyString}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function verifySignature(
  method: string,
  path: string,
  timestamp: number,
  body: any,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateSignature(method, path, timestamp, body, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

const requestTimestamps = new Map<string, number[]>();
const MAX_TIMESTAMP_WINDOW = 5 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 5;

export function signatureValidationMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  const timestamp = parseInt(req.headers['x-timestamp'] as string);
  const signature = req.headers['x-signature'] as string;
  const nonce = req.headers['x-nonce'] as string;

  if (!apiKey || !timestamp || !signature || !nonce) {
    return res.status(401).json(errorResponse('缺少安全验证头信息', 401));
  }

  const keyConfig = validateApiKey(apiKey);
  if (!keyConfig) {
    return res.status(401).json(errorResponse('无效的API密钥', 401));
  }

  if (keyConfig.allowedIPs && keyConfig.allowedIPs.length > 0) {
    const clientIP = req.ip || req.socket.remoteAddress;
    if (!clientIP || !keyConfig.allowedIPs.includes(clientIP)) {
      logger.warn(`IP address not allowed: ${clientIP}`);
      return res.status(403).json(errorResponse('IP地址未授权', 403));
    }
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) > MAX_TIMESTAMP_WINDOW) {
    logger.warn(`Request timestamp expired: ${timestamp} vs ${now}`);
    return res.status(401).json(errorResponse('请求时间戳过期', 401));
  }

  let timestamps = requestTimestamps.get(nonce) || [];
  timestamps = timestamps.filter((t) => now - t < MAX_TIMESTAMP_WINDOW);
  if (timestamps.length >= MAX_RETRY_ATTEMPTS) {
    logger.warn(`Nonce reuse detected: ${nonce}`);
    return res.status(429).json(errorResponse('请求过于频繁', 429));
  }
  timestamps.push(timestamp);
  requestTimestamps.set(nonce, timestamps);

  try {
    const isValid = verifySignature(
      req.method,
      req.path,
      timestamp,
      req.body,
      signature,
      keyConfig.secret
    );

    if (!isValid) {
      logger.warn(`Invalid signature for request: ${req.method} ${req.path}`);
      return res.status(401).json(errorResponse('签名验证失败', 401));
    }
  } catch (error) {
    logger.error('Signature verification error:', error);
    return res.status(500).json(errorResponse('签名验证错误', 500));
  }

  (req as any).apiKeyConfig = keyConfig;

  logger.debug(`Request validated with API key: ${keyConfig.name}`);
  next();
}

export function encryptData(data: any, secretKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey.padEnd(32, '0').slice(0, 32)), iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptData(encryptedData: string, secretKey: string): any {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(secretKey.padEnd(32, '0').slice(0, 32)),
    iv
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateSecureToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/['";]/g, '')
    .trim();
}

export function validateInputSchema(schema: any, data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  for (const [key, config] of Object.entries(schema)) {
    const value = data[key];
    const { type, required, maxLength, pattern, min, max } = config as any;

    if (required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} 是必填字段`);
      continue;
    }

    if (value !== undefined && value !== null) {
      if (type === 'string' && typeof value !== 'string') {
        errors.push(`${key} 必须是字符串类型`);
      } else if (type === 'number' && typeof value !== 'number') {
        errors.push(`${key} 必须是数字类型`);
      }

      if (type === 'string' && maxLength && value.length > maxLength) {
        errors.push(`${key} 不能超过 ${maxLength} 个字符`);
      }

      if (type === 'number' && min !== undefined && value < min) {
        errors.push(`${key} 不能小于 ${min}`);
      }

      if (type === 'number' && max !== undefined && value > max) {
        errors.push(`${key} 不能大于 ${max}`);
      }

      if (pattern && !new RegExp(pattern).test(value)) {
        errors.push(`${key} 格式不正确`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [nonce, timestamps] of requestTimestamps.entries()) {
    const filtered = timestamps.filter((t) => now - t < MAX_TIMESTAMP_WINDOW);
    if (filtered.length === 0) {
      requestTimestamps.delete(nonce);
    } else {
      requestTimestamps.set(nonce, filtered);
    }
  }
}, 60 * 1000);
