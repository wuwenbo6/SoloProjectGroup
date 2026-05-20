const { successResponse, errorResponse, paginatedResponse } = require('../../../shared/utils/response');
const QualityInspection = require('../models/QualityInspection');

let qualityInspectionModel;

const initModels = (pool) => {
  qualityInspectionModel = new QualityInspection(pool);
};

const PRECISION = 10000;

const round = (num, precision = 2) => {
  const factor = Math.pow(10, precision);
  return Math.round((num + Number.EPSILON) * factor) / factor;
};

const safeMultiply = (a, b) => {
  return round(a * b, 4);
};

const safeDivide = (a, b) => {
  if (b === 0) return 0;
  return round(a / b, 4);
};

const safeSum = (numbers) => {
  return numbers.reduce((acc, val) => round(acc + val, 4), 0);
};

const createInspection = async (req, res) => {
  try {
    const inspection = await qualityInspectionModel.create({
      ...req.body,
      inspector_id: req.user.id,
      inspector_name: req.user.username
    });
    successResponse(res, inspection, '品质检验创建成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getInspections = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filters = {
      batch_id: req.query.batch_id,
      grade: req.query.grade,
      is_qualified: req.query.is_qualified
    };

    const result = await qualityInspectionModel.findAll(filters, page, limit);
    paginatedResponse(res, result.inspections, page, limit, result.total, '获取检验列表成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const inspection = await qualityInspectionModel.findById(id);
    if (!inspection) {
      return errorResponse(res, '检验记录不存在', 404);
    }
    successResponse(res, inspection, '获取检验记录成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getInspectionsByBatch = async (req, res) => {
  try {
    const { batch_id } = req.params;
    const inspections = await qualityInspectionModel.findByBatchId(batch_id);
    successResponse(res, inspections, '获取批次检验记录成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getGrades = async (req, res) => {
  try {
    const grades = await qualityInspectionModel.getGrades();
    successResponse(res, grades, '获取品质等级成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const calculateQualityScore = async (req, res) => {
  try {
    const { parameters, weights } = req.body;
    
    const weightedScores = [];
    const results = [];

    for (const param of parameters) {
      const weight = weights[param.name] || 1;
      const score = param.score || 0;
      const weightedScore = safeMultiply(score, weight);
      weightedScores.push(weightedScore);
      results.push({
        name: param.name,
        score: round(score, 2),
        weight: round(weight, 2),
        weighted_score: round(weightedScore, 4)
      });
    }

    const totalScore = safeSum(weightedScores);
    const totalWeight = safeSum(parameters.map(p => weights[p.name] || 1));
    const finalScore = safeDivide(totalScore, totalWeight);
    const grade = await qualityInspectionModel.calculateGrade(finalScore);

    successResponse(res, {
      parameters: results,
      total_score: round(finalScore, 2),
      total_weight: round(totalScore, 4),
      grade: grade ? grade.grade_code : null,
      grade_name: grade ? grade.grade_name : null,
      min_score: grade ? round(grade.min_score, 2) : null,
      max_score: grade ? round(grade.max_score, 2) : null,
      is_qualified: grade ? grade.grade_code !== 'UNQUALIFIED' : false
    }, '品质评分计算成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

module.exports = {
  initModels,
  createInspection,
  getInspections,
  getInspection,
  getInspectionsByBatch,
  getGrades,
  calculateQualityScore
};
