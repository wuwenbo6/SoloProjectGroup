const ThirdPartyDetection = require('../models/technique/ThirdPartyDetection');
const TraceUtil = require('../utils/traceUtil');
const logger = require('../utils/logger');
const axios = require('axios');

exports.createDetection = async (req, res) => {
  try {
    const { bookId, bookCode, organization, detectionType } = req.body;
    
    const detectionId = `DET-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const traceId = TraceUtil.generateTraceId();
    
    const detection = await ThirdPartyDetection.create({
      ...req.body,
      detectionId,
      traceId,
      syncStatus: 'pending'
    });

    TraceUtil.logOperation(traceId, 'create_detection', { bookId, detectionId }, req.user?.id);

    res.status(201).json({
      message: '检测记录创建成功',
      data: detection
    });
  } catch (error) {
    logger.error('创建检测记录失败:', error);
    res.status(500).json({ error: '创建检测记录失败', message: error.message });
  }
};

exports.getDetectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const detection = await ThirdPartyDetection.findByPk(id);
    
    if (!detection) {
      return res.status(404).json({ error: '检测记录不存在' });
    }

    res.json({ data: detection });
  } catch (error) {
    logger.error('获取检测记录失败:', error);
    res.status(500).json({ error: '获取检测记录失败', message: error.message });
  }
};

exports.getDetectionByDetectionId = async (req, res) => {
  try {
    const { detectionId } = req.params;
    const detection = await ThirdPartyDetection.findOne({ where: { detectionId } });
    
    if (!detection) {
      return res.status(404).json({ error: '检测记录不存在' });
    }

    res.json({ data: detection });
  } catch (error) {
    logger.error('获取检测记录失败:', error);
    res.status(500).json({ error: '获取检测记录失败', message: error.message });
  }
};

exports.getDetectionsByBookId = async (req, res) => {
  try {
    const { bookId } = req.params;
    const detections = await ThirdPartyDetection.findAll({
      where: { bookId },
      order: [['createdAt', 'DESC']]
    });

    res.json({ data: detections });
  } catch (error) {
    logger.error('获取检测记录列表失败:', error);
    res.status(500).json({ error: '获取检测记录列表失败', message: error.message });
  }
};

exports.getAllDetections = async (req, res) => {
  try {
    const { page = 1, limit = 20, detectionType, syncStatus, verified } = req.query;
    
    const where = {};
    if (detectionType) where.detectionType = detectionType;
    if (syncStatus) where.syncStatus = syncStatus;
    if (verified !== undefined) where.verified = verified === 'true';

    const { count, rows } = await ThirdPartyDetection.findAndCountAll({
      where,
      offset: (page - 1) * limit,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('获取检测记录列表失败:', error);
    res.status(500).json({ error: '获取检测记录列表失败', message: error.message });
  }
};

exports.updateDetection = async (req, res) => {
  try {
    const { id } = req.params;
    const detection = await ThirdPartyDetection.findByPk(id);
    
    if (!detection) {
      return res.status(404).json({ error: '检测记录不存在' });
    }

    await detection.update(req.body);

    TraceUtil.logOperation(detection.traceId, 'update_detection', { detectionId: id }, req.user?.id);

    res.json({
      message: '检测记录更新成功',
      data: detection
    });
  } catch (error) {
    logger.error('更新检测记录失败:', error);
    res.status(500).json({ error: '更新检测记录失败', message: error.message });
  }
};

exports.deleteDetection = async (req, res) => {
  try {
    const { id } = req.params;
    const detection = await ThirdPartyDetection.findByPk(id);
    
    if (!detection) {
      return res.status(404).json({ error: '检测记录不存在' });
    }

    await detection.destroy();

    res.json({ message: '检测记录删除成功' });
  } catch (error) {
    logger.error('删除检测记录失败:', error);
    res.status(500).json({ error: '删除检测记录失败', message: error.message });
  }
};

exports.verifyDetection = async (req, res) => {
  try {
    const { id } = req.params;
    const detection = await ThirdPartyDetection.findByPk(id);
    
    if (!detection) {
      return res.status(404).json({ error: '检测记录不存在' });
    }

    await detection.update({
      verified: true,
      verifiedBy: req.user?.id,
      verifiedAt: new Date()
    });

    TraceUtil.logOperation(detection.traceId, 'verify_detection', { detectionId: id }, req.user?.id);

    res.json({
      message: '验证完成',
      data: detection
    });
  } catch (error) {
    logger.error('验证失败:', error);
    res.status(500).json({ error: '验证失败', message: error.message });
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const syncWithRetry = async (payload, maxRetries = 3, baseTimeout = 10000) => {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const timeout = baseTimeout * attempt;
      logger.info(`Sync attempt ${attempt}/${maxRetries}, timeout: ${timeout}ms`);
      
      const response = await axios.post(
        `${process.env.THIRD_PARTY_API_URL}/api/sync`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.THIRD_PARTY_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Request-Id': `${payload.detectionId}-${Date.now()}-${attempt}`
          },
          timeout: timeout
        }
      );

      if (response.data.success) {
        return { success: true, data: response.data, attempt };
      }
      
      throw new Error(response.data.message || '第三方服务返回错误');
    } catch (error) {
      lastError = error;
      const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
      const isNetworkError = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code);
      
      logger.warn(`Sync attempt ${attempt} failed: ${error.message}, isTimeout: ${isTimeout}, isNetworkError: ${isNetworkError}`);
      
      if (attempt < maxRetries && (isTimeout || isNetworkError || error.response?.status >= 500)) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        logger.info(`Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
};

exports.syncWithThirdParty = async (req, res) => {
  try {
    const { detectionId } = req.params;
    const { async = false, maxRetries = 3 } = req.body;
    
    const detection = await ThirdPartyDetection.findByPk(detectionId);
    
    if (!detection) {
      return res.status(404).json({ error: '检测记录不存在' });
    }

    if (detection.syncStatus === 'syncing') {
      return res.status(409).json({ 
        error: '正在同步中',
        message: '该记录正在进行同步，请稍后再试'
      });
    }

    await detection.update({ syncStatus: 'syncing' });

    const payload = {
      detectionId: detection.detectionId,
      bookCode: detection.bookCode,
      detectionType: detection.detectionType,
      organization: detection.organization
    };

    if (async) {
      setImmediate(async () => {
        try {
          const result = await syncWithRetry(payload, maxRetries);
          await detection.update({
            syncStatus: 'synced',
            syncedAt: new Date(),
            reportData: result.data.reportData,
            conclusion: result.data.conclusion,
            recommendations: result.data.recommendations,
            metadata: { ...result.data, attempts: result.attempt }
          });
          logger.info(`Async sync completed for detection ${detectionId}, attempts: ${result.attempt}`);
        } catch (syncError) {
          await detection.update({
            syncStatus: 'failed',
            syncError: syncError.message,
            metadata: { error: syncError.message, stack: syncError.stack }
          });
          logger.error(`Async sync failed for detection ${detectionId}:`, syncError);
        }
      });

      return res.json({
        message: '异步同步已启动，请稍后查询结果',
        data: { detectionId: detection.detectionId, syncStatus: 'syncing' }
      });
    }

    try {
      const result = await syncWithRetry(payload, maxRetries);
      
      await detection.update({
        syncStatus: 'synced',
        syncedAt: new Date(),
        reportData: result.data.reportData,
        conclusion: result.data.conclusion,
        recommendations: result.data.recommendations,
        metadata: { ...result.data, attempts: result.attempt }
      });

      res.json({
        message: '同步成功',
        data: detection,
        attempts: result.attempt
      });
    } catch (syncError) {
      const isTimeout = syncError.code === 'ECONNABORTED' || syncError.message.includes('timeout');
      
      await detection.update({
        syncStatus: isTimeout ? 'partial' : 'failed',
        syncError: syncError.message,
        metadata: { 
          error: syncError.message, 
          code: syncError.code,
          isTimeout,
          timestamp: new Date().toISOString()
        }
      });

      logger.error(`Sync failed: ${syncError.message}, isTimeout: ${isTimeout}`);

      const statusCode = isTimeout ? 504 : 500;
      const errorMessage = isTimeout 
        ? '第三方服务响应超时，请尝试使用异步同步模式' 
        : '同步第三方数据失败';

      res.status(statusCode).json({
        error: errorMessage,
        message: syncError.message,
        isTimeout,
        suggestion: isTimeout ? '建议使用 async=true 参数启用异步同步' : null,
        currentStatus: detection.syncStatus
      });
    }
  } catch (error) {
    logger.error('同步第三方数据失败:', error);
    res.status(500).json({ 
      error: '同步第三方数据失败', 
      message: error.message,
      code: error.code
    });
  }
};

exports.getSyncStatus = async (req, res) => {
  try {
    const { detectionId } = req.params;
    const detection = await ThirdPartyDetection.findOne({ 
      where: { detectionId },
      attributes: ['detectionId', 'syncStatus', 'syncedAt', 'syncError', 'metadata']
    });
    
    if (!detection) {
      return res.status(404).json({ error: '检测记录不存在' });
    }

    res.json({
      message: '获取同步状态成功',
      data: {
        detectionId: detection.detectionId,
        syncStatus: detection.syncStatus,
        syncedAt: detection.syncedAt,
        syncError: detection.syncError,
        hasReportData: !!detection.metadata?.reportData
      }
    });
  } catch (error) {
    logger.error('获取同步状态失败:', error);
    res.status(500).json({ error: '获取同步状态失败', message: error.message });
  }
};

exports.receiveWebhook = async (req, res) => {
  try {
    const { detectionId, status, reportData, conclusion, recommendations } = req.body;
    
    const detection = await ThirdPartyDetection.findOne({ where: { detectionId } });
    
    if (!detection) {
      return res.status(404).json({ error: '检测记录不存在' });
    }

    await detection.update({
      syncStatus: status === 'completed' ? 'synced' : status,
      reportData,
      conclusion,
      recommendations,
      syncedAt: new Date(),
      metadata: req.body
    });

    res.json({ success: true, message: 'Webhook接收成功' });
  } catch (error) {
    logger.error('接收Webhook失败:', error);
    res.status(500).json({ error: '接收Webhook失败', message: error.message });
  }
};

exports.getDetectionTypes = async (req, res) => {
  try {
    const types = [
      { code: 'material_analysis', name: '材质分析', description: '古籍纸张、墨水等材质成分分析' },
      { code: 'age_dating', name: '年代测定', description: '古籍制作年代科学测定' },
      { code: 'damage_assessment', name: '破损评估', description: '古籍破损程度科学评估' },
      { code: 'microscopic_examination', name: '显微检测', description: '微观结构分析检测' },
      { code: 'full_analysis', name: '全面分析', description: '完整的古籍检测分析' }
    ];

    res.json({ data: types });
  } catch (error) {
    logger.error('获取检测类型失败:', error);
    res.status(500).json({ error: '获取检测类型失败', message: error.message });
  }
};
