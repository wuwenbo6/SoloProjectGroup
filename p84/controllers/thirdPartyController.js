const axios = require('axios');
const QualityInspection = require('../models/quality/QualityInspection');
const ThirdPartySyncRecord = require('../models/quality/ThirdPartySyncRecord');
const logger = require('../config/logger');

const generateSyncNumber = () => {
  const date = new Date();
  const prefix = 'SYNC';
  const timestamp = date.getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${timestamp}${random}`;
};

const THIRD_PARTY_AGENCIES = {
  QUALITY_AUTH: {
    code: 'QUALITY_AUTH',
    name: '国家质量监督检测中心',
    apiUrl: process.env.THIRD_PARTY_API_URL || 'https://api.quality.gov.cn'
  }
};

const syncToThirdParty = async (req, res) => {
  try {
    const { inspectionId, agencyCode } = req.body;

    const inspection = await QualityInspection.findById(inspectionId);
    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '检测记录不存在'
      });
    }

    const agency = THIRD_PARTY_AGENCIES[agencyCode] || THIRD_PARTY_AGENCIES.QUALITY_AUTH;

    const syncNumber = generateSyncNumber();
    const syncRecord = new ThirdPartySyncRecord({
      syncNumber,
      inspectionId,
      agencyCode: agency.code,
      agencyName: agency.name,
      syncDirection: 'upload',
      syncStatus: 'in_progress',
      syncedBy: req.user.id,
      syncStartedAt: new Date()
    });
    await syncRecord.save();

    try {
      const syncData = {
        inspectionNumber: inspection.inspectionNumber,
        propSerialNumber: inspection.propSerialNumber,
        inspectionType: inspection.inspectionType,
        inspectionDate: inspection.inspectionDate,
        overallResult: inspection.overallResult,
        inspectionItems: inspection.inspectionItems.map(item => ({
          itemName: item.itemName,
          standard: item.standard,
          method: item.method,
          actualValue: item.actualValue,
          unit: item.unit,
          result: item.result
        })),
        sourceSystem: 'OPERA_PROP_SYSTEM',
        syncTimestamp: new Date().toISOString()
      };

      syncRecord.requestData = syncData;
      await syncRecord.save();

      const response = await axios.post(`${agency.apiUrl}/api/v1/inspections`, syncData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.THIRD_PARTY_API_KEY}`,
          'X-Request-ID': syncNumber
        },
        timeout: 30000
      });

      syncRecord.syncStatus = 'success';
      syncRecord.responseData = response.data;
      syncRecord.externalReferenceId = response.data.referenceId || response.data.id;
      syncRecord.syncCompletedAt = new Date();
      await syncRecord.save();

      inspection.isSynced = true;
      inspection.syncedAt = new Date();
      await inspection.save();

      res.json({
        success: true,
        message: '数据同步成功',
        data: {
          syncRecord,
          externalReference: syncRecord.externalReferenceId
        }
      });
    } catch (apiError) {
      logger.error('第三方API调用失败:', apiError);
      
      syncRecord.syncStatus = 'failed';
      syncRecord.errorMessage = apiError.message;
      syncRecord.syncCompletedAt = new Date();
      await syncRecord.save();

      res.status(500).json({
        success: false,
        message: '第三方机构同步失败',
        error: apiError.message
      });
    }
  } catch (error) {
    logger.error('同步到第三方失败:', error);
    res.status(500).json({
      success: false,
      message: '同步失败',
      error: error.message
    });
  }
};

const pullFromThirdParty = async (req, res) => {
  try {
    const { externalReferenceId, agencyCode } = req.body;

    const agency = THIRD_PARTY_AGENCIES[agencyCode] || THIRD_PARTY_AGENCIES.QUALITY_AUTH;

    const syncNumber = generateSyncNumber();
    const syncRecord = new ThirdPartySyncRecord({
      syncNumber,
      inspectionId: null,
      agencyCode: agency.code,
      agencyName: agency.name,
      syncDirection: 'download',
      syncStatus: 'in_progress',
      syncedBy: req.user.id,
      syncStartedAt: new Date(),
      requestData: { externalReferenceId }
    });
    await syncRecord.save();

    try {
      const response = await axios.get(`${agency.apiUrl}/api/v1/inspections/${externalReferenceId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.THIRD_PARTY_API_KEY}`,
          'X-Request-ID': syncNumber
        },
        timeout: 30000
      });

      syncRecord.syncStatus = 'success';
      syncRecord.responseData = response.data;
      syncRecord.syncCompletedAt = new Date();
      await syncRecord.save();

      res.json({
        success: true,
        message: '数据拉取成功',
        data: {
          syncRecord,
          inspectionData: response.data
        }
      });
    } catch (apiError) {
      logger.error('从第三方拉取数据失败:', apiError);
      
      syncRecord.syncStatus = 'failed';
      syncRecord.errorMessage = apiError.message;
      syncRecord.syncCompletedAt = new Date();
      await syncRecord.save();

      res.status(500).json({
        success: false,
        message: '从第三方机构拉取数据失败',
        error: apiError.message
      });
    }
  } catch (error) {
    logger.error('从第三方拉取数据失败:', error);
    res.status(500).json({
      success: false,
      message: '拉取数据失败',
      error: error.message
    });
  }
};

const getSyncRecords = async (req, res) => {
  try {
    const { inspectionId, syncStatus, syncDirection, page = 1, limit = 10 } = req.query;
    const query = {};

    if (inspectionId) query.inspectionId = inspectionId;
    if (syncStatus) query.syncStatus = syncStatus;
    if (syncDirection) query.syncDirection = syncDirection;

    const syncRecords = await ThirdPartySyncRecord.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ThirdPartySyncRecord.countDocuments(query);

    res.json({
      success: true,
      data: {
        syncRecords,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取同步记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取同步记录失败',
      error: error.message
    });
  }
};

const retrySync = async (req, res) => {
  try {
    const { syncId } = req.body;

    const syncRecord = await ThirdPartySyncRecord.findById(syncId);
    if (!syncRecord) {
      return res.status(404).json({
        success: false,
        message: '同步记录不存在'
      });
    }

    if (syncRecord.syncDirection === 'upload') {
      req.body.inspectionId = syncRecord.inspectionId;
      req.body.agencyCode = syncRecord.agencyCode;
      
      syncRecord.retryCount = (syncRecord.retryCount || 0) + 1;
      syncRecord.syncStatus = 'retrying';
      await syncRecord.save();

      return syncToThirdParty(req, res);
    }

    res.status(400).json({
      success: false,
      message: '仅支持上传方向的重试'
    });
  } catch (error) {
    logger.error('重试同步失败:', error);
    res.status(500).json({
      success: false,
      message: '重试同步失败',
      error: error.message
    });
  }
};

const getAgencyList = async (req, res) => {
  try {
    const agencies = Object.values(THIRD_PARTY_AGENCIES);

    res.json({
      success: true,
      data: { agencies }
    });
  } catch (error) {
    logger.error('获取机构列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取机构列表失败',
      error: error.message
    });
  }
};

module.exports = {
  syncToThirdParty,
  pullFromThirdParty,
  getSyncRecords,
  retrySync,
  getAgencyList
};
