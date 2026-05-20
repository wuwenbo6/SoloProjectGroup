import { Request, Response } from 'express';
import crypto from 'crypto';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/middleware/logger';
import { ThirdPartyAgency } from '../../inspection/models/ThirdPartyAgency';

function verifySignature(payload: any, signature: string, apiKey: string): boolean {
  const hmac = crypto.createHmac('sha256', apiKey);
  const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

export const receiveInspectionData = async (req: Request, res: Response) => {
  try {
    const { inspectionId, agencyCode, items, conclusion, reportUrl, signature, timestamp } = req.body;

    if (!agencyCode || !signature || !timestamp) {
      return res.status(400).json(errorResponse('缺少必要参数', 400));
    }

    const timeDiff = Math.abs(Date.now() - timestamp);
    if (timeDiff > 5 * 60 * 1000) {
      return res.status(400).json(errorResponse('请求已过期', 400));
    }

    const agency = await ThirdPartyAgency.findOne({
      where: { code: agencyCode, isActive: true },
    });

    if (!agency) {
      return res.status(404).json(errorResponse('机构不存在或未激活', 404));
    }

    const payload = { inspectionId, agencyCode, items, conclusion, reportUrl, timestamp };
    if (!verifySignature(payload, signature, agency.apiKey)) {
      return res.status(403).json(errorResponse('签名验证失败', 403));
    }

    logger.info(`Received inspection data from agency: ${agency.name}, inspectionId: ${inspectionId}`);

    res.json(successResponse({ received: true, inspectionId }));
  } catch (err) {
    logger.error('Receive inspection data error:', err);
    res.status(500).json(errorResponse('接收检测数据失败', 500));
  }
};

export const getWebhookStatus = async (req: Request, res: Response) => {
  try {
    const { agencyId } = req.params;

    const agency = await ThirdPartyAgency.findByPk(agencyId);
    if (!agency) {
      return res.status(404).json(errorResponse('机构不存在', 404));
    }

    res.json(
      successResponse({
        agencyId: agency.id,
        webhookUrl: agency.webhookUrl,
        isActive: agency.isActive,
      })
    );
  } catch (err) {
    logger.error('Get webhook status error:', err);
    res.status(500).json(errorResponse('获取Webhook状态失败', 500));
  }
};

export const syncInspectionData = async (req: Request, res: Response) => {
  try {
    const { agencyId, inspectionId } = req.body;

    const agency = await ThirdPartyAgency.findByPk(agencyId);
    if (!agency) {
      return res.status(404).json(errorResponse('机构不存在', 404));
    }

    if (!agency.webhookUrl) {
      return res.status(400).json(errorResponse('机构未配置Webhook地址', 400));
    }

    logger.info(`Syncing inspection data to agency: ${agency.name}, inspectionId: ${inspectionId}`);

    res.json(successResponse({ synced: true, inspectionId }));
  } catch (err) {
    logger.error('Sync inspection data error:', err);
    res.status(500).json(errorResponse('同步检测数据失败', 500));
  }
};
