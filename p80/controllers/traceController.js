const RareBook = require('../models/rareBook/RareBook');
const RestorationProgress = require('../models/restoration/RestorationProgress');
const RestorationTechnique = require('../models/technique/RestorationTechnique');
const ThirdPartyDetection = require('../models/technique/ThirdPartyDetection');
const RestorationArchive = require('../models/restoration/RestorationArchive');
const TraceUtil = require('../utils/traceUtil');
const logger = require('../utils/logger');

exports.getFullTraceChain = async (req, res) => {
  try {
    const { bookId } = req.params;
    
    const rareBook = await RareBook.findByPk(bookId);
    if (!rareBook) {
      return res.status(404).json({ error: '善本信息不存在' });
    }

    const progressList = await RestorationProgress.findAll({
      where: { bookId },
      order: [['stepOrder', 'ASC'], ['createdAt', 'ASC']]
    });

    const techniques = await RestorationTechnique.findAll({
      where: { bookId },
      order: [['createdAt', 'ASC']]
    });

    const detections = await ThirdPartyDetection.findAll({
      where: { bookId },
      order: [['createdAt', 'ASC']]
    });

    const archives = await RestorationArchive.findAll({
      where: { bookId },
      order: [['createdAt', 'ASC']]
    });

    const allEvents = [];

    allEvents.push({
      eventType: 'book_registered',
      eventName: '善本登记',
      timestamp: rareBook.createdAt,
      data: {
        bookCode: rareBook.bookCode,
        title: rareBook.title,
        author: rareBook.author,
        dynasty: rareBook.dynasty,
        condition: rareBook.condition,
        status: rareBook.status
      },
      traceId: rareBook.traceId
    });

    progressList.forEach(progress => {
      allEvents.push({
        eventType: 'restoration_progress',
        eventName: `修复进度 - ${progress.stepName}`,
        timestamp: progress.createdAt,
        data: {
          progressId: progress.id,
          stepOrder: progress.stepOrder,
          stepName: progress.stepName,
          status: progress.status,
          restorerName: progress.restorerName,
          progressPercent: progress.progressPercent,
          startedAt: progress.startedAt,
          completedAt: progress.completedAt,
          qualityCheck: progress.qualityCheck
        },
        traceId: progress.traceId
      });
    });

    techniques.forEach(technique => {
      allEvents.push({
        eventType: 'restoration_technique',
        eventName: `修复工艺 - ${technique.techniqueName}`,
        timestamp: technique.operatedAt || technique.createdAt,
        data: {
          techniqueId: technique.id,
          techniqueName: technique.techniqueName,
          techniqueType: technique.techniqueType,
          operatorName: technique.operatorName,
          duration: technique.duration,
          verificationStatus: technique.verificationStatus
        },
        traceId: technique.traceId
      });
    });

    detections.forEach(detection => {
      allEvents.push({
        eventType: 'third_party_detection',
        eventName: `第三方检测 - ${detection.detectionType}`,
        timestamp: detection.detectionDate || detection.createdAt,
        data: {
          detectionId: detection.detectionId,
          organization: detection.organization,
          detectionType: detection.detectionType,
          conclusion: detection.conclusion,
          syncStatus: detection.syncStatus,
          verified: detection.verified
        },
        traceId: detection.traceId
      });
    });

    archives.forEach(archive => {
      allEvents.push({
        eventType: 'archive',
        eventName: `档案归档 - ${archive.title}`,
        timestamp: archive.archivedAt || archive.createdAt,
        data: {
          archiveId: archive.archiveNumber,
          archiveType: archive.archiveType,
          status: archive.status,
          chiefRestorer: archive.chiefRestorer,
          totalDuration: archive.totalDuration
        },
        traceId: archive.traceId
      });
    });

    allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const statusFlow = analyzeStatusFlow(allEvents);
    const timelineOverview = generateTimelineOverview(allEvents);
    const participants = extractParticipants(allEvents);

    const traceChain = {
      bookId: rareBook.id,
      bookCode: rareBook.bookCode,
      bookTitle: rareBook.title,
      traceId: rareBook.traceId,
      generatedAt: new Date().toISOString(),
      totalEvents: allEvents.length,
      timelineOverview,
      statusFlow,
      participants,
      events: allEvents,
      rawData: {
        rareBook: rareBook.toJSON(),
        progress: progressList.map(p => p.toJSON()),
        techniques: techniques.map(t => t.toJSON()),
        detections: detections.map(d => d.toJSON()),
        archives: archives.map(a => a.toJSON())
      }
    };

    res.json({
      message: '追溯链获取成功',
      data: traceChain
    });
  } catch (error) {
    logger.error('获取追溯链失败:', error);
    res.status(500).json({ error: '获取追溯链失败', message: error.message });
  }
};

function analyzeStatusFlow(events) {
  const statusEvents = events.filter(e => 
    ['book_registered', 'restoration_progress', 'archive'].includes(e.eventType)
  );
  
  const flow = [];
  statusEvents.forEach(event => {
    if (event.eventType === 'book_registered') {
      flow.push({
        phase: '登记入库',
        status: event.data.status,
        timestamp: event.timestamp,
        description: `善本${event.data.status === 'available' ? '已登记，等待修复' : '状态：' + event.data.status}`
      });
    } else if (event.eventType === 'restoration_progress') {
      const statusMap = {
        pending: '待开始',
        in_progress: '进行中',
        completed: '已完成',
        paused: '已暂停'
      };
      flow.push({
        phase: `修复阶段 ${event.data.stepOrder}`,
        stepName: event.data.stepName,
        status: statusMap[event.data.status] || event.data.status,
        timestamp: event.timestamp,
        restorer: event.data.restorerName,
        progress: event.data.progressPercent
      });
    } else if (event.eventType === 'archive') {
      flow.push({
        phase: '档案归档',
        status: event.data.status,
        timestamp: event.timestamp,
        description: `档案${event.data.status === 'archived' ? '已归档' : '状态：' + event.data.status}`
      });
    }
  });

  return flow;
}

function generateTimelineOverview(events) {
  if (events.length === 0) return null;

  const startTime = new Date(events[0].timestamp);
  const endTime = new Date(events[events.length - 1].timestamp);
  const durationDays = Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24));

  const eventTypeCount = {};
  events.forEach(event => {
    eventTypeCount[event.eventType] = (eventTypeCount[event.eventType] || 0) + 1;
  });

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationDays,
    totalEvents: events.length,
    eventTypeBreakdown: eventTypeCount,
    currentPhase: events.length > 0 ? events[events.length - 1].eventName : '未知'
  };
}

function extractParticipants(events) {
  const participants = new Set();
  
  events.forEach(event => {
    if (event.data.restorerName) participants.add(event.data.restorerName);
    if (event.data.operatorName) participants.add(event.data.operatorName);
    if (event.data.chiefRestorer) participants.add(event.data.chiefRestorer);
  });

  return Array.from(participants).filter(Boolean);
}

exports.getTraceByTraceId = async (req, res) => {
  try {
    const { traceId } = req.params;
    
    const results = [];

    const rareBook = await RareBook.findOne({ where: { traceId } });
    if (rareBook) {
      results.push({ type: 'rare_book', data: rareBook.toJSON() });
    }

    const progress = await RestorationProgress.findOne({ where: { traceId } });
    if (progress) {
      results.push({ type: 'restoration_progress', data: progress.toJSON() });
    }

    const technique = await RestorationTechnique.findOne({ where: { traceId } });
    if (technique) {
      results.push({ type: 'technique', data: technique.toJSON() });
    }

    const detection = await ThirdPartyDetection.findOne({ where: { traceId } });
    if (detection) {
      results.push({ type: 'detection', data: detection.toJSON() });
    }

    const archive = await RestorationArchive.findOne({ where: { traceId } });
    if (archive) {
      results.push({ type: 'archive', data: archive.toJSON() });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: '追溯ID不存在' });
    }

    res.json({
      message: '追溯信息获取成功',
      data: {
        traceId,
        relatedRecords: results
      }
    });
  } catch (error) {
    logger.error('获取追溯信息失败:', error);
    res.status(500).json({ error: '获取追溯信息失败', message: error.message });
  }
};

exports.searchTrace = async (req, res) => {
  try {
    const { bookCode, keyword, startDate, endDate, eventType } = req.query;
    
    let where = {};
    if (bookCode) where.bookCode = { [require('sequelize').Op.like]: `%${bookCode}%` };

    const rareBooks = await RareBook.findAll({ where, limit: 50 });
    
    const results = [];
    for (const book of rareBooks) {
      const traceData = {
        bookId: book.id,
        bookCode: book.bookCode,
        title: book.title,
        traceId: book.traceId,
        bookStatus: book.status
      };
      
      if (keyword) {
        if (!book.title.includes(keyword) && !book.bookCode.includes(keyword)) {
          continue;
        }
      }
      
      results.push(traceData);
    }

    res.json({
      message: '搜索成功',
      data: results,
      pagination: { total: results.length }
    });
  } catch (error) {
    logger.error('搜索追溯失败:', error);
    res.status(500).json({ error: '搜索追溯失败', message: error.message });
  }
};

exports.getOperationLogs = async (req, res) => {
  try {
    const { limit = 100, operation, userId } = req.query;
    
    res.json({
      message: '操作日志获取成功',
      data: {
        note: '实际生产环境应从日志数据库或日志服务获取',
        lastFetchTime: new Date().toISOString(),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('获取操作日志失败:', error);
    res.status(500).json({ error: '获取操作日志失败', message: error.message });
  }
};

exports.exportTraceReport = async (req, res) => {
  try {
    const { bookId } = req.params;
    
    const rareBook = await RareBook.findByPk(bookId);
    if (!rareBook) {
      return res.status(404).json({ error: '善本信息不存在' });
    }

    const progressList = await RestorationProgress.findAll({ where: { bookId } });
    const techniques = await RestorationTechnique.findAll({ where: { bookId } });
    const detections = await ThirdPartyDetection.findAll({ where: { bookId } });
    const archives = await RestorationArchive.findAll({ where: { bookId } });

    const report = {
      reportTitle: `古籍修复追溯报告 - ${rareBook.bookCode}`,
      generatedAt: new Date().toISOString(),
      bookInfo: {
        bookCode: rareBook.bookCode,
        title: rareBook.title,
        author: rareBook.author,
        dynasty: rareBook.dynasty,
        material: rareBook.material,
        condition: rareBook.condition,
        location: rareBook.location
      },
      statistics: {
        totalProgressSteps: progressList.length,
        completedSteps: progressList.filter(p => p.status === 'completed').length,
        techniquesUsed: techniques.length,
        detectionsCount: detections.length,
        archivesCount: archives.length
      },
      restorationProgress: progressList.map(p => ({
        step: p.stepOrder,
        name: p.stepName,
        status: p.status,
        restorer: p.restorerName,
        progress: p.progressPercent,
        quality: p.qualityCheck
      })),
      techniques: techniques.map(t => ({
        name: t.techniqueName,
        type: t.techniqueType,
        operator: t.operatorName,
        duration: t.duration,
        verified: t.verificationStatus
      })),
      detections: detections.map(d => ({
        id: d.detectionId,
        organization: d.organization,
        type: d.detectionType,
        conclusion: d.conclusion,
        syncStatus: d.syncStatus
      })),
      archives: archives.map(a => ({
        number: a.archiveNumber,
        type: a.archiveType,
        title: a.title,
        status: a.status,
        archivedAt: a.archivedAt
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="trace-report-${rareBook.bookCode}.json"`);
    res.json(report);
  } catch (error) {
    logger.error('导出追溯报告失败:', error);
    res.status(500).json({ error: '导出追溯报告失败', message: error.message });
  }
};
