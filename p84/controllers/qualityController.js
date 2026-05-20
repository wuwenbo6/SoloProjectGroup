const QualityInspection = require('../models/quality/QualityInspection');
const ProductionRecord = require('../models/production/ProductionRecord');
const { retryOperation } = require('../config/databases');
const logger = require('../config/logger');

const generateInspectionNumber = () => {
  const date = new Date();
  const prefix = 'QI';
  const timestamp = date.getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${timestamp}${random}`;
};

const validateInspectionItem = (item) => {
  if (!item.itemName || typeof item.itemName !== 'string') {
    return { valid: false, error: '检测项名称无效' };
  }
  
  const validResults = ['pass', 'fail', 'warning', 'not_tested'];
  if (item.result && !validResults.includes(item.result)) {
    return { valid: false, error: `检测结果值无效: ${item.result}` };
  }

  if (item.standard !== undefined && typeof item.standard !== 'string') {
    return { valid: false, error: '标准值类型无效' };
  }

  return { valid: true };
};

const calculateOverallResult = (inspectionItems) => {
  if (!inspectionItems || inspectionItems.length === 0) {
    return 'pending';
  }

  const hasFail = inspectionItems.some(item => item.result === 'fail');
  const hasWarning = inspectionItems.some(item => item.result === 'warning');
  const hasNotTested = inspectionItems.some(item => !item.result || item.result === 'not_tested');
  const allPass = inspectionItems.every(item => item.result === 'pass');

  if (hasFail) {
    return 'fail';
  } else if (hasWarning) {
    return 'warning';
  } else if (hasNotTested) {
    return 'pending';
  } else if (allPass) {
    return 'pass';
  }
  
  return 'pending';
};

const createInspection = async (req, res) => {
  try {
    const { productionRecordId, batchId, propSerialNumber, inspectionType, inspectionStage, inspectionItems, notes } = req.body;

    if (!Array.isArray(inspectionItems)) {
      return res.status(400).json({
        success: false,
        message: '检测项数据格式无效'
      });
    }

    for (const item of inspectionItems) {
      const validation = validateInspectionItem(item);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
    }

    const productionRecord = await ProductionRecord.findById(productionRecordId);
    if (!productionRecord) {
      return res.status(404).json({
        success: false,
        message: '生产记录不存在'
      });
    }

    const inspectionNumber = generateInspectionNumber();
    const overallResult = calculateOverallResult(inspectionItems);

    const createOperation = async () => {
      const inspection = new QualityInspection({
        inspectionNumber,
        productionRecordId,
        batchId,
        propSerialNumber: propSerialNumber || productionRecord.propSerialNumber,
        inspectionType,
        inspectionStage,
        inspector: req.user.id,
        inspectionItems,
        overallResult,
        notes
      });

      await inspection.save();
      return inspection;
    };

    const inspection = await retryOperation(createOperation, 3, 500);

    res.status(201).json({
      success: true,
      message: '品质检测记录创建成功',
      data: { inspection }
    });
  } catch (error) {
    logger.error('创建品质检测记录失败:', error);
    res.status(500).json({
      success: false,
      message: '创建品质检测记录失败',
      error: error.message
    });
  }
};

const getInspections = async (req, res) => {
  try {
    const { productionRecordId, batchId, inspectionType, overallResult, isSynced, page = 1, limit = 10 } = req.query;
    const query = {};

    if (productionRecordId) query.productionRecordId = productionRecordId;
    if (batchId) query.batchId = batchId;
    if (inspectionType) query.inspectionType = inspectionType;
    if (overallResult) query.overallResult = overallResult;
    if (isSynced !== undefined) query.isSynced = isSynced === 'true';

    const inspections = await QualityInspection.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await QualityInspection.countDocuments(query);

    res.json({
      success: true,
      data: {
        inspections,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取品质检测列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取品质检测列表失败',
      error: error.message
    });
  }
};

const getInspectionById = async (req, res) => {
  try {
    const inspection = await QualityInspection.findById(req.params.id);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在'
      });
    }

    res.json({
      success: true,
      data: { inspection }
    });
  } catch (error) {
    logger.error('获取品质检测详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取品质检测详情失败',
      error: error.message
    });
  }
};

const updateInspection = async (req, res) => {
  try {
    const { inspectionItems, overallResult, notes, attachments } = req.body;

    if (inspectionItems) {
      if (!Array.isArray(inspectionItems)) {
        return res.status(400).json({
          success: false,
          message: '检测项数据格式无效'
        });
      }

      for (const item of inspectionItems) {
        const validation = validateInspectionItem(item);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: validation.error
          });
        }
      }
    }

    const updateOperation = async () => {
      const inspection = await QualityInspection.findById(req.params.id);
      if (!inspection) {
        throw new Error('品质检测记录不存在');
      }

      let finalOverallResult = overallResult;
      if (inspectionItems && inspectionItems.length > 0) {
        finalOverallResult = calculateOverallResult(inspectionItems);
      }

      if (inspectionItems) {
        const existingItems = inspection.inspectionItems || [];
        const itemMap = new Map();

        existingItems.forEach(item => {
          itemMap.set(item.itemName, item);
        });

        inspectionItems.forEach(item => {
          itemMap.set(item.itemName, item);
        });

        inspection.inspectionItems = Array.from(itemMap.values());
      }

      if (finalOverallResult) {
        inspection.overallResult = finalOverallResult;
      }
      if (notes !== undefined) inspection.notes = notes;
      if (attachments !== undefined) inspection.attachments = attachments;

      inspection.markModified('inspectionItems');
      await inspection.save();
      return inspection;
    };

    const updatedInspection = await retryOperation(updateOperation, 3, 500);

    res.json({
      success: true,
      message: '品质检测记录更新成功',
      data: { inspection: updatedInspection }
    });
  } catch (error) {
    logger.error('更新品质检测记录失败:', error);
    if (error.message === '品质检测记录不存在') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: '更新品质检测记录失败',
      error: error.message
    });
  }
};

module.exports = {
  createInspection,
  getInspections,
  getInspectionById,
  updateInspection
};
