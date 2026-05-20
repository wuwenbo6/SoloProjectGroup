import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../config/logger';

const API_SECRET = process.env.API_SECRET || 'lacquerware_2024_secure_secret_key';
const SIGNATURE_EXPIRE = parseInt(process.env.SIGNATURE_EXPIRE || '300000');
const NONCE_EXPIRE = parseInt(process.env.NONCE_EXPIRE || '600000');

interface ValidatedRequest extends Request {
  validated?: boolean;
  clientInfo?: {
    appId?: string;
    timestamp?: number;
    nonce?: string;
  };
}

const usedNonces: Map<string, number> = new Map();

const cleanExpiredNonces = () => {
  const now = Date.now();
  for (const [nonce, timestamp] of usedNonces.entries()) {
    if (now - timestamp > NONCE_EXPIRE) {
      usedNonces.delete(nonce);
    }
  }
};

setInterval(cleanExpiredNonces, 60000);

export const generateSignature = (data: Record<string, any>, timestamp: number, nonce: string, appId: string): string => {
  const sortedKeys = Object.keys(data).sort();
  const dataString = sortedKeys.map(key => `${key}=${JSON.stringify(data[key])}`).join('&');
  const signatureString = `${appId}${timestamp}${nonce}${dataString}${API_SECRET}`;
  return crypto
    .createHash('sha256')
    .update(signatureString, 'utf8')
    .digest('hex')
    .toUpperCase();
};

export const validateSignature = (req: ValidatedRequest, res: Response, next: NextFunction) => {
  const appId = req.header('X-App-Id');
  const timestamp = req.header('X-Timestamp');
  const nonce = req.header('X-Nonce');
  const signature = req.header('X-Signature');

  if (!appId || !timestamp || !nonce || !signature) {
    return res.status(401).json({
      success: false,
      message: '缺少安全验证头',
      error: 'X-App-Id, X-Timestamp, X-Nonce, X-Signature 都是必需的'
    });
  }

  const ts = parseInt(timestamp);
  if (isNaN(ts)) {
    return res.status(401).json({
      success: false,
      message: '时间戳格式无效'
    });
  }

  const now = Date.now();
  if (now - ts > SIGNATURE_EXPIRE) {
    return res.status(401).json({
      success: false,
      message: '请求已过期，请重新发送'
    });
  }

  if (usedNonces.has(nonce)) {
    return res.status(401).json({
      success: false,
      message: '重复请求已被拒绝'
    });
  }
  usedNonces.set(nonce, now);

  let requestData: Record<string, any> = {};
  if (req.method === 'GET') {
    requestData = { ...req.query };
  } else {
    requestData = { ...req.body };
  }

  const expectedSignature = generateSignature(requestData, ts, nonce, appId);

  if (signature !== expectedSignature) {
    logger.warn('签名验证失败', {
      appId,
      receivedSignature: signature,
      expectedSignature,
      path: req.path
    });

    return res.status(401).json({
      success: false,
      message: '签名验证失败'
    });
  }

  req.validated = true;
  req.clientInfo = { appId, timestamp: ts, nonce };
  next();
};

export const encryptResponse = (req: Request, res: Response, data: any): string => {
  const jsonStr = JSON.stringify(data);
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(API_SECRET, 'salt', 32);

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted,
    timestamp: Date.now()
  });
};

export const decryptRequest = (encryptedData: string): any => {
  try {
    const { iv, data } = JSON.parse(encryptedData);
    const key = crypto.scryptSync(API_SECRET, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error('解密失败');
  }
};

export const decryptMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const encryptHeader = req.header('X-Encrypted');
  if (encryptHeader !== 'true') {
    return next();
  }

  try {
    if (req.body && req.body.encrypted) {
      const decrypted = decryptRequest(req.body.encrypted);
      req.body = decrypted;
    }
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '请求数据解密失败',
      error: (error as Error).message
    });
  }
};

export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');
  next();
};

export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: '缺少 API Key'
    });
  }

  const validApiKeys = (process.env.VALID_API_KEYS || 'key1,key2').split(',');
  if (!validApiKeys.includes(apiKey)) {
    return res.status(403).json({
      success: false,
      message: '无效的 API Key'
    });
  }

  next();
};

export const getSecurityInfo = (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      signatureAlgorithm: 'SHA256',
      encryptionAlgorithm: 'AES-256-CBC',
      signatureExpire: SIGNATURE_EXPIRE,
      nonceExpire: NONCE_EXPIRE,
      requiredHeaders: [
        'X-App-Id',
        'X-Timestamp',
        'X-Nonce',
        'X-Signature'
      ],
      optionalHeaders: [
        'X-API-Key',
        'X-Encrypted'
      ]
    }
  });
};
