const { successResponse, errorResponse, paginatedResponse } = require('../../../shared/utils/response');
const Batch = require('../models/Batch');

let batchModel;

const initModels = (pool) => {
  batchModel = new Batch(pool);
};

const createBatch = async (req, res) => {
  try {
    const batch = await batchModel.create({
      ...req.body,
      created_by: req.user.id
    });
    successResponse(res, batch, '批次创建成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getBatches = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filters = {
      material_id: req.query.material_id,
      status: req.query.status,
      quality_grade: req.query.quality_grade
    };

    const result = await batchModel.findAll(filters, page, limit);
    paginatedResponse(res, result.batches, page, limit, result.total, '获取批次列表成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await batchModel.findById(id);
    if (!batch) {
      return errorResponse(res, '批次不存在', 404);
    }
    successResponse(res, batch, '获取批次信息成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getBatchByNo = async (req, res) => {
  try {
    const { batch_no } = req.params;
    const batch = await batchModel.findByBatchNo(batch_no);
    if (!batch) {
      return errorResponse(res, '批次不存在', 404);
    }
    successResponse(res, batch, '获取批次信息成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const updateBatchStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const batch = await batchModel.updateStatus(id, status, remarks);
    successResponse(res, batch, '批次状态更新成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const addFlowRecord = async (req, res) => {
  try {
    const { batch_id } = req.params;
    const flow = await batchModel.addFlowRecord({
      ...req.body,
      batch_id,
      operator_id: req.user.id,
      operator_name: req.user.username
    });
    
    if (req.body.to_stage) {
      await batchModel.updateStage(batch_id, req.body.to_stage);
    }
    
    successResponse(res, flow, '流转记录添加成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getFlowRecords = async (req, res) => {
  try {
    const { batch_id } = req.params;
    const records = await batchModel.getFlowRecords(batch_id);
    successResponse(res, records, '获取流转记录成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getExpiryWarnings = async (req, res) => {
  try {
    const daysThreshold = parseInt(req.query.days) || 30;
    const warnings = await batchModel.getExpiryWarnings(daysThreshold);
    
    const summary = {
      total: warnings.length,
      expired: warnings.filter(w => w.warning_level === 'EXPIRED').length,
      critical: warnings.filter(w => w.warning_level === 'CRITICAL').length,
      warning: warnings.filter(w => w.warning_level === 'WARNING').length
    };
    
    successResponse(res, {
      summary,
      warnings
    }, '获取批次过期预警成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getWarnings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      warning_type: req.query.warning_type,
      warning_level: req.query.warning_level,
      is_acknowledged: req.query.is_acknowledged === 'true' ? true : 
                       req.query.is_acknowledged === 'false' ? false : undefined
    };

    const result = await batchModel.getWarnings(filters, page, limit);
    paginatedResponse(res, result.warnings, page, limit, result.total, '获取预警列表成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const acknowledgeWarning = async (req, res) => {
  try {
    const { id } = req.params;
    const warning = await batchModel.acknowledgeWarning(id, req.user.id);
    if (!warning) {
      return errorResponse(res, '预警不存在', 404);
    }
    successResponse(res, warning, '预警已确认');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const triggerWarningGeneration = async (req, res) => {
  try {
    const warnings = await batchModel.generateExpiryWarnings();
    successResponse(res, {
      generated_count: warnings.length,
      warnings
    }, '预警生成完成');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const createOriginProcessRelation = async (req, res) => {
  try {
    const relation = await batchModel.createOriginProcessRelation({
      ...req.body,
      created_by: req.user.id
    });
    successResponse(res, relation, '产地工艺关联创建成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getOriginProcessRelations = async (req, res) => {
  try {
    const filters = {
      material_id: req.query.material_id,
      origin_province: req.query.origin_province,
      origin_city: req.query.origin_city,
      process_type: req.query.process_type,
      is_recommended: req.query.is_recommended === 'true' ? true :
                      req.query.is_recommended === 'false' ? false : undefined
    };

    const relations = await batchModel.getOriginProcessRelations(filters);
    successResponse(res, relations, '获取产地工艺关联列表成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getRecommendedProcesses = async (req, res) => {
  try {
    const { origin_province, origin_city, material_id } = req.query;
    
    if (!origin_province && !origin_city && !material_id) {
      return errorResponse(res, '请至少提供省份、城市或原料ID之一', 400);
    }

    const processes = await batchModel.getRecommendedProcesses(
      origin_province,
      origin_city,
      material_id
    );
    successResponse(res, processes, '获取推荐酿造工艺成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const updateOriginProcessRelation = async (req, res) => {
  try {
    const { id } = req.params;
    const relation = await batchModel.updateOriginProcessRelation(id, req.body);
    if (!relation) {
      return errorResponse(res, '关联不存在', 404);
    }
    successResponse(res, relation, '产地工艺关联更新成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const deleteOriginProcessRelation = async (req, res) => {
  try {
    const { id } = req.params;
    const relation = await batchModel.deleteOriginProcessRelation(id);
    if (!relation) {
      return errorResponse(res, '关联不存在', 404);
    }
    successResponse(res, null, '产地工艺关联删除成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getProcessStatistics = async (req, res) => {
  try {
    const statistics = await batchModel.getProcessStatistics();
    successResponse(res, statistics, '获取工艺统计数据成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

module.exports = {
  initModels,
  createBatch,
  getBatches,
  getBatch,
  getBatchByNo,
  updateBatchStatus,
  addFlowRecord,
  getFlowRecords,
  getExpiryWarnings,
  getWarnings,
  acknowledgeWarning,
  triggerWarningGeneration,
  createOriginProcessRelation,
  getOriginProcessRelations,
  getRecommendedProcesses,
  updateOriginProcessRelation,
  deleteOriginProcessRelation,
  getProcessStatistics
};
