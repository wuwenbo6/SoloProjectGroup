const ProcessTemplate = require('../models/process/ProcessTemplate');
const ProductionRecord = require('../models/production/ProductionRecord');
const Batch = require('../models/production/Batch');
const QualityInspection = require('../models/quality/QualityInspection');
const ParameterAlert = require('../models/production/ParameterAlert');
const logger = require('../config/logger');

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toISOString().slice(0, 10);
};

const formatDateTime = (date) => {
  if (!date) return '';
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
};

const exportProcessTemplates = async (req, res) => {
  try {
    const { propType, isActive, format = 'json' } = req.query;

    const query = {};
    if (propType) query.propType = propType;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const templates = await ProcessTemplate.find(query).sort({ createdAt: -1 });

    if (format === 'csv') {
      const csvData = templates.map(t => ({
        模板ID: t._id,
        模板名称: t.templateName,
        道具类型: t.propType,
        道具名称: t.propName,
        描述: t.description || '',
        版本: t.version || '1.0',
        步骤数量: t.steps.length,
        材料数量: (t.materials || []).length,
        创建者: t.createdBy,
        创建时间: formatDateTime(t.createdAt),
        更新时间: formatDateTime(t.updatedAt),
        是否激活: t.isActive ? '是' : '否'
      }));

      const headers = Object.keys(csvData[0] || {});
      const csv = [
        headers.join(','),
        ...csvData.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=process_templates_${formatDate(new Date())}.csv`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({
        success: true,
        data: {
          templates,
          count: templates.length,
          exportedAt: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('导出工艺模板失败:', error);
    res.status(500).json({
      success: false,
      message: '导出工艺模板失败',
      error: error.message
    });
  }
};

const exportProductionRecords = async (req, res) => {
  try {
    const { batchId, status, startDate, endDate, format = 'json' } = req.query;

    const query = {};
    if (batchId) query.batchId = batchId;
    if (status) query.status = status;
    if (startDate) query.createdAt = { $gte: new Date(startDate) };
    if (endDate) query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };

    const records = await ProductionRecord.find(query).sort({ createdAt: -1 });

    if (format === 'csv') {
      const csvData = records.map(r => {
        const totalSteps = r.steps.length;
        const completedSteps = r.steps.filter(s => s.status === 'completed').length;
        const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

        return {
          生产记录ID: r._id,
          批次ID: r.batchId || '',
          道具序列号: r.propSerialNumber,
          道具名称: r.propName || '',
          状态: getStatusText(r.status),
          总步骤数: totalSteps,
          已完成步骤: completedSteps,
          进度百分比: `${progress}%`,
          当前步骤: r.currentStep || 0,
          开始时间: formatDateTime(r.startedAt),
          完成时间: formatDateTime(r.completedAt),
          创建时间: formatDateTime(r.createdAt),
          更新时间: formatDateTime(r.updatedAt)
        };
      });

      const headers = Object.keys(csvData[0] || {});
      const csv = [
        headers.join(','),
        ...csvData.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=production_records_${formatDate(new Date())}.csv`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({
        success: true,
        data: {
          records,
          count: records.length,
          exportedAt: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('导出生产记录失败:', error);
    res.status(500).json({
      success: false,
      message: '导出生产记录失败',
      error: error.message
    });
  }
};

const getStatusText = (status) => {
  const statusMap = {
    'not_started': '未开始',
    'in_progress': '进行中',
    'completed': '已完成',
    'on_hold': '暂停',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
};

const exportQualityReports = async (req, res) => {
  try {
    const { batchId, overallResult, startDate, endDate, format = 'json' } = req.query;

    const query = {};
    if (batchId) query.batchId = batchId;
    if (overallResult) query.overallResult = overallResult;
    if (startDate) query.createdAt = { $gte: new Date(startDate) };
    if (endDate) query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };

    const inspections = await QualityInspection.find(query).sort({ createdAt: -1 });

    if (format === 'csv') {
      const csvData = inspections.map(i => ({
        检测编号: i.inspectionNumber,
        生产记录ID: i.productionRecordId,
        批次ID: i.batchId || '',
        道具序列号: i.propSerialNumber,
        检测类型: getInspectionTypeText(i.inspectionType),
        检测阶段: i.inspectionStage || '',
        总体结果: getInspectionResultText(i.overallResult),
        检测项数量: (i.inspectionItems || []).length,
        通过项数: (i.inspectionItems || []).filter(item => item.result === 'pass').length,
        不合格项数: (i.inspectionItems || []).filter(item => item.result === 'fail').length,
        检测日期: formatDateTime(i.inspectionDate),
        备注: i.notes || '',
        是否同步: i.isSynced ? '是' : '否',
        同步时间: formatDateTime(i.syncedAt),
        创建时间: formatDateTime(i.createdAt)
      }));

      const headers = Object.keys(csvData[0] || {});
      const csv = [
        headers.join(','),
        ...csvData.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=quality_reports_${formatDate(new Date())}.csv`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({
        success: true,
        data: {
          inspections,
          count: inspections.length,
          exportedAt: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('导出品质报告失败:', error);
    res.status(500).json({
      success: false,
      message: '导出品质报告失败',
      error: error.message
    });
  }
};

const getInspectionTypeText = (type) => {
  const typeMap = {
    'in_process': '过程检测',
    'final': '最终检测',
    'spot_check': '抽查',
    'third_party': '第三方检测'
  };
  return typeMap[type] || type;
};

const getInspectionResultText = (result) => {
  const resultMap = {
    'pass': '通过',
    'fail': '不合格',
    'pending': '待检测',
    're_inspection_required': '需复检'
  };
  return resultMap[result] || result;
};

const exportBatchReports = async (req, res) => {
  try {
    const { status, priority, startDate, endDate, format = 'json' } = req.query;

    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (startDate) query.createdAt = { $gte: new Date(startDate) };
    if (endDate) query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };

    const batches = await Batch.find(query).sort({ createdAt: -1 });

    const batchIds = batches.map(b => b._id);
    const [recordCounts, qualityStats] = await Promise.all([
      ProductionRecord.aggregate([
        { $match: { batchId: { $in: batchIds } } },
        { $group: { _id: '$batchId', count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } }
      ]),
      QualityInspection.aggregate([
        { $match: { batchId: { $in: batchIds } } },
        { $group: { _id: '$batchId', total: { $sum: 1 }, pass: { $sum: { $cond: [{ $eq: ['$overallResult', 'pass'] }, 1, 0] } } } }
      ])
    ]);

    if (format === 'csv') {
      const csvData = batches.map(b => {
        const stats = recordCounts.find(s => String(s._id) === String(b._id)) || { count: 0, completed: 0 };
        const quality = qualityStats.find(q => String(q._id) === String(b._id)) || { total: 0, pass: 0 };

        return {
          批次编号: b.batchNumber,
          批次ID: b._id,
          道具名称: b.propName,
          道具类型: b.propType || '',
          状态: getBatchStatusText(b.status),
          优先级: getPriorityText(b.priority),
          计划数量: b.quantity,
          已生产数量: stats.count,
          完成率: stats.count > 0 ? `${Math.round((stats.completed / stats.count) * 100)}%` : '0%',
          检测总数: quality.total,
          检测通过数: quality.pass,
          检测合格率: quality.total > 0 ? `${Math.round((quality.pass / quality.total) * 100)}%` : '0%',
          计划开始日期: formatDate(b.plannedStartDate),
          计划完成日期: formatDate(b.plannedEndDate),
          实际开始日期: formatDate(b.actualStartDate),
          实际完成日期: formatDate(b.actualEndDate),
          备注: b.notes || '',
          创建时间: formatDateTime(b.createdAt)
        };
      });

      const headers = Object.keys(csvData[0] || {});
      const csv = [
        headers.join(','),
        ...csvData.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=batch_reports_${formatDate(new Date())}.csv`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({
        success: true,
        data: {
          batches,
          recordCounts,
          qualityStats,
          count: batches.length,
          exportedAt: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('导出批次报告失败:', error);
    res.status(500).json({
      success: false,
      message: '导出批次报告失败',
      error: error.message
    });
  }
};

const getBatchStatusText = (status) => {
  const statusMap = {
    'planned': '计划中',
    'in_progress': '进行中',
    'completed': '已完成',
    'suspended': '已暂停',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
};

const getPriorityText = (priority) => {
  const priorityMap = {
    'low': '低',
    'medium': '中',
    'high': '高',
    'urgent': '紧急'
  };
  return priorityMap[priority] || priority;
};

const exportAlertReports = async (req, res) => {
  try {
    const { severity, status, alertType, startDate, endDate, format = 'json' } = req.query;

    const query = {};
    if (severity) query.severity = severity;
    if (status) query.status = status;
    if (alertType) query.alertType = alertType;
    if (startDate) query.createdAt = { $gte: new Date(startDate) };
    if (endDate) query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };

    const alerts = await ParameterAlert.find(query).sort({ createdAt: -1 });

    if (format === 'csv') {
      const csvData = alerts.map(a => ({
        预警编号: a.alertCode,
        生产记录ID: a.productionRecordId,
        批次ID: a.batchId || '',
        道具序列号: a.propSerialNumber,
        步骤名称: a.stepName,
        步骤索引: a.stepIndex,
        参数名称: a.parameterName,
        参数值: a.parameterValue,
        预警类型: getAlertTypeText(a.alertType),
        严重程度: getSeverityText(a.severity),
        状态: getAlertStatusText(a.status),
        偏离值: a.deviation || '',
        偏离百分比: a.deviationPercent ? `${a.deviationPercent}%` : '',
        描述: a.description || '',
        是否自动生成: a.isAutoGenerated ? '是' : '否',
        确认人: a.acknowledgedBy || '',
        确认时间: formatDateTime(a.acknowledgedAt),
        解决人: a.resolvedBy || '',
        解决时间: formatDateTime(a.resolvedAt),
        创建时间: formatDateTime(a.createdAt)
      }));

      const headers = Object.keys(csvData[0] || {});
      const csv = [
        headers.join(','),
        ...csvData.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=alert_reports_${formatDate(new Date())}.csv`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({
        success: true,
        data: {
          alerts,
          count: alerts.length,
          exportedAt: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('导出预警报告失败:', error);
    res.status(500).json({
      success: false,
      message: '导出预警报告失败',
      error: error.message
    });
  }
};

const getAlertTypeText = (type) => {
  const typeMap = {
    'threshold_exceeded': '阈值超限',
    'abnormal_value': '数值异常',
    'missing_parameter': '参数缺失',
    'timing_anomaly': '时序异常',
    'quality_deviation': '品质偏差',
    'equipment_fault': '设备故障'
  };
  return typeMap[type] || type;
};

const getSeverityText = (severity) => {
  const severityMap = {
    'low': '低',
    'medium': '中',
    'high': '高',
    'critical': '严重'
  };
  return severityMap[severity] || severity;
};

const getAlertStatusText = (status) => {
  const statusMap = {
    'pending': '待处理',
    'acknowledged': '已确认',
    'resolved': '已解决',
    'ignored': '已忽略'
  };
  return statusMap[status] || status;
};

const getReportStats = async (req, res) => {
  try {
    const [templateStats, productionStats, qualityStats, alertStats, batchStats] = await Promise.all([
      ProcessTemplate.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ['$isActive', 1, 0] } }
          }
        }
      ]),
      ProductionRecord.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      QualityInspection.aggregate([
        {
          $group: {
            _id: '$overallResult',
            count: { $sum: 1 }
          }
        }
      ]),
      ParameterAlert.aggregate([
        { $match: { status: { $ne: 'resolved' } } },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 }
          }
        }
      ]),
      Batch.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        templates: templateStats[0] || { total: 0, active: 0 },
        production: productionStats,
        quality: qualityStats,
        alerts: alertStats,
        batches: batchStats,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('获取报告统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取报告统计失败',
      error: error.message
    });
  }
};

module.exports = {
  exportProcessTemplates,
  exportProductionRecords,
  exportQualityReports,
  exportBatchReports,
  exportAlertReports,
  getReportStats
};
