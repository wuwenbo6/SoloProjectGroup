const ProductionRecord = require('../models/production/ProductionRecord');
const ProcessTemplate = require('../models/process/ProcessTemplate');
const { retryOperation } = require('../config/databases');
const { productionRecordCache, invalidateProductionRecordCache } = require('../config/cache');
const logger = require('../config/logger');

const createProductionRecord = async (req, res) => {
  try {
    const { batchId, processTemplateId, propSerialNumber, propName } = req.body;

    const existingRecord = await ProductionRecord.findOne({ propSerialNumber });
    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message: '道具序列号已存在'
      });
    }

    const template = await ProcessTemplate.findById(processTemplateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: '工艺模板不存在'
      });
    }

    const steps = template.steps.map(step => ({
      stepId: step._id,
      stepName: step.stepName,
      stepOrder: step.stepOrder,
      parameters: []
    }));

    const productionRecord = new ProductionRecord({
      batchId,
      processTemplateId,
      propSerialNumber,
      propName: propName || template.propName,
      steps,
      currentStep: 0,
      status: 'not_started',
      createdBy: req.user.id
    });

    await retryOperation(() => productionRecord.save(), 3, 500);
    invalidateProductionRecordCache(productionRecord._id);

    res.status(201).json({
      success: true,
      message: '生产记录创建成功',
      data: { productionRecord }
    });
  } catch (error) {
    logger.error('创建生产记录失败:', error);
    res.status(500).json({
      success: false,
      message: '创建生产记录失败',
      error: error.message
    });
  }
};

const getProductionRecords = async (req, res) => {
  try {
    const { batchId, status, page = 1, limit = 10 } = req.query;
    const cacheKey = `records:${batchId || 'all'}:${status || 'all'}:${page}:${limit}`;

    const cachedResult = productionRecordCache.get(cacheKey);
    if (cachedResult) {
      return res.json({
        success: true,
        data: cachedResult,
        fromCache: true
      });
    }

    const query = {};
    if (batchId) query.batchId = batchId;
    if (status) query.status = status;

    const records = await ProductionRecord.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ProductionRecord.countDocuments(query);

    const result = {
      records,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    };

    productionRecordCache.set(cacheKey, result);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('获取生产记录列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取生产记录列表失败',
      error: error.message
    });
  }
};

const getProductionRecordById = async (req, res) => {
  try {
    const cacheKey = `record:${req.params.id}`;
    const cachedRecord = productionRecordCache.get(cacheKey);
    
    if (cachedRecord) {
      return res.json({
        success: true,
        data: { record: cachedRecord },
        fromCache: true
      });
    }

    const record = await ProductionRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '生产记录不存在'
      });
    }

    productionRecordCache.set(cacheKey, record);

    res.json({
      success: true,
      data: { record }
    });
  } catch (error) {
    logger.error('获取生产记录详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取生产记录详情失败',
      error: error.message
    });
  }
};

const updateStepParameters = async (req, res) => {
  try {
    const { recordId, stepIndex, parameters, notes, operator } = req.body;

    if (!Array.isArray(parameters) || parameters.length === 0) {
      return res.status(400).json({
        success: false,
        message: '参数数据无效'
      });
    }

    const updateOperation = async () => {
      const record = await ProductionRecord.findById(recordId);
      if (!record) {
        throw new Error('生产记录不存在');
      }

      if (stepIndex < 0 || stepIndex >= record.steps.length) {
        throw new Error('步骤索引无效');
      }

      const step = record.steps[stepIndex];
      const existingParams = step.parameters || [];
      const paramMap = new Map();

      existingParams.forEach(p => {
        paramMap.set(p.paramName, p);
      });

      parameters.forEach(p => {
        const newParam = {
          ...p,
          recordedAt: p.recordedAt || new Date()
        };
        paramMap.set(p.paramName, newParam);
      });

      step.parameters = Array.from(paramMap.values());

      if (notes) step.notes = notes;
      if (operator) step.operator = operator;
      if (!step.startTime) step.startTime = new Date();
      if (step.status === 'pending') step.status = 'in_progress';

      if (!record.startedAt) {
        record.startedAt = new Date();
        record.status = 'in_progress';
      }

      record.markModified(`steps.${stepIndex}`);
      record.markModified('steps');
      
      await record.save();
      return record.steps[stepIndex];
    };

    const step = await retryOperation(updateOperation, 3, 1000);
    invalidateProductionRecordCache(recordId);

    res.json({
      success: true,
      message: '步骤参数更新成功',
      data: { step }
    });
  } catch (error) {
    logger.error('更新步骤参数失败:', error);
    if (error.message === '生产记录不存在') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    if (error.message === '步骤索引无效') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: '更新步骤参数失败',
      error: error.message
    });
  }
};

const batchUpdateParameters = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '批量更新数据格式无效'
      });
    }

    const results = {
      success: [],
      failed: []
    };

    const updatePromises = updates.map(async (update) => {
      try {
        const { recordId, stepIndex, parameters, notes, operator } = update;

        const record = await ProductionRecord.findById(recordId);
        if (!record) {
          throw new Error('生产记录不存在');
        }

        if (stepIndex < 0 || stepIndex >= record.steps.length) {
          throw new Error('步骤索引无效');
        }

        const step = record.steps[stepIndex];
        const existingParams = step.parameters || [];
        const paramMap = new Map();

        existingParams.forEach(p => {
          paramMap.set(p.paramName, p);
        });

        parameters.forEach(p => {
          const newParam = {
            ...p,
            recordedAt: p.recordedAt || new Date()
          };
          paramMap.set(p.paramName, newParam);
        });

        step.parameters = Array.from(paramMap.values());

        if (notes) step.notes = notes;
        if (operator) step.operator = operator;
        if (!step.startTime) step.startTime = new Date();
        if (step.status === 'pending') step.status = 'in_progress';

        if (!record.startedAt) {
          record.startedAt = new Date();
          record.status = 'in_progress';
        }

        record.markModified(`steps.${stepIndex}`);
        await record.save();
        invalidateProductionRecordCache(recordId);

        results.success.push({
          recordId,
          stepIndex,
          status: 'success'
        });
      } catch (error) {
        results.failed.push({
          recordId: update.recordId,
          stepIndex: update.stepIndex,
          error: error.message
        });
      }
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: `批量更新完成: ${results.success.length} 成功, ${results.failed.length} 失败`,
      data: results
    });
  } catch (error) {
    logger.error('批量更新步骤参数失败:', error);
    res.status(500).json({
      success: false,
      message: '批量更新步骤参数失败',
      error: error.message
    });
  }
};

const completeStep = async (req, res) => {
  try {
    const { recordId, stepIndex } = req.body;

    const completeOperation = async () => {
      const record = await ProductionRecord.findById(recordId);
      if (!record) {
        throw new Error('生产记录不存在');
      }

      if (stepIndex < 0 || stepIndex >= record.steps.length) {
        throw new Error('步骤索引无效');
      }

      const step = record.steps[stepIndex];
      step.status = 'completed';
      step.endTime = new Date();

      if (stepIndex + 1 < record.steps.length) {
        record.currentStep = stepIndex + 1;
      } else {
        record.status = 'completed';
        record.completedAt = new Date();
      }

      record.markModified(`steps.${stepIndex}`);
      await record.save();
      return record;
    };

    const record = await retryOperation(completeOperation, 3, 1000);
    invalidateProductionRecordCache(recordId);

    res.json({
      success: true,
      message: '步骤完成',
      data: { record }
    });
  } catch (error) {
    logger.error('完成步骤失败:', error);
    if (error.message === '生产记录不存在') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    if (error.message === '步骤索引无效') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: '完成步骤失败',
      error: error.message
    });
  }
};

module.exports = {
  createProductionRecord,
  getProductionRecords,
  getProductionRecordById,
  updateStepParameters,
  batchUpdateParameters,
  completeStep
};
