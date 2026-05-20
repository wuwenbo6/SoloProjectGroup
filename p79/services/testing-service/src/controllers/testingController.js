const crypto = require('crypto');
const { Op } = require('sequelize');
const TestingReport = require('../models/TestingReport');
const TestingInstitution = require('../models/TestingInstitution');
const ApiResponse = require('../../../../shared/utils/response');
const { catchAsync, AppError } = require('../../../../shared/utils/errorHandler');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const generateApiKey = () => {
  return 'tk_' + crypto.randomBytes(32).toString('hex');
};

const normalizeTestingData = (data) => {
  const fieldMapping = {
    'reportNo': 'report_no',
    'report_no': 'report_no',
    'batchId': 'batch_id',
    'batch_id': 'batch_id',
    'testItems': 'test_items',
    'test_items': 'test_items',
    'overallResult': 'overall_result',
    'overall_result': 'overall_result',
    'reportFile': 'report_file',
    'report_file': 'report_file',
    'testedBy': 'tested_by',
    'tested_by': 'tested_by',
    'testedAt': 'tested_at',
    'tested_at': 'tested_at'
  };

  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = fieldMapping[key] || key;
    normalized[normalizedKey] = value;
  }

  if (!normalized.report_no && normalized.reportNo) {
    normalized.report_no = normalized.reportNo;
  }
  if (!normalized.batch_id && normalized.batchId) {
    normalized.batch_id = normalized.batchId;
  }
  if (!normalized.test_items && normalized.testItems) {
    normalized.test_items = normalized.testItems;
  }
  if (!normalized.overall_result && normalized.overallResult) {
    normalized.overall_result = normalized.overallResult;
  }
  if (!normalized.report_file && normalized.reportFile) {
    normalized.report_file = normalized.reportFile;
  }
  if (!normalized.tested_by && normalized.testedBy) {
    normalized.tested_by = normalized.testedBy;
  }
  if (!normalized.tested_at && normalized.testedAt) {
    normalized.tested_at = normalized.testedAt;
  }

  if (normalized.overall_result) {
    normalized.overall_result = normalized.overall_result.toLowerCase();
  }

  return normalized;
};

const syncTestingData = catchAsync(async (req, res, next) => {
  const normalizedData = normalizeTestingData(req.body);
  const { report_no, batch_id, test_items, conclusion, overall_result, report_file, attachments, tested_by, tested_at } = normalizedData;

  if (!report_no) {
    return next(new AppError('报告编号不能为空', 400));
  }
  if (!batch_id) {
    return next(new AppError('批次ID不能为空', 400));
  }
  if (!test_items || (Array.isArray(test_items) && test_items.length === 0)) {
    return next(new AppError('检测项目不能为空', 400));
  }

  const existingReport = await TestingReport.findOne({ where: { report_no } });
  if (existingReport) {
    return next(new AppError('报告编号已存在', 409));
  }

  const report = await TestingReport.create({
    institution_id: req.institution.id,
    batch_id,
    report_no,
    test_items,
    conclusion,
    overall_result: overall_result || 'pending',
    report_file,
    attachments: attachments || [],
    tested_by,
    tested_at: tested_at || new Date(),
    synced_at: new Date()
  });

  ApiResponse.created(res, report, '检测数据同步成功');
});

const createInstitution = catchAsync(async (req, res, next) => {
  const { name, code, certificationNo, contactInfo, address, description } = req.body;
  const existingCode = await TestingInstitution.findOne({ where: { code } });
  if (existingCode) return next(new AppError('机构代码已存在', 409));
  const apiKey = generateApiKey();
  const institution = await TestingInstitution.create({
    name, code, api_key: apiKey, certification_no: certificationNo, contact_info: contactInfo, address, description
  });
  ApiResponse.created(res, institution, '检测机构创建成功');
});

const getAllInstitutions = catchAsync(async (req, res, next) => {
  const { page = 1, size = 20, status } = req.query;
  const where = status ? { status } : {};
  const { count, rows } = await TestingInstitution.findAndCountAll({
    where, limit: parseInt(size), offset: (parseInt(page) - 1) * parseInt(size), order: [['created_at', 'DESC']]
  });
  ApiResponse.paginated(res, rows, page, size, count);
});

const getInstitutionById = catchAsync(async (req, res, next) => {
  const institution = await TestingInstitution.findByPk(req.params.id);
  if (!institution) return next(new AppError('检测机构不存在', 404));
  ApiResponse.success(res, institution);
});

const updateInstitution = catchAsync(async (req, res, next) => {
  const institution = await TestingInstitution.findByPk(req.params.id);
  if (!institution) return next(new AppError('检测机构不存在', 404));
  const { name, certificationNo, contactInfo, address, status, description } = req.body;
  await institution.update({ name, certification_no: certificationNo, contact_info: contactInfo, address, status, description });
  ApiResponse.success(res, institution, '检测机构更新成功');
});

const regenerateApiKey = catchAsync(async (req, res, next) => {
  const institution = await TestingInstitution.findByPk(req.params.id);
  if (!institution) return next(new AppError('检测机构不存在', 404));
  const apiKey = generateApiKey();
  await institution.update({ api_key: apiKey });
  ApiResponse.success(res, { apiKey }, 'API Key 重新生成成功');
});

const getReports = catchAsync(async (req, res, next) => {
  const { page = 1, size = 20, batchId, institutionId, overallResult, verified } = req.query;
  const where = {};
  if (batchId) where.batch_id = batchId;
  if (institutionId) where.institution_id = institutionId;
  if (overallResult) where.overall_result = overallResult;
  if (verified !== undefined) where.verified = verified === 'true';
  const { count, rows } = await TestingReport.findAndCountAll({
    where, include: [{ model: TestingInstitution, as: 'institution', attributes: ['id', 'name', 'code'] }],
    limit: parseInt(size), offset: (parseInt(page) - 1) * parseInt(size), order: [['created_at', 'DESC']]
  });
  ApiResponse.paginated(res, rows, page, size, count);
});

const getReportById = catchAsync(async (req, res, next) => {
  const report = await TestingReport.findByPk(req.params.id, {
    include: [{ model: TestingInstitution, as: 'institution', attributes: ['id', 'name', 'code'] }]
  });
  if (!report) return next(new AppError('检测报告不存在', 404));
  ApiResponse.success(res, report);
});

const verifyReport = catchAsync(async (req, res, next) => {
  const report = await TestingReport.findByPk(req.params.id);
  if (!report) return next(new AppError('检测报告不存在', 404));
  const { verified, remarks } = req.body;
  await report.update({ verified, verified_by: req.user.id, verified_at: new Date(), remarks: remarks ? `${report.remarks || ''}\n${remarks}` : report.remarks });
  ApiResponse.success(res, report, verified ? '报告已验证通过' : '报告已取消验证');
});

const getStats = catchAsync(async (req, res, next) => {
  const [total, verified, pass, fail] = await Promise.all([
    TestingReport.count(),
    TestingReport.count({ where: { verified: true } }),
    TestingReport.count({ where: { overall_result: 'pass' } }),
    TestingReport.count({ where: { overall_result: 'fail' } })
  ]);
  ApiResponse.success(res, { total, verified, pass, fail, pending: total - verified });
});

module.exports = {
  syncTestingData, createInstitution, getAllInstitutions, getInstitutionById, updateInstitution,
  regenerateApiKey, getReports, getReportById, verifyReport, getStats
};