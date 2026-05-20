const RareBook = require('../models/rareBook/RareBook');
const TraceUtil = require('../utils/traceUtil');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

exports.createRareBook = async (req, res) => {
  try {
    const { bookCode, title, author, dynasty } = req.body;
    
    const existing = await RareBook.findOne({ where: { bookCode } });
    if (existing) {
      return res.status(400).json({ error: '古籍编号已存在' });
    }

    const traceId = TraceUtil.generateTraceId();
    
    const rareBook = await RareBook.create({
      ...req.body,
      traceId,
      createdBy: req.user?.id,
      updatedBy: req.user?.id
    });

    TraceUtil.logOperation(traceId, 'create_rare_book', { bookId: rareBook.id, bookCode }, req.user?.id);

    res.status(201).json({
      message: '善本信息创建成功',
      data: rareBook
    });
  } catch (error) {
    logger.error('创建善本信息失败:', error);
    res.status(500).json({ error: '创建善本信息失败', message: error.message });
  }
};

exports.getRareBookById = async (req, res) => {
  try {
    const { id } = req.params;
    const rareBook = await RareBook.findByPk(id);
    
    if (!rareBook) {
      return res.status(404).json({ error: '善本信息不存在' });
    }

    res.json({ data: rareBook });
  } catch (error) {
    logger.error('获取善本信息失败:', error);
    res.status(500).json({ error: '获取善本信息失败', message: error.message });
  }
};

exports.getRareBookByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const rareBook = await RareBook.findOne({ where: { bookCode: code } });
    
    if (!rareBook) {
      return res.status(404).json({ error: '善本信息不存在' });
    }

    res.json({ data: rareBook });
  } catch (error) {
    logger.error('获取善本信息失败:', error);
    res.status(500).json({ error: '获取善本信息失败', message: error.message });
  }
};

exports.getAllRareBooks = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, dynasty, condition, keyword } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (dynasty) where.dynasty = dynasty;
    if (condition) where.condition = condition;
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { bookCode: { [Op.like]: `%${keyword}%` } },
        { author: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await RareBook.findAndCountAll({
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
    logger.error('获取善本列表失败:', error);
    res.status(500).json({ error: '获取善本列表失败', message: error.message });
  }
};

exports.updateRareBook = async (req, res) => {
  try {
    const { id } = req.params;
    const rareBook = await RareBook.findByPk(id);
    
    if (!rareBook) {
      return res.status(404).json({ error: '善本信息不存在' });
    }

    await rareBook.update({
      ...req.body,
      updatedBy: req.user?.id
    });

    TraceUtil.logOperation(rareBook.traceId, 'update_rare_book', { bookId: id }, req.user?.id);

    res.json({
      message: '善本信息更新成功',
      data: rareBook
    });
  } catch (error) {
    logger.error('更新善本信息失败:', error);
    res.status(500).json({ error: '更新善本信息失败', message: error.message });
  }
};

exports.deleteRareBook = async (req, res) => {
  try {
    const { id } = req.params;
    const rareBook = await RareBook.findByPk(id);
    
    if (!rareBook) {
      return res.status(404).json({ error: '善本信息不存在' });
    }

    await rareBook.destroy();

    TraceUtil.logOperation(rareBook.traceId, 'delete_rare_book', { bookId: id }, req.user?.id);

    res.json({ message: '善本信息删除成功' });
  } catch (error) {
    logger.error('删除善本信息失败:', error);
    res.status(500).json({ error: '删除善本信息失败', message: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const rareBook = await RareBook.findByPk(id);
    if (!rareBook) {
      return res.status(404).json({ error: '善本信息不存在' });
    }

    await rareBook.update({ status, updatedBy: req.user?.id });

    TraceUtil.logOperation(rareBook.traceId, 'update_status', { bookId: id, status }, req.user?.id);

    res.json({
      message: '状态更新成功',
      data: { id, status }
    });
  } catch (error) {
    logger.error('更新状态失败:', error);
    res.status(500).json({ error: '更新状态失败', message: error.message });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const total = await RareBook.count();
    const statusStats = await RareBook.findAll({
      attributes: ['status', [RareBook.sequelize.fn('COUNT', '*'), 'count']],
      group: ['status']
    });
    const dynastyStats = await RareBook.findAll({
      attributes: ['dynasty', [RareBook.sequelize.fn('COUNT', '*'), 'count']],
      group: ['dynasty']
    });

    res.json({
      data: {
        total,
        byStatus: statusStats,
        byDynasty: dynastyStats
      }
    });
  } catch (error) {
    logger.error('获取统计信息失败:', error);
    res.status(500).json({ error: '获取统计信息失败', message: error.message });
  }
};
