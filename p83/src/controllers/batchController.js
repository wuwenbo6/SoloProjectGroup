const { v4: uuidv4 } = require('uuid');
const Batch = require('../models/batch/Batch');
const expiryWarningService = require('../services/expiryWarningService');

const createBatch = async (req, res) => {
  try {
    const batchId = uuidv4();
    
    const batch = new Batch({
      batchId,
      ...req.body,
      createdBy: req.user.userId,
      updatedBy: req.user.userId
    });

    await batch.save();

    return res.status(201).json({
      success: true,
      message: '批次创建成功',
      data: batch
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: '批次编号已存在',
        code: 'DUPLICATE_BATCH_NUMBER'
      });
    }
    return res.status(500).json({
      success: false,
      message: '创建批次失败',
      code: 'CREATE_ERROR',
      error: error.message
    });
  }
};

const getBatches = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      materialType,
      status,
      startDate,
      endDate,
      search,
      sortBy = 'productionDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (materialType) {
      query.materialType = materialType;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.productionDate = {};
      if (startDate) {
        query.productionDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.productionDate.$lte = new Date(endDate);
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { batchNumber: { $regex: search, $options: 'i' } },
        { 'supplier.name': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [batches, total] = await Promise.all([
      Batch.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Batch.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: '获取批次列表成功',
      data: {
        batches,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取批次列表失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const getBatchById = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await Batch.findOne({ batchId: id });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
        code: 'BATCH_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '获取批次信息成功',
      data: batch
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取批次信息失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const updateBatch = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await Batch.findOne({ batchId: id });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
        code: 'BATCH_NOT_FOUND'
      });
    }

    Object.assign(batch, req.body, {
      updatedBy: req.user.userId
    });

    await batch.save();

    return res.status(200).json({
      success: true,
      message: '批次信息更新成功',
      data: batch
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '更新批次信息失败',
      code: 'UPDATE_ERROR',
      error: error.message
    });
  }
};

const deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await Batch.findOneAndDelete({ batchId: id });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
        code: 'BATCH_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '批次删除成功'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '删除批次失败',
      code: 'DELETE_ERROR',
      error: error.message
    });
  }
};

const addMaterialToBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { materialId, quantity, unit } = req.body;

    const batch = await Batch.findOne({ batchId: id });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
        code: 'BATCH_NOT_FOUND'
      });
    }

    const existingMaterial = batch.materials.find(m => m.materialId === materialId);
    if (existingMaterial) {
      existingMaterial.quantity = quantity;
      existingMaterial.unit = unit;
    } else {
      batch.materials.push({ materialId, quantity, unit });
    }

    batch.updatedBy = req.user.userId;
    await batch.save();

    return res.status(200).json({
      success: true,
      message: '材质已添加到批次',
      data: batch
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '添加材质到批次失败',
      code: 'ADD_MATERIAL_ERROR',
      error: error.message
    });
  }
};

const getBatchStats = async (req, res) => {
  try {
    const statusStats = await Batch.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const typeStats = await Batch.aggregate([
      { $group: { _id: '$materialType', count: { $sum: 1 } } }
    ]);

    const qualityStats = await Batch.aggregate([
      { $group: { _id: '$qualityStatus', count: { $sum: 1 } } }
    ]);

    const total = await Batch.countDocuments();

    return res.status(200).json({
      success: true,
      message: '获取批次统计信息成功',
      data: {
        total,
        byStatus: statusStats.map(item => ({ status: item._id, count: item.count })),
        byType: typeStats.map(item => ({ type: item._id, count: item.count })),
        byQuality: qualityStats.map(item => ({ qualityStatus: item._id, count: item.count }))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取批次统计信息失败',
      code: 'STATS_ERROR',
      error: error.message
    });
  }
};

const scanExpiryWarnings = async (req, res) => {
  try {
    const { materialType, status, warningLevel, daysThreshold, onlyWarningEnabled } = req.query;
    
    const result = await expiryWarningService.scanAllBatchesForExpiry({
      materialType,
      status,
      warningLevel,
      daysThreshold: daysThreshold ? parseInt(daysThreshold) : undefined,
      onlyWarningEnabled: onlyWarningEnabled !== 'false'
    });

    return res.status(200).json({
      success: true,
      message: '过期预警扫描完成',
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '过期预警扫描失败',
      code: 'SCAN_ERROR',
      error: error.message
    });
  }
};

const getExpirySummary = async (req, res) => {
  try {
    const { materialType, status } = req.query;
    
    const summary = await expiryWarningService.getExpirySummary({
      materialType,
      status
    });

    return res.status(200).json({
      success: true,
      message: '获取过期统计摘要成功',
      data: summary
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取过期统计摘要失败',
      code: 'SUMMARY_ERROR',
      error: error.message
    });
  }
};

const checkBatchExpiry = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await expiryWarningService.checkBatchExpiry(id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: '批次不存在或无过期日期',
        code: 'BATCH_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '批次过期检查完成',
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '批次过期检查失败',
      code: 'CHECK_ERROR',
      error: error.message
    });
  }
};

const updateWarningSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const settings = req.body;
    
    const result = await expiryWarningService.updateBatchWarningSettings(id, settings);

    return res.status(200).json({
      success: true,
      message: '预警设置更新成功',
      data: result
    });
  } catch (error) {
    if (error.message === '批次不存在') {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
        code: 'BATCH_NOT_FOUND'
      });
    }
    return res.status(500).json({
      success: false,
      message: '预警设置更新失败',
      code: 'SETTINGS_ERROR',
      error: error.message
    });
  }
};

const sendExpiryNotifications = async (req, res) => {
  try {
    const { batchIds } = req.body;
    
    const result = await expiryWarningService.sendExpiryNotifications(batchIds);

    return res.status(200).json({
      success: true,
      message: `已发送 ${result.sent} 条过期预警通知`,
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '发送过期预警通知失败',
      code: 'NOTIFICATION_ERROR',
      error: error.message
    });
  }
};

const getWarningHistory = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { limit = 100 } = req.query;
    
    const history = expiryWarningService.getWarningHistory(batchId, parseInt(limit));

    return res.status(200).json({
      success: true,
      message: '获取预警历史成功',
      data: {
        history,
        total: history.length
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取预警历史失败',
      code: 'HISTORY_ERROR',
      error: error.message
    });
  }
};

const getExpiryCalendar = async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: '年份和月份参数是必需的',
        code: 'MISSING_PARAMS'
      });
    }
    
    const calendar = await expiryWarningService.getBatchExpiryCalendar(
      parseInt(year),
      parseInt(month)
    );

    return res.status(200).json({
      success: true,
      message: '获取过期日历成功',
      data: {
        year: parseInt(year),
        month: parseInt(month),
        calendar
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取过期日历失败',
      code: 'CALENDAR_ERROR',
      error: error.message
    });
  }
};

module.exports = {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  addMaterialToBatch,
  getBatchStats,
  scanExpiryWarnings,
  getExpirySummary,
  checkBatchExpiry,
  updateWarningSettings,
  sendExpiryNotifications,
  getWarningHistory,
  getExpiryCalendar
};
