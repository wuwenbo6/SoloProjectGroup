const ProductionRecord = require('../models/production/ProductionRecord');
const Batch = require('../models/production/Batch');
const ParameterAlert = require('../models/production/ParameterAlert');
const logger = require('../config/logger');

const getProductionProgress = async (req, res) => {
  try {
    const { recordId } = req.params;

    const record = await ProductionRecord.findById(recordId);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '生产记录不存在'
      });
    }

    const totalSteps = record.steps.length;
    const completedSteps = record.steps.filter(step => step.status === 'completed').length;
    const inProgressSteps = record.steps.filter(step => step.status === 'in_progress').length;
    const pendingSteps = record.steps.filter(step => step.status === 'pending').length;

    const overallProgress = totalSteps > 0
      ? Math.round((completedSteps / totalSteps) * 100)
      : 0;

    const stepDetails = record.steps.map((step, index) => {
      const stepParameters = step.parameters || [];
      const completedParams = stepParameters.filter(p => p.recordedAt).length;

      let stepProgress = 0;
      if (step.status === 'completed') {
        stepProgress = 100;
      } else if (step.status === 'in_progress') {
        stepProgress = stepParameters.length > 0
          ? Math.round((completedParams / stepParameters.length) * 50 + 50)
          : 50;
      } else if (step.status === 'pending') {
        stepProgress = 0;
      }

      let duration = null;
      if (step.startTime && step.endTime) {
        duration = step.endTime.getTime() - step.startTime.getTime();
      } else if (step.startTime) {
        duration = Date.now() - step.startTime.getTime();
      }

      return {
        stepIndex: index,
        stepName: step.stepName,
        status: step.status,
        progress: stepProgress,
        startTime: step.startTime,
        endTime: step.endTime,
        duration,
        parameters: {
          total: stepParameters.length,
          recorded: completedParams
        },
        operator: step.operator
      };
    });

    let totalDuration = null;
    if (record.startedAt && record.completedAt) {
      totalDuration = record.completedAt.getTime() - record.startedAt.getTime();
    } else if (record.startedAt) {
      totalDuration = Date.now() - record.startedAt.getTime();
    }

    const alerts = await ParameterAlert.find({
      productionRecordId: recordId,
      status: { $in: ['pending', 'acknowledged'] }
    });

    const estimatedCompletionTime = estimateCompletionTime(record, stepDetails);

    res.json({
      success: true,
      data: {
        recordId: record._id,
        propSerialNumber: record.propSerialNumber,
        propName: record.propName,
        status: record.status,
        overallProgress,
        totalSteps,
        completedSteps,
        inProgressSteps,
        pendingSteps,
        currentStepIndex: record.currentStep,
        steps: stepDetails,
        timeline: {
          startedAt: record.startedAt,
          completedAt: record.completedAt,
          totalDuration,
          estimatedCompletionTime
        },
        alerts: {
          count: alerts.length,
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length
        },
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      }
    });
  } catch (error) {
    logger.error('获取生产进度失败:', error);
    res.status(500).json({
      success: false,
      message: '获取生产进度失败',
      error: error.message
    });
  }
};

const estimateCompletionTime = (record, stepDetails) => {
  if (record.status === 'completed' || !record.startedAt) {
    return null;
  }

  const completedStepDetails = stepDetails.filter(s => s.status === 'completed');
  if (completedStepDetails.length === 0) {
    return null;
  }

  const avgStepDuration = completedStepDetails.reduce((sum, s) => sum + (s.duration || 0), 0) / completedStepDetails.length;
  const remainingSteps = stepDetails.filter(s => s.status !== 'completed').length;
  const estimatedRemainingTime = avgStepDuration * remainingSteps;

  return new Date(Date.now() + estimatedRemainingTime);
};

const getBatchProgress = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    const records = await ProductionRecord.find({ batchId });

    const totalRecords = records.length;
    const completedRecords = records.filter(r => r.status === 'completed').length;
    const inProgressRecords = records.filter(r => r.status === 'in_progress').length;
    const pendingRecords = records.filter(r => r.status === 'not_started').length;
    const onHoldRecords = records.filter(r => r.status === 'on_hold').length;

    const overallProgress = totalRecords > 0
      ? Math.round((completedRecords / totalRecords) * 100)
      : 0;

    const recordProgresses = records.map(record => {
      const totalSteps = record.steps.length;
      const completedSteps = record.steps.filter(s => s.status === 'completed').length;
      const progress = totalSteps > 0
        ? Math.round((completedSteps / totalSteps) * 100)
        : 0;

      return {
        recordId: record._id,
        propSerialNumber: record.propSerialNumber,
        propName: record.propName,
        status: record.status,
        progress,
        currentStep: record.currentStep,
        startedAt: record.startedAt,
        completedAt: record.completedAt
      };
    });

    const alerts = await ParameterAlert.find({
      batchId,
      status: { $in: ['pending', 'acknowledged'] }
    });

    const expectedDuration = estimateBatchDuration(records);

    res.json({
      success: true,
      data: {
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        batchName: batch.propName,
        status: batch.status,
        priority: batch.priority,
        overallProgress,
        quantities: {
          total: batch.quantity,
          completed: completedRecords,
          inProgress: inProgressRecords,
          pending: pendingRecords,
          onHold: onHoldRecords
        },
        records: recordProgresses,
        timeline: {
          plannedStartDate: batch.plannedStartDate,
          plannedEndDate: batch.plannedEndDate,
          actualStartDate: batch.actualStartDate,
          actualEndDate: batch.actualEndDate,
          estimatedCompletionTime: expectedDuration.estimatedCompletionTime,
          expectedDelay: expectedDuration.expectedDelay
        },
        alerts: {
          count: alerts.length,
          bySeverity: {
            critical: alerts.filter(a => a.severity === 'critical').length,
            high: alerts.filter(a => a.severity === 'high').length,
            medium: alerts.filter(a => a.severity === 'medium').length,
            low: alerts.filter(a => a.severity === 'low').length
          }
        },
        createdAt: batch.createdAt
      }
    });
  } catch (error) {
    logger.error('获取批次进度失败:', error);
    res.status(500).json({
      success: false,
      message: '获取批次进度失败',
      error: error.message
    });
  }
};

const estimateBatchDuration = (records) => {
  const completedRecords = records.filter(r => r.status === 'completed' && r.startedAt && r.completedAt);

  if (completedRecords.length === 0) {
    return {
      estimatedCompletionTime: null,
      expectedDelay: null
    };
  }

  const avgDuration = completedRecords.reduce((sum, r) => {
    return sum + (r.completedAt.getTime() - r.startedAt.getTime());
  }, 0) / completedRecords.length;

  const pendingRecords = records.filter(r => r.status !== 'completed').length;
  const estimatedRemainingTime = avgDuration * pendingRecords;

  const estimatedCompletionTime = new Date(Date.now() + estimatedRemainingTime);

  return {
    estimatedCompletionTime,
    expectedDelay: null
  };
};

const getProgressDashboard = async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;

    const now = new Date();
    let dateFilter = {};

    switch (timeRange) {
      case '24h':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } };
        break;
      case '7d':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '30d':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
        break;
    }

    const [
      totalRecords,
      byStatus,
      activeBatches,
      alertsSummary,
      recentProgress
    ] = await Promise.all([
      ProductionRecord.countDocuments({}),
      ProductionRecord.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Batch.countDocuments({ status: { $in: ['in_progress', 'planned'] } }),
      ParameterAlert.aggregate([
        { $match: { status: { $in: ['pending', 'acknowledged'] } } },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 }
          }
        }
      ]),
      ProductionRecord.aggregate([
        { $match: { ...dateFilter, status: { $ne: 'not_started' } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            started: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 14 }
      ])
    ]);

    const completedCount = byStatus.find(s => s._id === 'completed')?.count || 0;
    const overallProgress = totalRecords > 0
      ? Math.round((completedCount / totalRecords) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalRecords,
          activeBatches,
          overallProgress,
          activeAlerts: alertsSummary.reduce((sum, a) => sum + a.count, 0)
        },
        byStatus,
        alertsSummary,
        recentProgress,
        timeRange
      }
    });
  } catch (error) {
    logger.error('获取进度仪表板失败:', error);
    res.status(500).json({
      success: false,
      message: '获取进度仪表板失败',
      error: error.message
    });
  }
};

const getPropProgressBySerial = async (req, res) => {
  try {
    const { serialNumber } = req.params;

    const record = await ProductionRecord.findOne({ propSerialNumber: serialNumber });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '道具序列号不存在'
      });
    }

    req.params.recordId = record._id;
    return getProductionProgress(req, res);
  } catch (error) {
    logger.error('获取道具进度失败:', error);
    res.status(500).json({
      success: false,
      message: '获取道具进度失败',
      error: error.message
    });
  }
};

module.exports = {
  getProductionProgress,
  getBatchProgress,
  getProgressDashboard,
  getPropProgressBySerial
};
