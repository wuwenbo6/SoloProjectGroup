const Batch = require('../models/production/Batch');
const ProductionRecord = require('../models/production/ProductionRecord');
const WoodcarvingCraft = require('../models/craft/WoodcarvingCraft');
const QualityInspection = require('../models/quality/QualityInspection');

exports.getBatchProgress = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    const craft = await WoodcarvingCraft.findById(batch.craftId);
    const totalSteps = craft?.steps?.length || 0;

    const records = await ProductionRecord.find({ batchId }).sort({ stepNumber: 1 });

    const completedRecords = records.filter(r => r.status === '已完成');
    const inProgressRecords = records.filter(r => r.status === '进行中');

    const stepProgress = craft?.steps?.map(step => {
      const record = records.find(r => r.stepNumber === step.stepNumber);
      return {
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        description: step.description,
        estimatedDuration: step.estimatedTime,
        status: record ? record.status : '未开始',
        recordId: record?._id,
        actualDuration: record?.duration,
        operatorName: record?.operatorName,
        startTime: record?.startTime,
        endTime: record?.endTime,
        qualityPassed: record?.qualityCheck?.passed,
      };
    }) || [];

    const progressPercentage = totalSteps > 0
      ? Math.round((completedRecords.length / totalSteps) * 100)
      : batch.progress || 0;

    const totalDuration = completedRecords.reduce((sum, r) => sum + (r.duration || 0), 0);
    const estimatedTotalDuration = craft?.estimatedDuration || 0;

    let overallQuality = '待检测';
    if (completedRecords.length > 0) {
      const passedCount = completedRecords.filter(r => r.qualityCheck?.passed === true).length;
      const failedCount = completedRecords.filter(r => r.qualityCheck?.passed === false).length;
      if (failedCount > 0) {
        overallQuality = '有不合格项';
      } else if (passedCount === completedRecords.length) {
        overallQuality = '全部合格';
      } else {
        overallQuality = '部分检测';
      }
    }

    res.status(200).json({
      success: true,
      data: {
        batchInfo: {
          id: batch._id,
          batchCode: batch.batchCode,
          craftName: batch.craftName,
          status: batch.status,
          quantity: batch.quantity,
          workshop: batch.workshop,
          startDate: batch.startDate,
          estimatedEndDate: batch.estimatedEndDate,
          actualEndDate: batch.actualEndDate,
        },
        progress: {
          current: progressPercentage,
          completedSteps: completedRecords.length,
          totalSteps,
          inProgressSteps: inProgressRecords.length,
          pendingSteps: totalSteps - completedRecords.length - inProgressRecords.length,
        },
        timing: {
          totalActualDurationMinutes: totalDuration,
          totalEstimatedDurationMinutes: estimatedTotalDuration,
          estimatedRemainingMinutes: Math.max(0, estimatedTotalDuration - totalDuration),
          progressVsEstimate: estimatedTotalDuration > 0
            ? Math.round((totalDuration / estimatedTotalDuration) * 100)
            : 0,
        },
        quality: {
          overallStatus: overallQuality,
          completedWithQuality: completedRecords.filter(r => r.qualityCheck?.passed !== undefined).length,
          passedCount: completedRecords.filter(r => r.qualityCheck?.passed === true).length,
          failedCount: completedRecords.filter(r => r.qualityCheck?.passed === false).length,
        },
        stepProgress,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取批次进度失败',
      error: error.message,
    });
  }
};

exports.getCraftProgressSummary = async (req, res) => {
  try {
    const { craftId } = req.params;

    const craft = await WoodcarvingCraft.findById(craftId);
    if (!craft) {
      return res.status(404).json({
        success: false,
        message: '工艺不存在',
      });
    }

    const batches = await Batch.find({ craftId });
    const batchIds = batches.map(b => b._id);

    const records = await ProductionRecord.find({ batchId: { $in: batchIds } });
    const inspections = await QualityInspection.find({ batchId: { $in: batchIds } });

    const batchStats = batches.map(batch => {
      const batchRecords = records.filter(r => r.batchId.toString() === batch._id.toString());
      const completed = batchRecords.filter(r => r.status === '已完成').length;
      const total = craft.steps?.length || 0;

      return {
        batchId: batch._id,
        batchCode: batch.batchCode,
        status: batch.status,
        progress: total > 0 ? Math.round((completed / total) * 100) : batch.progress || 0,
        completedSteps: completed,
        totalSteps: total,
        startDate: batch.startDate,
        workshop: batch.workshop,
      };
    });

    const completedBatches = batches.filter(b => b.status === '已完成').length;
    const inProgressBatches = batches.filter(b => b.status === '进行中').length;
    const avgProgress = batches.length > 0
      ? Math.round(batchStats.reduce((sum, b) => sum + b.progress, 0) / batches.length)
      : 0;

    const qualityStats = {
      totalInspections: inspections.length,
      passed: inspections.filter(i => i.overallResult === '合格').length,
      failed: inspections.filter(i => i.overallResult === '不合格').length,
      conditional: inspections.filter(i => i.overallResult === '有条件合格').length,
    };

    res.status(200).json({
      success: true,
      data: {
        craftInfo: {
          id: craft._id,
          craftCode: craft.craftCode,
          craftName: craft.craftName,
          category: craft.category,
          difficultyLevel: craft.difficultyLevel,
          totalSteps: craft.steps?.length || 0,
        },
        batchSummary: {
          totalBatches: batches.length,
          completedBatches,
          inProgressBatches,
          pendingBatches: batches.filter(b => b.status === '待开始').length,
          avgProgressPercentage: avgProgress,
        },
        qualitySummary: {
          ...qualityStats,
          passRate: qualityStats.totalInspections > 0
            ? Math.round(((qualityStats.passed + qualityStats.conditional) / qualityStats.totalInspections) * 100)
            : 0,
        },
        batchDetails: batchStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取工艺进度汇总失败',
      error: error.message,
    });
  }
};

exports.getWorkshopProgress = async (req, res) => {
  try {
    const { workshop } = req.query;

    const query = {};
    if (workshop) query.workshop = workshop;

    const batches = await Batch.find(query);
    const batchIds = batches.map(b => b._id);

    const records = await ProductionRecord.find({ batchId: { $in: batchIds } });

    const workshopGroups = {};
    batches.forEach(batch => {
      if (!workshopGroups[batch.workshop]) {
        workshopGroups[batch.workshop] = [];
      }
      workshopGroups[batch.workshop].push(batch);
    });

    const workshopStats = Object.entries(workshopGroups).map(([workshopName, workshopBatches]) => {
      const workshopBatchIds = workshopBatches.map(b => b._id);
      const workshopRecords = records.filter(r => workshopBatchIds.some(id => id.toString() === r.batchId.toString()));

      const completedBatches = workshopBatches.filter(b => b.status === '已完成').length;
      const inProgressBatches = workshopBatches.filter(b => b.status === '进行中').length;
      const avgProgress = workshopBatches.length > 0
        ? Math.round(workshopBatches.reduce((sum, b) => sum + (b.progress || 0), 0) / workshopBatches.length)
        : 0;

      const completedRecords = workshopRecords.filter(r => r.status === '已完成').length;

      return {
        workshop: workshopName,
        totalBatches: workshopBatches.length,
        completedBatches,
        inProgressBatches,
        pendingBatches: workshopBatches.filter(b => b.status === '待开始').length,
        avgProgressPercentage: avgProgress,
        totalRecords: workshopRecords.length,
        completedRecords,
      };
    });

    const overallStats = {
      totalBatches: batches.length,
      completedBatches: batches.filter(b => b.status === '已完成').length,
      inProgressBatches: batches.filter(b => b.status === '进行中').length,
      totalRecords: records.length,
      completedRecords: records.filter(r => r.status === '已完成').length,
    };

    res.status(200).json({
      success: true,
      data: {
        overall: {
          ...overallStats,
          completionRate: overallStats.totalBatches > 0
            ? Math.round((overallStats.completedBatches / overallStats.totalBatches) * 100)
            : 0,
        },
        workshops: workshopStats,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取车间进度失败',
      error: error.message,
    });
  }
};

exports.getStepTimeline = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    const craft = await WoodcarvingCraft.findById(batch.craftId);
    const records = await ProductionRecord.find({ batchId }).sort({ stepNumber: 1 });

    const timeline = (craft?.steps || []).map(step => {
      const record = records.find(r => r.stepNumber === step.stepNumber);

      return {
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        description: step.description,
        estimatedStartTime: null,
        estimatedEndTime: null,
        estimatedDuration: step.estimatedTime,
        actualStartTime: record?.startTime,
        actualEndTime: record?.endTime,
        actualDuration: record?.duration,
        status: record ? record.status : '未开始',
        operatorName: record?.operatorName,
        delay: record && record.duration && record.duration > step.estimatedTime
          ? record.duration - step.estimatedTime
          : 0,
        isDelayed: record && record.duration && record.duration > step.estimatedTime,
      };
    });

    const criticalPath = timeline.filter(t => t.isDelayed ||
      (t.status === '已完成' && t.actualDuration > t.estimatedDuration * 1.2));

    res.status(200).json({
      success: true,
      data: {
        batchCode: batch.batchCode,
        craftName: batch.craftName,
        timeline,
        criticalPath,
        totalDelayMinutes: criticalPath.reduce((sum, t) => sum + t.delay, 0),
        onScheduleSteps: timeline.filter(t => !t.isDelayed && t.status !== '未开始').length,
        delayedSteps: criticalPath.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取工序时间线失败',
      error: error.message,
    });
  }
};

exports.getRealTimeProgress = async (req, res) => {
  try {
    const inProgressBatches = await Batch.find({ status: '进行中' });
    const batchIds = inProgressBatches.map(b => b._id);

    const inProgressRecords = await ProductionRecord.find({
      batchId: { $in: batchIds },
      status: '进行中',
    });

    const realTimeData = inProgressBatches.map(batch => {
      const batchRecords = inProgressRecords.filter(r => r.batchId.toString() === batch._id.toString());

      return {
        batchId: batch._id,
        batchCode: batch.batchCode,
        craftName: batch.craftName,
        workshop: batch.workshop,
        progress: batch.progress || 0,
        activeSteps: batchRecords.map(record => ({
          recordId: record._id,
          stepNumber: record.stepNumber,
          stepName: record.stepName,
          operatorName: record.operatorName,
          startTime: record.startTime,
          elapsedMinutes: record.startTime
            ? Math.round((Date.now() - new Date(record.startTime).getTime()) / 60000)
            : 0,
          parameters: record.parameters,
        })),
        activeOperators: [...new Set(batchRecords.map(r => r.operatorName))],
        lastUpdate: batch.updatedAt,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        activeBatchesCount: inProgressBatches.length,
        activeStepsCount: inProgressRecords.length,
        activeOperatorsCount: [...new Set(inProgressRecords.map(r => r.operatorName))].length,
        realTimeProgress: realTimeData,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取实时进度失败',
      error: error.message,
    });
  }
};

exports.updateProgressMilestone = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { milestoneName, milestoneDescription, completed, notes } = req.body;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    if (!batch.progressMilestones) {
      batch.progressMilestones = [];
    }

    const milestone = {
      milestoneName,
      milestoneDescription,
      completed: completed || false,
      completedAt: completed ? new Date() : null,
      completedBy: completed ? req.user._id : null,
      notes,
    };

    batch.progressMilestones.push(milestone);
    await batch.save();

    res.status(200).json({
      success: true,
      data: milestone,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新进度里程碑失败',
      error: error.message,
    });
  }
};

exports.getProgressDashboard = async (req, res) => {
  try {
    const [batches, records, inspections] = await Promise.all([
      Batch.find(),
      ProductionRecord.find(),
      QualityInspection.find(),
    ]);

    const totalBatches = batches.length;
    const completedBatches = batches.filter(b => b.status === '已完成').length;
    const inProgressBatches = batches.filter(b => b.status === '进行中').length;
    const pendingBatches = batches.filter(b => b.status === '待开始').length;

    const totalRecords = records.length;
    const completedRecords = records.filter(r => r.status === '已完成').length;
    const avgProgress = totalBatches > 0
      ? Math.round(batches.reduce((sum, b) => sum + (b.progress || 0), 0) / totalBatches)
      : 0;

    const totalInspections = inspections.length;
    const passedInspections = inspections.filter(i => i.overallResult === '合格').length;
    const passRate = totalInspections > 0
      ? Math.round((passedInspections / totalInspections) * 100)
      : 0;

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const recentRecords = records.filter(r => new Date(r.createdAt) >= last7Days);
    const recentBatches = batches.filter(b => new Date(b.createdAt) >= last7Days);

    const workshops = [...new Set(batches.map(b => b.workshop))];
    const workshopStats = workshops.filter(Boolean).map(workshop => {
      const workshopBatches = batches.filter(b => b.workshop === workshop);
      return {
        workshop,
        totalBatches: workshopBatches.length,
        completedBatches: workshopBatches.filter(b => b.status === '已完成').length,
        avgProgress: workshopBatches.length > 0
          ? Math.round(workshopBatches.reduce((sum, b) => sum + (b.progress || 0), 0) / workshopBatches.length)
          : 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalBatches,
          completedBatches,
          inProgressBatches,
          pendingBatches,
          avgProgressPercentage: avgProgress,
          completionRate: totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 0,
        },
        production: {
          totalRecords,
          completedRecords,
          completionRate: totalRecords > 0 ? Math.round((completedRecords / totalRecords) * 100) : 0,
          last7DaysNewRecords: recentRecords.length,
          last7DaysNewBatches: recentBatches.length,
        },
        quality: {
          totalInspections,
          passedInspections,
          passRatePercentage: passRate,
        },
        workshopStats,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取进度仪表盘失败',
      error: error.message,
    });
  }
};
