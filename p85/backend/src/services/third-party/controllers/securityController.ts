import { Request, Response } from 'express';
import {
  generateApiKey,
  validateApiKey,
  generateSignature,
  encryptData,
  decryptData,
  hashData,
} from '../../../shared/middleware/requestSecurity';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/middleware/logger';

export const createApiKey = async (req: Request, res: Response) => {
  try {
    const { name, rateLimit = 1000 } = req.body;

    if (!name) {
      return res.status(400).json(errorResponse('密钥名称不能为空', 400));
    }

    const apiKey = generateApiKey(name, rateLimit);

    logger.info(`API key created: ${apiKey.name} (${apiKey.id})`);

    res.status(201).json(
      successResponse({
        id: apiKey.id,
        key: apiKey.key,
        secret: apiKey.secret,
        name: apiKey.name,
        rateLimit: apiKey.rateLimit,
        warning: '请妥善保管密钥，仅显示一次',
      })
    );
  } catch (err) {
    logger.error('Create API key error:', err);
    res.status(500).json(errorResponse('创建API密钥失败', 500));
  }
};

export const testSignature = async (req: Request, res: Response) => {
  try {
    const { method, path, body, secret } = req.body;

    const timestamp = Date.now();
    const nonce = require('crypto').randomBytes(16).toString('hex');
    const signature = generateSignature(method || 'POST', path || '/api/test', timestamp, body || {}, secret);

    res.json(
      successResponse({
        'x-api-key': 'pk_live_default',
        'x-timestamp': timestamp,
        'x-nonce': nonce,
        'x-signature': signature,
      })
    );
  } catch (err) {
    logger.error('Test signature error:', err);
    res.status(500).json(errorResponse('生成测试签名失败', 500));
  }
};

export const encryptDataHandler = async (req: Request, res: Response) => {
  try {
    const { data, secretKey } = req.body;

    if (!data || !secretKey) {
      return res.status(400).json(errorResponse('数据和密钥不能为空', 400));
    }

    const encrypted = encryptData(data, secretKey);

    res.json(
      successResponse({
        encrypted,
        hash: hashData(JSON.stringify(data)),
      })
    );
  } catch (err) {
    logger.error('Encrypt data error:', err);
    res.status(500).json(errorResponse('加密数据失败', 500));
  }
};

export const decryptDataHandler = async (req: Request, res: Response) => {
  try {
    const { encryptedData, secretKey } = req.body;

    if (!encryptedData || !secretKey) {
      return res.status(400).json(errorResponse('加密数据和密钥不能为空', 400));
    }

    const decrypted = decryptData(encryptedData, secretKey);

    res.json(successResponse({ decrypted }));
  } catch (err) {
    logger.error('Decrypt data error:', err);
    res.status(500).json(errorResponse('解密数据失败', 500));
  }
};
