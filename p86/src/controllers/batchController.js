const Batch = require('../models/production/Batch');
const WoodcarvingCraft = require('../models/craft/WoodcarvingCraft');

const generateBatchCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `BATCH-${timestamp}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
};

exports.createBatch = async (req, res) => {
  try {
    const { craftId, quantity, startDate, estimatedEndDate, workshop, remarks } = req.body;

    const craft = await WoodcarvingCraft.findById(craftId);
    if (!craft) {
      return res.status(404).json({
        success: false,
        message: '工艺不存在',
      });
    }

    const batchCode = generateBatchCode();

    const batch = await Batch.create({
      batchCode,
      craftId,
      craftCode: craft.craftCode,
      craftName: craft.craftName,
      quantity,
      startDate,
      estimatedEndDate,
      workshop,
      remarks,
      createdBy: req.user._id,
      status: '待开始',
      priority: '中',
      progress: 0,
    });

    res.status(201).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建批次失败',
      error: error.message,
    });
  }
};

exports.getAllBatches = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, priority, workshop, keyword } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (workshop) query.workshop = workshop;
    if (keyword) {
      query.$or = [
        { craftName: { $regex: keyword, $options: 'i' } },
        { batchCode: { $regex: keyword, $options: 'i' } },
      ];
    }

    const batches = await Batch.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Batch.countDocuments(query);

    res.status(200).json({
      success: true,
      data: batches,
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
      message: '获取批次列表失败',
      error: error.message,
    });
  }
};

exports.getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取批次详情失败',
      error: error.message,
    });
  }
};

exports.updateBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    const updatedBatch = await Batch.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: updatedBatch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新批次失败',
      error: error.message,
    });
  }
};

exports.deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    await Batch.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: '批次删除成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除批次失败',
      error: error.message,
    });
  }
};

exports.startBatch = async (req, res) => {
  try {
    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      { status: '进行中' },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '启动批次失败',
      error: error.message,
    });
  }
};

exports.pauseBatch = async (req, res) => {
  try {
    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      { status: '已暂停' },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '暂停批次失败',
      error: error.message,
    });
  }
};

exports.completeBatch = async (req, res) => {
  try {
    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      { 
        status: '已完成',
        actualEndDate: new Date(),
      },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '完成批次失败',
      error: error.message,
    });
  }
};

exports.cancelBatch = async (req, res) => {
  try {
    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      { status: '已取消' },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '取消批次失败',
      error: error.message,
    });
  }
};

exports.updateBatchProgress = async (req, res) => {
  try {
    const { progress } = req.body;

    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      { progress },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新批次进度失败',
      error: error.message,
    });
  }
};

exports.assignBatch = async (req, res) => {
  try {
    const { assigneeId } = req.body;

    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      { assignee: assigneeId },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '分配批次失败',
      error: error.message,
    });
  }
};

exports.getBatchStatistics = async (req, res) => {
  try {
    const total = await Batch.countDocuments();
    const pending = await Batch.countDocuments({ status: '待开始' });
    const inProgress = await Batch.countDocuments({ status: '进行中' });
    const completed = await Batch.countDocuments({ status: '已完成' });
    const paused = await Batch.countDocuments({ status: '已暂停' });
    const cancelled = await Batch.countDocuments({ status: '已取消' });

    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        inProgress,
        completed,
        paused,
        cancelled,
        completionRate: `${completionRate}%`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取批次统计数据失败',
      error: error.message,
    });
  }
};