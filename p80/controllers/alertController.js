const RestorationAlert = require('../models/restoration/RestorationAlert');
const RestorationProgress = require('../models/restoration/RestorationProgress');
const RareBook = require('../models/rareBook/RareBook');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

exports.createAlert = async (req, res) => {
  try {
    const alert = await RestorationAlert.create({
      ...req.body,
      assignee: req.user?.id
    });

    res.status(201).json({
      message: '预警创建成功',
      data: alert
    });
  } catch (error) {
    logger.error('创建预警失败:', error);
    res.status(500).json({ error: '创建预警失败', message: error.message });
  }
};

exports.getAlertById = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await RestorationAlert.findByPk(id);
    
    if (!alert) {
      return res.status(404).json({ error: '预警不存在' });
    }

    res.json({ data: alert });
  } catch (error) {
    logger.error('获取预警失败:', error);
    res.status(500).json({ error: '获取预警失败', message: error.message });
  }
};

exports.getAlertsByBookId = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { status, severity, alertType } = req.query;
    
    const where = { bookId };
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (alertType) where.alertType = alertType;

    const alerts = await RestorationAlert.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json({ data: alerts });
  } catch (error) {
    logger.error('获取善本预警列表失败:', error);
    res.status(500).json({ error: '获取善本预警列表失败', message: error.message });
  }
};

exports.getAllAlerts = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, severity, alertType, assignee } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (alertType) where.alertType = alertType;
    if (assignee) where.assignee = assignee;

    const { count, rows } = await RestorationAlert.findAndCountAll({
      where,
      offset: (page - 1) * limit,
      limit: parseInt(limit),
      order: [['severity', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('获取预警列表失败:', error);
    res.status(500).json({ error: '获取预警列表失败', message: error.message });
  }
};

exports.getMyAlerts = async (req, res) => {
  try {
    const { status } = req.query;
    const where = { assignee: req.user.id };
    if (status) where.status = status;

    const alerts = await RestorationAlert.findAll({
      where,
      order: [['severity', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json({ data: alerts });
  } catch (error) {
    logger.error('获取我的预警失败:', error);
    res.status(500).json({ error: '获取我的预警失败', message: error.message });
  }
};

exports.updateAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await RestorationAlert.findByPk(id);
    
    if (!alert) {
      return res.status(404).json({ error: '预警不存在' });
    }

    await alert.update(req.body);

    res.json({
      message: '预警更新成功',
      data: alert
    });
  } catch (error) {
    logger.error('更新预警失败:', error);
    res.status(500).json({ error: '更新预警失败', message: error.message });
  }
};

exports.acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await RestorationAlert.findByPk(id);
    
    if (!alert) {
      return res.status(404).json({ error: '预警不存在' });
    }

    await alert.update({
      status: 'acknowledged',
      acknowledgedBy: req.user?.id,
      acknowledgedAt: new Date()
    });

    res.json({
      message: '预警已确认',
      data: alert
    });
  } catch (error) {
    logger.error('确认预警失败:', error);
    res.status(500).json({ error: '确认预警失败', message: error.message });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    
    const alert = await RestorationAlert.findByPk(id);
    if (!alert) {
      return res.status(404).json({ error: '预警不存在' });
    }

    await alert.update({
      status: 'resolved',
      resolvedBy: req.user?.id,
      resolvedAt: new Date(),
      resolutionNotes
    });

    res.json({
      message: '预警已解决',
      data: alert
    });
  } catch (error) {
    logger.error('解决预警失败:', error);
    res.status(500).json({ error: '解决预警失败', message: error.message });
  }
};

exports.dismissAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await RestorationAlert.findByPk(id);
    
    if (!alert) {
      return res.status(404).json({ error: '预警不存在' });
    }

    await alert.update({
      status: 'dismissed',
      resolvedBy: req.user?.id,
      resolvedAt: new Date()
    });

    res.json({
      message: '预警已忽略',
      data: alert
    });
  } catch (error) {
    logger.error('忽略预警失败:', error);
    res.status(500).json({ error: '忽略预警失败', message: error.message });
  }
};

exports.deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await RestorationAlert.findByPk(id);
    
    if (!alert) {
      return res.status(404).json({ error: '预警不存在' });
    }

    await alert.destroy();

    res.json({ message: '预警删除成功' });
  } catch (error) {
    logger.error('删除预警失败:', error);
    res.status(500).json({ error: '删除预警失败', message: error.message });
  }
};

exports.checkAndGenerateAlerts = async (req, res) => {
  try {
    const { bookId, autoResolve = false } = req.body;
    const generatedAlerts = [];

    const progressList = await RestorationProgress.findAll({ where: { bookId } });
    
    for (const progress of progressList) {
      if (progress.status === 'in_progress' && progress.startedAt) {
        const now = new Date();
        const started = new Date(progress.startedAt);
        const daysElapsed = Math.floor((now - started) / (1000 * 60 * 60 * 24));
        
        const expectedDays = progress.metadata?.expectedDays || 7;
        
        if (daysElapsed > expectedDays && progress.progressPercent < 80) {
          const existingAlert = await RestorationAlert.findOne({
            where: {
              bookId,
              progressId: progress.id,
              alertType: 'delay',
              status: { [Op.in]: ['active', 'acknowledged'] }
            }
          });

          if (!existingAlert) {
            const alert = await RestorationAlert.create({
              bookId,
              bookCode: progress.bookCode,
              progressId: progress.id,
              alertType: 'delay',
              severity: daysElapsed > expectedDays * 2 ? 'high' : 'medium',
              title: `修复进度延迟预警 - ${progress.stepName}`,
              description: `该步骤已进行${daysElapsed}天，预期${expectedDays}天，当前进度${progress.progressPercent}%`,
              currentValue: `${daysElapsed}天`,
              expectedValue: `${expectedDays}天`,
              threshold: { maxDays: expectedDays, minProgress: 80 }
            });
            generatedAlerts.push(alert);
          }
        }
      }

      if (progress.qualityCheck === 'failed' && progress.status !== 'completed') {
        const existingQualityAlert = await RestorationAlert.findOne({
          where: {
            bookId,
            progressId: progress.id,
            alertType: 'quality',
            status: { [Op.in]: ['active', 'acknowledged'] }
          }
        });

        if (!existingQualityAlert) {
          const alert = await RestorationAlert.create({
            bookId,
            bookCode: progress.bookCode,
            progressId: progress.id,
            alertType: 'quality',
            severity: 'high',
            title: `质量检测未通过 - ${progress.stepName}`,
            description: progress.qualityCheckNote || '质检结果为不合格，需要重新处理',
            currentValue: 'failed',
            expectedValue: 'passed'
          });
          generatedAlerts.push(alert);
        }
      }
    }

    const book = await RareBook.findByPk(bookId);
    if (book?.condition === 'damaged') {
      const existingConditionAlert = await RestorationAlert.findOne({
        where: {
          bookId,
          alertType: 'safety',
          status: { [Op.in]: ['active', 'acknowledged'] }
        }
      });

      if (!existingConditionAlert) {
        const alert = await RestorationAlert.create({
          bookId,
          bookCode: book.bookCode,
          alertType: 'safety',
          severity: 'critical',
          title: '善本破损状况严重',
          description: '该善本破损状况严重，需要优先处理并采取特殊保护措施',
          currentValue: book.condition,
          expectedValue: 'fair'
        });
        generatedAlerts.push(alert);
      }
    }

    res.json({
      message: '预警检查完成',
      data: {
        generatedCount: generatedAlerts.length,
        generatedAlerts,
        checkedProgress: progressList.length
      }
    });
  } catch (error) {
    logger.error('检查并生成预警失败:', error);
    res.status(500).json({ error: '检查并生成预警失败', message: error.message });
  }
};

exports.getAlertStatistics = async (req, res) => {
  try {
    const activeCount = await RestorationAlert.count({ where: { status: 'active' } });
    const acknowledgedCount = await RestorationAlert.count({ where: { status: 'acknowledged' } });
    const resolvedCount = await RestorationAlert.count({ where: { status: 'resolved' } });
    
    const bySeverity = await RestorationAlert.findAll({
      attributes: ['severity', [RestorationAlert.sequelize.fn('COUNT', '*'), 'count']],
      where: { status: { [Op.in]: ['active', 'acknowledged'] } },
      group: ['severity']
    });

    const byType = await RestorationAlert.findAll({
      attributes: ['alertType', [RestorationAlert.sequelize.fn('COUNT', '*'), 'count']],
      where: { status: { [Op.in]: ['active', 'acknowledged'] } },
      group: ['alertType']
    });

    res.json({
      data: {
        counts: {
          active: activeCount,
          acknowledged: acknowledgedCount,
          resolved: resolvedCount,
          totalActive: activeCount + acknowledgedCount
        },
        bySeverity,
        byType
      }
    });
  } catch (error) {
    logger.error('获取预警统计失败:', error);
    res.status(500).json({ error: '获取预警统计失败', message: error.message });
  }
};
