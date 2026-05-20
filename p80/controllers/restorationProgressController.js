const RestorationProgress = require('../models/restoration/RestorationProgress');
const TraceUtil = require('../utils/traceUtil');
const logger = require('../utils/logger');
const { Op, Transaction } = require('sequelize');
const { restorationDB } = require('../config/databases');

exports.createProgress = async (req, res) => {
  const transaction = await restorationDB.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
  });

  try {
    const { bookId, bookCode, stepOrder, stepName } = req.body;
    
    const existing = await RestorationProgress.findOne({
      where: { bookId, stepOrder },
      transaction,
      lock: true
    });
    
    if (existing) {
      await transaction.rollback();
      return res.status(409).json({ 
        error: '该步骤序号已存在',
        existingData: {
          id: existing.id,
          stepName: existing.stepName,
          status: existing.status
        }
      });
    }

    const nameDuplicate = await RestorationProgress.findOne({
      where: { 
        bookId, 
        stepName: { [Op.eq]: stepName }
      },
      transaction
    });

    if (nameDuplicate) {
      await transaction.rollback();
      return res.status(409).json({ 
        error: '该步骤名称已存在',
        existingData: {
          id: nameDuplicate.id,
          stepOrder: nameDuplicate.stepOrder,
          status: nameDuplicate.status
        }
      });
    }

    const traceId = TraceUtil.generateTraceId();
    
    const progress = await RestorationProgress.create({
      ...req.body,
      traceId,
      restorerId: req.user?.id,
      restorerName: req.user?.realName
    }, { transaction });

    await transaction.commit();

    TraceUtil.logOperation(traceId, 'create_progress', { bookId, progressId: progress.id }, req.user?.id);

    res.status(201).json({
      message: '修复进度创建成功',
      data: progress,
      idempotencyKey: req.idempotencyKey
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('创建修复进度失败:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        error: '唯一约束冲突，数据已存在',
        message: error.message
      });
    }
    
    res.status(500).json({ error: '创建修复进度失败', message: error.message });
  }
};

exports.getProgressById = async (req, res) => {
  try {
    const { id } = req.params;
    const progress = await RestorationProgress.findByPk(id);
    
    if (!progress) {
      return res.status(404).json({ error: '修复进度不存在' });
    }

    res.json({ data: progress });
  } catch (error) {
    logger.error('获取修复进度失败:', error);
    res.status(500).json({ error: '获取修复进度失败', message: error.message });
  }
};

exports.getProgressByBookId = async (req, res) => {
  try {
    const { bookId } = req.params;
    const progressList = await RestorationProgress.findAll({
      where: { bookId },
      order: [['stepOrder', 'ASC']]
    });

    res.json({ data: progressList });
  } catch (error) {
    logger.error('获取修复进度列表失败:', error);
    res.status(500).json({ error: '获取修复进度列表失败', message: error.message });
  }
};

exports.getAllProgress = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, restorerId, bookCode } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (restorerId) where.restorerId = restorerId;
    if (bookCode) where.bookCode = { [Op.like]: `%${bookCode}%` };

    const { count, rows } = await RestorationProgress.findAndCountAll({
      where,
      offset: (page - 1) * limit,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
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
    logger.error('获取修复进度列表失败:', error);
    res.status(500).json({ error: '获取修复进度列表失败', message: error.message });
  }
};

exports.updateProgress = async (req, res) => {
  const transaction = await restorationDB.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ
  });

  try {
    const { id } = req.params;
    const progress = await RestorationProgress.findByPk(id, {
      transaction,
      lock: true
    });
    
    if (!progress) {
      await transaction.rollback();
      return res.status(404).json({ error: '修复进度不存在' });
    }

    if (req.body.stepOrder) {
      const conflict = await RestorationProgress.findOne({
        where: { 
          bookId: progress.bookId, 
          stepOrder: req.body.stepOrder,
          id: { [Op.ne]: id }
        },
        transaction
      });
      
      if (conflict) {
        await transaction.rollback();
        return res.status(409).json({ error: '步骤序号冲突' });
      }
    }

    await progress.update(req.body, { transaction });
    await transaction.commit();

    TraceUtil.logOperation(progress.traceId, 'update_progress', { progressId: id }, req.user?.id);

    res.json({
      message: '修复进度更新成功',
      data: progress
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('更新修复进度失败:', error);
    
    if (error.name === 'SequelizeOptimisticLockError') {
      return res.status(409).json({ 
        error: '数据版本冲突，请刷新后重试',
        message: error.message
      });
    }
    
    res.status(500).json({ error: '更新修复进度失败', message: error.message });
  }
};

exports.updateProgressStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const progress = await RestorationProgress.findByPk(id);
    if (!progress) {
      return res.status(404).json({ error: '修复进度不存在' });
    }

    const updateData = { status };
    if (status === 'in_progress' && !progress.startedAt) {
      updateData.startedAt = new Date();
    } else if (status === 'completed') {
      updateData.completedAt = new Date();
      updateData.progressPercent = 100;
    }

    await progress.update(updateData);

    TraceUtil.logOperation(progress.traceId, 'update_progress_status', { progressId: id, status }, req.user?.id);

    res.json({
      message: '状态更新成功',
      data: { id, status }
    });
  } catch (error) {
    logger.error('更新状态失败:', error);
    res.status(500).json({ error: '更新状态失败', message: error.message });
  }
};

exports.updateProgressPercent = async (req, res) => {
  try {
    const { id } = req.params;
    const { progressPercent } = req.body;
    
    const progress = await RestorationProgress.findByPk(id);
    if (!progress) {
      return res.status(404).json({ error: '修复进度不存在' });
    }

    await progress.update({ progressPercent });

    res.json({
      message: '进度百分比更新成功',
      data: { id, progressPercent }
    });
  } catch (error) {
    logger.error('更新进度百分比失败:', error);
    res.status(500).json({ error: '更新进度百分比失败', message: error.message });
  }
};

exports.qualityCheck = async (req, res) => {
  try {
    const { id } = req.params;
    const { qualityCheck, qualityCheckNote } = req.body;
    
    const progress = await RestorationProgress.findByPk(id);
    if (!progress) {
      return res.status(404).json({ error: '修复进度不存在' });
    }

    await progress.update({
      qualityCheck,
      qualityCheckNote,
      qualityCheckedBy: req.user?.id,
      qualityCheckedAt: new Date()
    });

    TraceUtil.logOperation(progress.traceId, 'quality_check', { progressId: id, qualityCheck }, req.user?.id);

    res.json({
      message: '质检完成',
      data: progress
    });
  } catch (error) {
    logger.error('质检失败:', error);
    res.status(500).json({ error: '质检失败', message: error.message });
  }
};

exports.deleteProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const progress = await RestorationProgress.findByPk(id);
    
    if (!progress) {
      return res.status(404).json({ error: '修复进度不存在' });
    }

    await progress.destroy();

    res.json({ message: '修复进度删除成功' });
  } catch (error) {
    logger.error('删除修复进度失败:', error);
    res.status(500).json({ error: '删除修复进度失败', message: error.message });
  }
};

exports.getMyProgress = async (req, res) => {
  try {
    const { status } = req.query;
    const where = { restorerId: req.user.id };
    if (status) where.status = status;

    const progressList = await RestorationProgress.findAll({
      where,
      order: [['updatedAt', 'DESC']]
    });

    res.json({ data: progressList });
  } catch (error) {
    logger.error('获取我的修复进度失败:', error);
    res.status(500).json({ error: '获取我的修复进度失败', message: error.message });
  }
};
