const { Op, Transaction } = require('sequelize');
const Batch = require('../models/Batch');
const sequelize = require('../config/database');
const ApiResponse = require('../../../../shared/utils/response');
const { catchAsync, AppError } = require('../../../../shared/utils/errorHandler');
const { ROLES, PERMISSIONS, BATCH_STATUS } = require('../../../../shared/constants');
const crypto = require('crypto');

const generateBatchNo = async (retryCount = 0, maxRetries = 5) => {
  const t = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
  });
  
  try {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    
    const result = await sequelize.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(batch_no, 10, 4) AS INTEGER)), 0) as max_num 
       FROM batches WHERE batch_no LIKE :prefix`,
      {
        replacements: { prefix: `B${dateStr}%` },
        type: sequelize.QueryTypes.SELECT,
        transaction: t
      }
    );
    
    const maxNum = result[0].max_num;
    const sequenceNum = String(maxNum + 1).padStart(4, '0');
    const batchNo = `B${dateStr}${sequenceNum}${randomSuffix}`;
    
    const existing = await Batch.findOne({
      where: { batch_no: batchNo },
      transaction: t,
      lock: true
    });
    
    if (existing) {
      await t.rollback();
      if (retryCount < maxRetries) {
        return generateBatchNo(retryCount + 1, maxRetries);
      }
      throw new Error('批次号生成失败，已达最大重试次数');
    }
    
    await t.commit();
    return batchNo;
  } catch (error) {
    await t.rollback();
    if (retryCount < maxRetries) {
      return generateBatchNo(retryCount + 1, maxRetries);
    }
    throw error;
  }
};

const getAllBatches = catchAsync(async (req, res, next) => {
  const { page = 1, size = 20, materialId, status, search, startDate, endDate, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
  const where = {};
  if (materialId) where.material_id = materialId;
  if (status) where.status = status;
  if (search) where.batch_no = { [Op.iLike]: `%${search}%` };
  if (startDate) where.production_date = { [Op.gte]: startDate };
  if (endDate) where.production_date = { ...where.production_date, [Op.lte]: endDate };

  const { count, rows } = await Batch.findAndCountAll({
    where,
    limit: parseInt(size),
    offset: (parseInt(page) - 1) * parseInt(size),
    order: [[sortBy, sortOrder]]
  });
  ApiResponse.paginated(res, rows, page, size, count);
});

const getBatchById = catchAsync(async (req, res, next) => {
  const batch = await Batch.findByPk(req.params.id);
  if (!batch) return next(new AppError('批次不存在', 404));
  ApiResponse.success(res, batch);
});

const getBatchByNo = catchAsync(async (req, res, next) => {
  const batch = await Batch.findOne({ where: { batch_no: req.params.batchNo } });
  if (!batch) return next(new AppError('批次不存在', 404));
  ApiResponse.success(res, batch);
});

const createBatch = catchAsync(async (req, res, next) => {
  const { materialId, quantity, unit, productionDate, expiryDate, remarks, attributes } = req.body;
  const batchNo = await generateBatchNo();
  const batch = await Batch.create({
    material_id: materialId,
    batch_no: batchNo,
    quantity,
    unit,
    production_date: productionDate,
    expiry_date: expiryDate,
    remarks,
    attributes
  });
  ApiResponse.created(res, batch, '批次创建成功');
});

const updateBatch = catchAsync(async (req, res, next) => {
  const batch = await Batch.findByPk(req.params.id);
  if (!batch) return next(new AppError('批次不存在', 404));
  const { quantity, unit, productionDate, expiryDate, status, currentLocation, qualityGrade, remarks, attributes } = req.body;
  await batch.update({
    quantity,
    unit,
    production_date: productionDate,
    expiry_date: expiryDate,
    status,
    current_location: currentLocation,
    quality_grade: qualityGrade,
    remarks,
    attributes
  });
  ApiResponse.success(res, batch, '批次更新成功');
});

const updateBatchStatus = catchAsync(async (req, res, next) => {
  const batch = await Batch.findByPk(req.params.id);
  if (!batch) return next(new AppError('批次不存在', 404));
  const { status, location, remarks } = req.body;
  await batch.update({
    status,
    current_location: location,
    remarks: batch.remarks ? `${batch.remarks}\n${remarks}` : remarks
  });
  ApiResponse.success(res, batch, '批次状态更新成功');
});

const deleteBatch = catchAsync(async (req, res, next) => {
  const batch = await Batch.findByPk(req.params.id);
  if (!batch) return next(new AppError('批次不存在', 404));
  await batch.destroy();
  ApiResponse.success(res, null, '批次删除成功');
});

const getBatchStats = catchAsync(async (req, res, next) => {
  const stats = {};
  for (const status of Object.values(BATCH_STATUS)) {
    stats[status] = await Batch.count({ where: { status } });
  }
  stats.total = await Batch.count();
  ApiResponse.success(res, stats);
});

const getExpiryWarnings = catchAsync(async (req, res, next) => {
  const { days = 30, warningLevels = [7, 15, 30], page = 1, size = 100 } = req.query;
  const today = new Date();
  
  const warnings = [];
  const batchesByLevel = {};
  
  for (const level of warningLevels.sort((a, b) => a - b)) {
    const warningDate = new Date(today);
    warningDate.setDate(warningDate.getDate() + parseInt(level));
    
    const batches = await Batch.findAll({
      where: {
        expiry_date: {
          [Op.between]: [today, warningDate]
        },
        status: {
          [Op.notIn]: [BATCH_STATUS.EXPIRED, BATCH_STATUS.USED_UP]
        }
      },
      order: [['expiry_date', 'ASC']]
    });
    
    batchesByLevel[`${level}_days`] = batches.map(batch => ({
      id: batch.id,
      batch_no: batch.batch_no,
      material_id: batch.material_id,
      expiry_date: batch.expiry_date,
      days_remaining: Math.ceil((new Date(batch.expiry_date) - today) / (1000 * 60 * 60 * 24)),
      quantity: batch.quantity,
      status: batch.status,
      warning_level: level <= 7 ? 'critical' : level <= 15 ? 'high' : 'medium'
    }));
    
    warnings.push(...batchesByLevel[`${level}_days`]);
  }

  const expiredBatches = await Batch.findAll({
    where: {
      expiry_date: { [Op.lt]: today },
      status: { [Op.not]: BATCH_STATUS.EXPIRED }
    }
  });

  const alreadyExpired = expiredBatches.map(batch => ({
    id: batch.id,
    batch_no: batch.batch_no,
    material_id: batch.material_id,
    expiry_date: batch.expiry_date,
    days_overdue: Math.abs(Math.floor((new Date(batch.expiry_date) - today) / (1000 * 60 * 60 * 24))),
    quantity: batch.quantity,
    status: batch.status,
    warning_level: 'expired'
  }));

  const uniqueWarnings = Array.from(new Map(warnings.map(w => [w.id, w])).values());
  const startIndex = (parseInt(page) - 1) * parseInt(size);
  const paginatedWarnings = uniqueWarnings.slice(startIndex, startIndex + parseInt(size));

  ApiResponse.success(res, {
    summary: {
      total_warnings: uniqueWarnings.length,
      expired: alreadyExpired.length,
      critical: warnings.filter(w => w.warning_level === 'critical').length,
      high: warnings.filter(w => w.warning_level === 'high').length,
      medium: warnings.filter(w => w.warning_level === 'medium').length
    },
    by_level: batchesByLevel,
    expired: alreadyExpired,
    warnings: paginatedWarnings,
    pagination: {
      page: parseInt(page),
      size: parseInt(size),
      total: uniqueWarnings.length
    }
  });
});

const markBatchExpired = catchAsync(async (req, res, next) => {
  const batch = await Batch.findByPk(req.params.id);
  if (!batch) return next(new AppError('批次不存在', 404));
  
  await batch.update({ 
    status: BATCH_STATUS.EXPIRED,
    remarks: batch.remarks ? `${batch.remarks}\n系统自动标记已过期` : '系统自动标记已过期'
  });
  
  ApiResponse.success(res, batch, '批次已标记为已过期');
});

const getBatchExpiryReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate, materialId } = req.query;
  const today = new Date();
  
  const where = {};
  if (materialId) where.material_id = materialId;
  if (startDate) where.expiry_date = { [Op.gte]: startDate };
  if (endDate) where.expiry_date = { ...where.expiry_date, [Op.lte]: endDate };

  const batches = await Batch.findAll({
    where,
    order: [['expiry_date', 'ASC']]
  });

  const report = batches.map(batch => {
    const daysToExpiry = Math.ceil((new Date(batch.expiry_date) - today) / (1000 * 60 * 60 * 24));
    let status = 'normal';
    if (daysToExpiry <= 0) status = 'expired';
    else if (daysToExpiry <= 7) status = 'critical';
    else if (daysToExpiry <= 15) status = 'warning';
    else if (daysToExpiry <= 30) status = 'attention';

    return {
      id: batch.id,
      batch_no: batch.batch_no,
      material_id: batch.material_id,
      production_date: batch.production_date,
      expiry_date: batch.expiry_date,
      days_to_expiry: daysToExpiry,
      expiry_status: status,
      quantity: batch.quantity,
      batch_status: batch.status
    };
  });

  ApiResponse.success(res, {
    report,
    summary: {
      total: report.length,
      expired: report.filter(r => r.expiry_status === 'expired').length,
      critical: report.filter(r => r.expiry_status === 'critical').length,
      warning: report.filter(r => r.expiry_status === 'warning').length,
      attention: report.filter(r => r.expiry_status === 'attention').length,
      normal: report.filter(r => r.expiry_status === 'normal').length
    }
  });
});

module.exports = {
  getAllBatches,
  getBatchById,
  getBatchByNo,
  createBatch,
  updateBatch,
  updateBatchStatus,
  deleteBatch,
  getBatchStats,
  getExpiryWarnings,
  markBatchExpired,
  getBatchExpiryReport
};