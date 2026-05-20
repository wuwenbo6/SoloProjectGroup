const Batch = require('../models/production/Batch');
const logger = require('../config/logger');

const generateBatchNumber = () => {
  const date = new Date();
  const prefix = 'BATCH';
  const timestamp = date.getTime().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

const createBatch = async (req, res) => {
  try {
    const { processTemplateId, propName, propType, quantity, plannedStartDate, plannedEndDate, priority, notes, assignedTo } = req.body;

    const batchNumber = generateBatchNumber();

    const batch = new Batch({
      batchNumber,
      processTemplateId,
      propName,
      propType,
      quantity,
      plannedStartDate,
      plannedEndDate,
      priority: priority || 'medium',
      notes,
      createdBy: req.user.id,
      assignedTo
    });

    await batch.save();

    res.status(201).json({
      success: true,
      message: '批次创建成功',
      data: { batch }
    });
  } catch (error) {
    logger.error('创建批次失败:', error);
    res.status(500).json({
      success: false,
      message: '创建批次失败',
      error: error.message
    });
  }
};

const getBatches = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;

    const batches = await Batch.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Batch.countDocuments(query);

    res.json({
      success: true,
      data: {
        batches,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取批次列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取批次列表失败',
      error: error.message
    });
  }
};

const getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    res.json({
      success: true,
      data: { batch }
    });
  } catch (error) {
    logger.error('获取批次详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取批次详情失败',
      error: error.message
    });
  }
};

const updateBatch = async (req, res) => {
  try {
    const { propName, propType, quantity, plannedStartDate, plannedEndDate, actualStartDate, actualEndDate, status, priority, notes, assignedTo } = req.body;

    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    const updatedBatch = await Batch.findByIdAndUpdate(
      req.params.id,
      {
        propName,
        propType,
        quantity,
        plannedStartDate,
        plannedEndDate,
        actualStartDate,
        actualEndDate,
        status,
        priority,
        notes,
        assignedTo
      },
      { new: true }
    );

    res.json({
      success: true,
      message: '批次更新成功',
      data: { batch: updatedBatch }
    });
  } catch (error) {
    logger.error('更新批次失败:', error);
    res.status(500).json({
      success: false,
      message: '更新批次失败',
      error: error.message
    });
  }
};

const startBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    batch.status = 'in_progress';
    batch.actualStartDate = new Date();
    await batch.save();

    res.json({
      success: true,
      message: '批次已开始',
      data: { batch }
    });
  } catch (error) {
    logger.error('开始批次失败:', error);
    res.status(500).json({
      success: false,
      message: '开始批次失败',
      error: error.message
    });
  }
};

const completeBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    batch.status = 'completed';
    batch.actualEndDate = new Date();
    await batch.save();

    res.json({
      success: true,
      message: '批次已完成',
      data: { batch }
    });
  } catch (error) {
    logger.error('完成批次失败:', error);
    res.status(500).json({
      success: false,
      message: '完成批次失败',
      error: error.message
    });
  }
};

const deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    await Batch.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: '批次删除成功'
    });
  } catch (error) {
    logger.error('删除批次失败:', error);
    res.status(500).json({
      success: false,
      message: '删除批次失败',
      error: error.message
    });
  }
};

module.exports = {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  startBatch,
  completeBatch,
  deleteBatch
};
