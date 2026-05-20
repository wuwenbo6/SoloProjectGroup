const QualityInspection = require('../models/quality/QualityInspection');

const generateInspectionCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `QUAL-${timestamp}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
};

exports.createQualityInspection = async (req, res) => {
  try {
    const inspectionCode = generateInspectionCode();

    const inspection = await QualityInspection.create({
      ...req.body,
      inspectionCode,
      inspectorId: req.user._id,
      inspectorName: req.user.name,
      inspectionTime: new Date(),
    });

    res.status(201).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建品质检测记录失败',
      error: error.message,
    });
  }
};

exports.getAllQualityInspections = async (req, res) => {
  try {
    const { page = 1, limit = 10, batchId, overallResult, inspectionType } = req.query;
    
    const query = {};
    if (batchId) query.batchId = batchId;
    if (overallResult) query.overallResult = overallResult;
    if (inspectionType) query.inspectionType = inspectionType;

    const inspections = await QualityInspection.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await QualityInspection.countDocuments(query);

    res.status(200).json({
      success: true,
      data: inspections,
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
      message: '获取品质检测记录列表失败',
      error: error.message,
    });
  }
};

exports.getQualityInspectionById = async (req, res) => {
  try {
    const inspection = await QualityInspection.findById(req.params.id);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取品质检测记录详情失败',
      error: error.message,
    });
  }
};

exports.updateQualityInspection = async (req, res) => {
  try {
    const inspection = await QualityInspection.findById(req.params.id);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
      });
    }

    const updatedInspection = await QualityInspection.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: updatedInspection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新品质检测记录失败',
      error: error.message,
    });
  }
};

exports.submitQualityInspection = async (req, res) => {
  try {
    const inspection = await QualityInspection.findByIdAndUpdate(
      req.params.id,
      { status: '已提交' },
      { new: true }
    );

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '提交品质检测记录失败',
      error: error.message,
    });
  }
};

exports.addDefect = async (req, res) => {
  try {
    const { defectType, description, severity, location } = req.body;

    const inspection = await QualityInspection.findById(req.params.id);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
      });
    }

    inspection.defects.push({
      defectType,
      description,
      severity,
      location,
    });

    await inspection.save();

    res.status(200).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '添加缺陷记录失败',
      error: error.message,
    });
  }
};

exports.addCorrectiveAction = async (req, res) => {
  try {
    const { action, responsiblePerson, deadline } = req.body;

    const inspection = await QualityInspection.findById(req.params.id);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
      });
    }

    inspection.correctiveActions.push({
      action,
      responsiblePerson,
      deadline,
      status: '待执行',
    });

    await inspection.save();

    res.status(200).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '添加纠正措施失败',
      error: error.message,
    });
  }
};

exports.updateCorrectiveActionStatus = async (req, res) => {
  try {
    const { actionId, status } = req.body;

    const inspection = await QualityInspection.findById(req.params.id);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
      });
    }

    const action = inspection.correctiveActions.id(actionId);
    if (!action) {
      return res.status(404).json({
        success: false,
        message: '纠正措施不存在',
      });
    }

    action.status = status;
    await inspection.save();

    res.status(200).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新纠正措施状态失败',
      error: error.message,
    });
  }
};

exports.uploadQualityImage = async (req, res) => {
  try {
    const { url, description } = req.body;

    const inspection = await QualityInspection.findById(req.params.id);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
      });
    }

    inspection.images.push({
      url,
      description,
    });

    await inspection.save();

    res.status(200).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '上传图片失败',
      error: error.message,
    });
  }
};

exports.getQualityStatistics = async (req, res) => {
  try {
    const { startDate, endDate, batchId, inspectionType } = req.query;
    
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }
    if (batchId) matchQuery.batchId = batchId;
    if (inspectionType) matchQuery.inspectionType = inspectionType;

    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          passed: {
            $sum: {
              $cond: [{ $eq: ['$overallResult', '合格'] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ['$overallResult', '不合格'] }, 1, 0],
            },
          },
          conditional: {
            $sum: {
              $cond: [{ $eq: ['$overallResult', '有条件合格'] }, 1, 0],
            },
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$overallResult', '待判定'] }, 1, 0],
            },
          },
          avgDefectsPerInspection: {
            $avg: { $size: { $ifNull: ['$defects', []] } },
          },
          totalDefects: {
            $sum: { $size: { $ifNull: ['$defects', []] } },
          },
        },
      },
    ];

    const results = await QualityInspection.aggregate(pipeline);

    const stats = results[0] || {
      total: 0,
      passed: 0,
      failed: 0,
      conditional: 0,
      pending: 0,
      avgDefectsPerInspection: 0,
      totalDefects: 0,
    };

    const effectiveTotal = stats.passed + stats.failed + stats.conditional;
    const passRate = effectiveTotal > 0 
      ? (((stats.passed + stats.conditional) / effectiveTotal) * 100).toFixed(2)
      : 0;
    const strictPassRate = stats.total > 0 
      ? ((stats.passed / stats.total) * 100).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        conditional: stats.conditional,
        pending: stats.pending,
        totalDefects: stats.totalDefects,
        avgDefectsPerInspection: parseFloat(stats.avgDefectsPerInspection.toFixed(2)),
        passRate: `${passRate}%`,
        strictPassRate: `${strictPassRate}%`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取品质统计数据失败',
      error: error.message,
    });
  }
};

exports.calculateInspectionResult = async (req, res) => {
  try {
    const { items, defectThreshold = 1 } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供检测项数组',
      });
    }

    const passedItems = items.filter(item => item.result === '合格').length;
    const failedItems = items.filter(item => item.result === '不合格').length;
    const pendingItems = items.filter(item => item.result === '待检').length;

    const passRate = items.length > 0 
      ? ((passedItems / items.length) * 100).toFixed(2)
      : 0;

    let overallResult = '待判定';
    if (pendingItems === 0 && items.length > 0) {
      if (failedItems === 0) {
        overallResult = '合格';
      } else if (failedItems <= defectThreshold) {
        overallResult = '有条件合格';
      } else {
        overallResult = '不合格';
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalItems: items.length,
        passedItems,
        failedItems,
        pendingItems,
        itemPassRate: `${passRate}%`,
        overallResult,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '计算检测结果失败',
      error: error.message,
    });
  }
};