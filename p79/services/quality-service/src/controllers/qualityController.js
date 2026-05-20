const { Op, Transaction } = require('sequelize');
const QualityReport = require('../models/QualityReport');
const QualityStandard = require('../models/QualityStandard');
const sequelize = require('../config/database');
const ApiResponse = require('../../../../shared/utils/response');
const { catchAsync, AppError } = require('../../../../shared/utils/errorHandler');
const { ROLES, PERMISSIONS, QUALITY_GRADES } = require('../../../../shared/constants');
const crypto = require('crypto');

const PRECISION = 10000;

const toInt = (num) => Math.round(Number(num) * PRECISION);
const toFloat = (num) => num / PRECISION;

const mul = (a, b) => Math.round(Number(a) * Number(b) * PRECISION) / PRECISION;
const div = (a, b) => Math.round((Number(a) / Number(b)) * PRECISION) / PRECISION;
const add = (a, b) => Math.round((Number(a) + Number(b)) * PRECISION) / PRECISION;

const generateReportNo = async (retryCount = 0, maxRetries = 5) => {
  const t = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
  });

  try {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();

    const result = await sequelize.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(report_no, 12, 4) AS INTEGER)), 0) as max_num 
       FROM quality_reports WHERE report_no LIKE :prefix`,
      {
        replacements: { prefix: `QR${dateStr}%` },
        type: sequelize.QueryTypes.SELECT,
        transaction: t
      }
    );

    const maxNum = result[0].max_num;
    const sequenceNum = String(maxNum + 1).padStart(4, '0');
    const reportNo = `QR${dateStr}${sequenceNum}${randomSuffix}`;

    const existing = await QualityReport.findOne({
      where: { report_no: reportNo },
      transaction: t,
      lock: true
    });

    if (existing) {
      await t.rollback();
      if (retryCount < maxRetries) {
        return generateReportNo(retryCount + 1, maxRetries);
      }
      throw new Error('报告编号生成失败，已达最大重试次数');
    }

    await t.commit();
    return reportNo;
  } catch (error) {
    await t.rollback();
    if (retryCount < maxRetries) {
      return generateReportNo(retryCount + 1, maxRetries);
    }
    throw error;
  }
};

const calculateScore = (indicators, weights) => {
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const [key, value] of Object.entries(indicators)) {
    const weight = weights[key] || 0;
    const weightedScore = mul(Number(value) || 0, weight);
    totalScore = add(totalScore, weightedScore);
    totalWeight = add(totalWeight, weight);
  }
  
  const finalScore = totalWeight > 0 ? div(totalScore, totalWeight) : 0;
  return Number(finalScore.toFixed(2));
};

const determineGrade = (score, thresholds) => {
  if (score >= (thresholds?.A || 90)) return 'A';
  if (score >= (thresholds?.B || 80)) return 'B';
  if (score >= (thresholds?.C || 70)) return 'C';
  return 'D';
};

const evaluate = catchAsync(async (req, res, next) => {
  const { batchId, indicators, standardVersion, inspectorName, remarks } = req.body;
  const standard = await QualityStandard.findOne({ where: { version: standardVersion || '1.0', status: 'active' } });
  if (!standard) return next(new AppError('找不到对应的品质标准', 400));
  const score = calculateScore(indicators, standard.weights);
  const grade = determineGrade(score, standard.grade_thresholds);
  const reportNo = await generateReportNo();
  const report = await QualityReport.create({
    batch_id: batchId, report_no: reportNo, grade, score, indicators,
    details: { standard: standard.name }, standard_version: standard.version,
    inspector_id: req.user.id, inspector_name: inspectorName, remarks
  });
  ApiResponse.created(res, report, '品质分级完成');
});

const getReportById = catchAsync(async (req, res, next) => {
  const report = await QualityReport.findByPk(req.params.id);
  if (!report) return next(new AppError('报告不存在', 404));
  ApiResponse.success(res, report);
});

const getReportsByBatch = catchAsync(async (req, res, next) => {
  const reports = await QualityReport.findAll({ where: { batch_id: req.params.batchId }, order: [['created_at', 'DESC']] });
  ApiResponse.success(res, reports);
});

const getAllReports = catchAsync(async (req, res, next) => {
  const { page = 1, size = 20, grade, status, startDate, endDate } = req.query;
  const where = {};
  if (grade) where.grade = grade;
  if (status) where.status = status;
  if (startDate) where.created_at = { [Op.gte]: new Date(startDate) };
  if (endDate) where.created_at = { ...where.created_at, [Op.lte]: new Date(endDate) };
  const { count, rows } = await QualityReport.findAndCountAll({
    where, limit: parseInt(size), offset: (parseInt(page) - 1) * parseInt(size), order: [['created_at', 'DESC']]
  });
  ApiResponse.paginated(res, rows, page, size, count);
});

const approveReport = catchAsync(async (req, res, next) => {
  const report = await QualityReport.findByPk(req.params.id);
  if (!report) return next(new AppError('报告不存在', 404));
  const { approved, remarks } = req.body;
  await report.update({ status: approved ? 'approved' : 'rejected', approved_by: req.user.id, approved_at: new Date(), remarks: remarks ? `${report.remarks || ''}\n${remarks}` : report.remarks });
  ApiResponse.success(res, report, approved ? '报告已批准' : '报告已拒绝');
});

const createStandard = catchAsync(async (req, res, next) => {
  const { name, version, materialCategory, indicators, weights, gradeThresholds, description } = req.body;
  const standard = await QualityStandard.create({ name, version, material_category: materialCategory, indicators, weights, grade_thresholds: gradeThresholds, description, created_by: req.user.id });
  ApiResponse.created(res, standard, '品质标准创建成功');
});

const getStandards = catchAsync(async (req, res, next) => {
  const { status, materialCategory } = req.query;
  const where = {};
  if (status) where.status = status;
  if (materialCategory) where.material_category = materialCategory;
  const standards = await QualityStandard.findAll({ where, order: [['created_at', 'DESC']] });
  ApiResponse.success(res, standards);
});

const getStats = catchAsync(async (req, res, next) => {
  const stats = {};
  for (const grade of QUALITY_GRADES) {
    stats[grade] = await QualityReport.count({ where: { grade } });
  }
  stats.total = await QualityReport.count();
  stats.approved = await QualityReport.count({ where: { status: 'approved' } });
  stats.pending = await QualityReport.count({ where: { status: 'pending' } });
  ApiResponse.success(res, stats);
});

module.exports = { evaluate, getReportById, getReportsByBatch, getAllReports, approveReport, createStandard, getStandards, getStats };