const crypto = require('crypto');
const { Op } = require('sequelize');
const TraceRecord = require('../models/TraceRecord');
const ApiResponse = require('../../../../shared/utils/response');
const { catchAsync, AppError } = require('../../../../shared/utils/errorHandler');
const { ROLES, PERMISSIONS, TRACE_STAGES } = require('../../../../shared/constants');

const calculateHash = (record) => {
  const data = `${record.batch_id}${record.stage}${record.timestamp}${record.operator}${JSON.stringify(record.location || {})}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

const createRecord = catchAsync(async (req, res, next) => {
  const { batchId, stage, operator, operatorId, location, timestamp, description, images, videos, documents, temperature, humidity, metadata } = req.body;
  const lastRecord = await TraceRecord.findOne({ where: { batch_id: batchId }, order: [['timestamp', 'DESC']] });
  const record = await TraceRecord.create({
    batch_id: batchId, stage, operator, operator_id: operatorId, location,
    timestamp: timestamp || new Date(), description, images, videos, documents,
    temperature, humidity, metadata, previous_hash: lastRecord?.current_hash
  });
  record.current_hash = calculateHash(record);
  await record.save();
  ApiResponse.created(res, record, '溯源数据采集成功');
});

const getRecordsByBatch = catchAsync(async (req, res, next) => {
  const { page = 1, size = 50, stage, startDate, endDate } = req.query;
  const where = { batch_id: req.params.batchId };
  if (stage) where.stage = stage;
  if (startDate) where.timestamp = { [Op.gte]: new Date(startDate) };
  if (endDate) where.timestamp = { ...where.timestamp, [Op.lte]: new Date(endDate) };
  const { count, rows } = await TraceRecord.findAndCountAll({
    where, limit: parseInt(size), offset: (parseInt(page) - 1) * parseInt(size), order: [['timestamp', 'ASC']]
  });
  ApiResponse.paginated(res, rows, page, size, count);
});

const getFullTraceChain = catchAsync(async (req, res, next) => {
  const records = await TraceRecord.findAll({
    where: { batch_id: req.params.batchId }, order: [['timestamp', 'ASC']]
  });
  let isValid = true;
  for (let i = 1; i < records.length; i++) {
    if (records[i].previous_hash !== records[i - 1].current_hash) {
      isValid = false;
      break;
    }
  }
  ApiResponse.success(res, { records, chainValid: isValid });
});

const getRecordById = catchAsync(async (req, res, next) => {
  const record = await TraceRecord.findByPk(req.params.id);
  if (!record) return next(new AppError('记录不存在', 404));
  ApiResponse.success(res, record);
});

const updateRecord = catchAsync(async (req, res, next) => {
  const record = await TraceRecord.findByPk(req.params.id);
  if (!record) return next(new AppError('记录不存在', 404));
  const { description, images, videos, documents, metadata } = req.body;
  await record.update({ description, images, videos, documents, metadata });
  ApiResponse.success(res, record, '记录更新成功');
});

const verifyChain = catchAsync(async (req, res, next) => {
  const records = await TraceRecord.findAll({
    where: { batch_id: req.params.batchId }, order: [['timestamp', 'ASC']]
  });
  const issues = [];
  for (let i = 0; i < records.length; i++) {
    const calculatedHash = calculateHash(records[i]);
    if (calculatedHash !== records[i].current_hash) {
      issues.push({ recordId: records[i].id, stage: records[i].stage, issue: '数据被篡改' });
    }
    if (i > 0 && records[i].previous_hash !== records[i - 1].current_hash) {
      issues.push({ recordId: records[i].id, stage: records[i].stage, issue: '链条断裂' });
    }
  }
  ApiResponse.success(res, { valid: issues.length === 0, issues, totalRecords: records.length });
});

const getStats = catchAsync(async (req, res, next) => {
  const stages = Object.values(TRACE_STAGES);
  const stats = {};
  for (const stage of stages) {
    stats[stage] = await TraceRecord.count({ where: { stage } });
  }
  stats.total = await TraceRecord.count();
  ApiResponse.success(res, stats);
});

const exportTraceData = catchAsync(async (req, res, next) => {
  const { batchIds, stages, startDate, endDate, format = 'json', includeHashInfo = true } = req.body;

  const where = {};
  if (batchIds && batchIds.length > 0) {
    where.batch_id = { [Op.in]: batchIds };
  }
  if (stages && stages.length > 0) {
    where.stage = { [Op.in]: stages };
  }
  if (startDate) where.timestamp = { [Op.gte]: new Date(startDate) };
  if (endDate) where.timestamp = { ...where.timestamp, [Op.lte]: new Date(endDate) };

  const records = await TraceRecord.findAll({
    where,
    order: [['batch_id', 'ASC'], ['timestamp', 'ASC']]
  });

  const groupedRecords = {};
  for (const record of records) {
    if (!groupedRecords[record.batch_id]) {
      groupedRecords[record.batch_id] = [];
    }
    groupedRecords[record.batch_id].push(record);
  }

  const exportData = {
    exportInfo: {
      exportTime: new Date().toISOString(),
      recordCount: records.length,
      batchCount: Object.keys(groupedRecords).length,
      filters: { batchIds, stages, startDate, endDate }
    },
    batches: []
  };

  for (const [batchId, batchRecords] of Object.entries(groupedRecords)) {
    let chainValid = true;
    const chainIssues = [];
    
    for (let i = 0; i < batchRecords.length; i++) {
      if (includeHashInfo) {
        const calculatedHash = calculateHash(batchRecords[i]);
        if (calculatedHash !== batchRecords[i].current_hash) {
          chainValid = false;
          chainIssues.push({
            recordId: batchRecords[i].id,
            stage: batchRecords[i].stage,
            issue: '数据被篡改',
            index: i
          });
        }
        if (i > 0 && batchRecords[i].previous_hash !== batchRecords[i - 1].current_hash) {
          chainValid = false;
          chainIssues.push({
            recordId: batchRecords[i].id,
            stage: batchRecords[i].stage,
            issue: '链条断裂',
            index: i
          });
        }
      }
    }

    exportData.batches.push({
      batchId,
      recordCount: batchRecords.length,
      chainValid,
      chainIssues: includeHashInfo ? chainIssues : undefined,
      records: batchRecords.map(r => ({
        id: r.id,
        stage: r.stage,
        timestamp: r.timestamp,
        operator: r.operator,
        location: r.location,
        description: r.description,
        temperature: r.temperature,
        humidity: r.humidity,
        images: r.images,
        videos: r.videos,
        documents: r.documents,
        metadata: r.metadata,
        previous_hash: includeHashInfo ? r.previous_hash : undefined,
        current_hash: includeHashInfo ? r.current_hash : undefined
      }))
    });
  }

  if (format === 'csv') {
    const csvHeaders = ['批次ID', '阶段', '时间', '操作人', '地点', '描述', '温度', '湿度', '哈希校验'];
    const csvRows = records.map(r => [
      r.batch_id,
      r.stage,
      r.timestamp.toISOString(),
      r.operator,
      JSON.stringify(r.location || {}),
      r.description || '',
      r.temperature || '',
      r.humidity || '',
      calculateHash(r) === r.current_hash ? '有效' : '无效'
    ]);
    
    const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="trace_export_${Date.now()}.csv"`);
    return res.send('\uFEFF' + csvContent);
  }

  if (format === 'excel' || format === 'xlsx') {
    const excelData = {
      ...exportData,
      downloadUrl: `/api/trace/download/${Date.now()}.xlsx`
    };
    ApiResponse.success(res, excelData, '溯源数据导出成功');
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="trace_export_${Date.now()}.json"`);
  ApiResponse.success(res, exportData, '溯源数据导出成功');
});

const getTraceStatistics = catchAsync(async (req, res, next) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  const where = {};
  if (startDate) where.timestamp = { [Op.gte]: new Date(startDate) };
  if (endDate) where.timestamp = { ...where.timestamp, [Op.lte]: new Date(endDate) };

  const records = await TraceRecord.findAll({ where, order: [['timestamp', 'ASC']] });

  const stageDistribution = {};
  const operatorStats = {};
  const timeDistribution = {};

  for (const record of records) {
    stageDistribution[record.stage] = (stageDistribution[record.stage] || 0) + 1;
    
    if (record.operator) {
      operatorStats[record.operator] = (operatorStats[record.operator] || 0) + 1;
    }

    const dateKey = record.timestamp.toISOString().split('T')[0];
    if (!timeDistribution[dateKey]) {
      timeDistribution[dateKey] = {};
    }
    timeDistribution[dateKey][record.stage] = (timeDistribution[dateKey][record.stage] || 0) + 1;
  }

  ApiResponse.success(res, {
    totalRecords: records.length,
    stageDistribution,
    topOperators: Object.entries(operatorStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
    timeDistribution: Object.entries(timeDistribution)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, stages]) => ({ date, ...stages }))
  });
});

const batchVerifyChains = catchAsync(async (req, res, next) => {
  const { batchIds } = req.body;
  const results = [];

  for (const batchId of batchIds) {
    const records = await TraceRecord.findAll({
      where: { batch_id: batchId },
      order: [['timestamp', 'ASC']]
    });

    let isValid = true;
    const issues = [];

    for (let i = 0; i < records.length; i++) {
      const calculatedHash = calculateHash(records[i]);
      if (calculatedHash !== records[i].current_hash) {
        isValid = false;
        issues.push({ recordId: records[i].id, stage: records[i].stage, issue: '数据被篡改' });
      }
      if (i > 0 && records[i].previous_hash !== records[i - 1].current_hash) {
        isValid = false;
        issues.push({ recordId: records[i].id, stage: records[i].stage, issue: '链条断裂' });
      }
    }

    results.push({
      batchId,
      recordCount: records.length,
      isValid,
      issueCount: issues.length,
      issues
    });
  }

  ApiResponse.success(res, {
    totalBatches: batchIds.length,
    validBatches: results.filter(r => r.isValid).length,
    invalidBatches: results.filter(r => !r.isValid).length,
    results
  });
});

module.exports = { 
  createRecord, 
  getRecordsByBatch, 
  getFullTraceChain, 
  getRecordById, 
  updateRecord, 
  verifyChain, 
  getStats,
  exportTraceData,
  getTraceStatistics,
  batchVerifyChains
};