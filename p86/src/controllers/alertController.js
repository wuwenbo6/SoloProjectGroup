const ParameterAlert = require('../models/production/ParameterAlert');
const ProductionRecord = require('../models/production/ProductionRecord');

const PARAMETER_NAMES = {
  temperature: '温度',
  humidity: '湿度',
  toolPressure: '刀具压力',
  carvingDepth: '雕刻深度',
  carvingSpeed: '雕刻速度',
  woodMoisture: '木材含水率',
};

const DEFAULT_THRESHOLDS = {
  temperature: { min: 18, max: 28 },
  humidity: { min: 40, max: 70 },
  toolPressure: { min: 10, max: 100 },
  carvingDepth: { min: 0.1, max: 10 },
  carvingSpeed: { min: 100, max: 5000 },
  woodMoisture: { min: 8, max: 15 },
};

const generateAlertCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `ALERT-${timestamp}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
};

const checkParameterThreshold = (paramType, value, customThresholds = {}) => {
  const thresholds = { ...DEFAULT_THRESHOLDS[paramType], ...customThresholds };
  const isBelowMin = thresholds.min !== undefined && value < thresholds.min;
  const isAboveMax = thresholds.max !== undefined && value > thresholds.max;

  if (isBelowMin || isAboveMax) {
    let alertLevel = 'warning';
    let alertType = isBelowMin ? 'below_lower' : 'exceed_upper';

    const range = thresholds.max - thresholds.min;
    const deviation = isBelowMin
      ? (thresholds.min - value) / range
      : (value - thresholds.max) / range;

    if (deviation > 0.3) alertLevel = 'danger';
    if (deviation > 0.5) alertLevel = 'critical';

    return {
      isAbnormal: true,
      alertLevel,
      alertType,
      thresholdMin: thresholds.min,
      thresholdMax: thresholds.max,
    };
  }

  return { isAbnormal: false };
};

exports.checkAndCreateAlert = async (productionRecordId, parameters, operatorInfo, customThresholds = {}) => {
  const record = await ProductionRecord.findById(productionRecordId);
  if (!record) return [];

  const alerts = [];

  for (const [paramType, value] of Object.entries(parameters)) {
    if (value === undefined || value === null) continue;

    const result = checkParameterThreshold(paramType, value, customThresholds[paramType]);

    if (result.isAbnormal) {
      const alert = await ParameterAlert.create({
        alertCode: generateAlertCode(),
        productionRecordId: record._id,
        batchId: record.batchId,
        craftId: record.craftId,
        parameterType,
        parameterName: PARAMETER_NAMES[paramType] || paramType,
        currentValue: value,
        thresholdMin: result.thresholdMin,
        thresholdMax: result.thresholdMax,
        alertLevel: result.alertLevel,
        alertType: result.alertType,
        operatorId: operatorInfo?.operatorId,
        operatorName: operatorInfo?.operatorName,
      });
      alerts.push(alert);
    }
  }

  return alerts;
};

exports.createAlert = async (req, res) => {
  try {
    const { productionRecordId, parameterType, currentValue, thresholdMin, thresholdMax, alertLevel, alertType, notes } = req.body;

    const record = await ProductionRecord.findById(productionRecordId);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '制作记录不存在',
      });
    }

    const alert = await ParameterAlert.create({
      alertCode: generateAlertCode(),
      productionRecordId,
      batchId: record.batchId,
      craftId: record.craftId,
      parameterType,
      parameterName: PARAMETER_NAMES[parameterType] || parameterType,
      currentValue,
      thresholdMin,
      thresholdMax,
      alertLevel,
      alertType,
      operatorId: req.user._id,
      operatorName: req.user.name,
      notes,
    });

    res.status(201).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建预警失败',
      error: error.message,
    });
  }
};

exports.getAllAlerts = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, alertLevel, batchId, startDate, endDate } = req.query;

    const query = {};
    if (status) query.status = status;
    if (alertLevel) query.alertLevel = alertLevel;
    if (batchId) query.batchId = batchId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const alerts = await ParameterAlert.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await ParameterAlert.countDocuments(query);

    const stats = await ParameterAlert.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const alertStats = {
      pending: 0,
      acknowledged: 0,
      resolved: 0,
      ignored: 0,
    };
    stats.forEach(s => { alertStats[s._id] = s.count; });

    res.status(200).json({
      success: true,
      data: alerts,
      stats: alertStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取预警列表失败',
      error: error.message,
    });
  }
};

exports.getAlertById = async (req, res) => {
  try {
    const alert = await ParameterAlert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: '预警不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取预警详情失败',
      error: error.message,
    });
  }
};

exports.acknowledgeAlert = async (req, res) => {
  try {
    const { notes } = req.body;

    const alert = await ParameterAlert.findByIdAndUpdate(
      req.params.id,
      {
        status: 'acknowledged',
        acknowledgedBy: req.user._id,
        acknowledgedAt: new Date(),
        notes,
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: '预警不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '确认预警失败',
      error: error.message,
    });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const { resolutionNotes } = req.body;

    const alert = await ParameterAlert.findByIdAndUpdate(
      req.params.id,
      {
        status: 'resolved',
        resolvedBy: req.user._id,
        resolvedAt: new Date(),
        resolutionNotes,
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: '预警不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '解决预警失败',
      error: error.message,
    });
  }
};

exports.ignoreAlert = async (req, res) => {
  try {
    const { notes } = req.body;

    const alert = await ParameterAlert.findByIdAndUpdate(
      req.params.id,
      {
        status: 'ignored',
        acknowledgedBy: req.user._id,
        acknowledgedAt: new Date(),
        notes,
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: '预警不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '忽略预警失败',
      error: error.message,
    });
  }
};

exports.batchCheckParameters = async (req, res) => {
  try {
    const { recordIds, parameters, customThresholds } = req.body;

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的记录ID数组',
      });
    }

    const allAlerts = [];

    for (const recordId of recordIds) {
      const alerts = await exports.checkAndCreateAlert(
        recordId,
        parameters,
        { operatorId: req.user._id, operatorName: req.user.name },
        customThresholds
      );
      allAlerts.push(...alerts);
    }

    res.status(200).json({
      success: true,
      message: `参数检查完成，共生成 ${allAlerts.length} 条预警`,
      data: allAlerts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '批量参数检查失败',
      error: error.message,
    });
  }
};

exports.getAlertStatistics = async (req, res) => {
  try {
    const { startDate, endDate, batchId } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }
    if (batchId) matchQuery.batchId = batchId;

    const results = await ParameterAlert.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          byLevel: [
            { $group: { _id: '$alertLevel', count: { $sum: 1 } } },
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ],
          byParameter: [
            { $group: { _id: '$parameterName', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          total: [
            { $count: 'count' },
          ],
        },
      },
    ]);

    const stats = results[0];

    res.status(200).json({
      success: true,
      data: {
        total: stats.total[0]?.count || 0,
        byLevel: Object.fromEntries(stats.byLevel.map(s => [s._id, s.count])),
        byStatus: Object.fromEntries(stats.byStatus.map(s => [s._id, s.count])),
        byParameter: stats.byParameter,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取预警统计失败',
      error: error.message,
    });
  }
};

exports.getThresholdConfig = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: DEFAULT_THRESHOLDS,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取阈值配置失败',
      error: error.message,
    });
  }
};
