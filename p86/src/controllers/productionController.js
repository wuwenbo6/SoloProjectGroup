const ProductionRecord = require('../models/production/ProductionRecord');
const Batch = require('../models/production/Batch');

const generateRecordCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `PROD-${timestamp}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
};

exports.createProductionRecord = async (req, res) => {
  try {
    const { batchId } = req.body;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在',
      });
    }

    const recordCode = generateRecordCode();

    const record = await ProductionRecord.create({
      ...req.body,
      recordCode,
      operatorId: req.user._id,
      operatorName: req.user.name,
      craftId: batch.craftId,
      craftCode: batch.craftCode,
      batchCode: batch.batchCode,
    });

    res.status(201).json({
      success: true,
      data: record,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建制作记录失败',
      error: error.message,
    });
  }
};

exports.getAllProductionRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10, batchId, status, stepNumber } = req.query;
    
    const query = {};
    if (batchId) query.batchId = batchId;
    if (status) query.status = status;
    if (stepNumber) query.stepNumber = stepNumber;

    const records = await ProductionRecord.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await ProductionRecord.countDocuments(query);

    res.status(200).json({
      success: true,
      data: records,
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
      message: '获取制作记录列表失败',
      error: error.message,
    });
  }
};

exports.getProductionRecordById = async (req, res) => {
  try {
    const record = await ProductionRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '制作记录不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取制作记录详情失败',
      error: error.message,
    });
  }
};

exports.updateProductionRecord = async (req, res) => {
  try {
    const record = await ProductionRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '制作记录不存在',
      });
    }

    const updatedRecord = await ProductionRecord.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: updatedRecord,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新制作记录失败',
      error: error.message,
    });
  }
};

exports.completeProductionRecord = async (req, res) => {
  try {
    const record = await ProductionRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '制作记录不存在',
      });
    }

    const endTime = new Date();
    const duration = (endTime - new Date(record.startTime)) / 1000 / 60;

    const updatedRecord = await ProductionRecord.findByIdAndUpdate(
      req.params.id,
      {
        status: '已完成',
        endTime,
        duration: Math.round(duration),
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: updatedRecord,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '完成制作记录失败',
      error: error.message,
    });
  }
};

exports.updateProductionParameters = async (req, res) => {
  try {
    const { temperature, humidity, toolPressure, carvingDepth, carvingSpeed, woodMoisture } = req.body;

    const record = await ProductionRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '制作记录不存在',
      });
    }

    const updateData = {};
    const parameterHistory = {
      updatedBy: req.user._id,
      updatedByName: req.user.name,
      updatedAt: new Date(),
      changes: {},
    };

    if (temperature !== undefined && temperature !== null) {
      updateData['parameters.temperature'] = temperature;
      parameterHistory.changes.temperature = temperature;
    }
    if (humidity !== undefined && humidity !== null) {
      updateData['parameters.humidity'] = humidity;
      parameterHistory.changes.humidity = humidity;
    }
    if (toolPressure !== undefined && toolPressure !== null) {
      updateData['parameters.toolPressure'] = toolPressure;
      parameterHistory.changes.toolPressure = toolPressure;
    }
    if (carvingDepth !== undefined && carvingDepth !== null) {
      updateData['parameters.carvingDepth'] = carvingDepth;
      parameterHistory.changes.carvingDepth = carvingDepth;
    }
    if (carvingSpeed !== undefined && carvingSpeed !== null) {
      updateData['parameters.carvingSpeed'] = carvingSpeed;
      parameterHistory.changes.carvingSpeed = carvingSpeed;
    }
    if (woodMoisture !== undefined && woodMoisture !== null) {
      updateData['parameters.woodMoisture'] = woodMoisture;
      parameterHistory.changes.woodMoisture = woodMoisture;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有提供有效的参数进行更新',
      });
    }

    const updatedRecord = await ProductionRecord.findByIdAndUpdate(
      req.params.id,
      {
        $set: updateData,
        $push: { parameterHistory: parameterHistory },
      },
      {
        new: true,
        runValidators: true,
        w: 'majority',
      }
    );

    res.status(200).json({
      success: true,
      data: updatedRecord,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新制作参数失败',
      error: error.message,
    });
  }
};

exports.batchUpdateProductionParameters = async (req, res) => {
  try {
    const { recordIds, parameters } = req.body;

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的记录ID数组',
      });
    }

    const updateData = {};
    if (parameters.temperature !== undefined && parameters.temperature !== null) {
      updateData['parameters.temperature'] = parameters.temperature;
    }
    if (parameters.humidity !== undefined && parameters.humidity !== null) {
      updateData['parameters.humidity'] = parameters.humidity;
    }
    if (parameters.toolPressure !== undefined && parameters.toolPressure !== null) {
      updateData['parameters.toolPressure'] = parameters.toolPressure;
    }
    if (parameters.carvingDepth !== undefined && parameters.carvingDepth !== null) {
      updateData['parameters.carvingDepth'] = parameters.carvingDepth;
    }
    if (parameters.carvingSpeed !== undefined && parameters.carvingSpeed !== null) {
      updateData['parameters.carvingSpeed'] = parameters.carvingSpeed;
    }
    if (parameters.woodMoisture !== undefined && parameters.woodMoisture !== null) {
      updateData['parameters.woodMoisture'] = parameters.woodMoisture;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有提供有效的参数进行更新',
      });
    }

    const result = await ProductionRecord.updateMany(
      { _id: { $in: recordIds } },
      {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      },
      {
        w: 'majority',
      }
    );

    res.status(200).json({
      success: true,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '批量更新制作参数失败',
      error: error.message,
    });
  }
};

exports.uploadProductionImage = async (req, res) => {
  try {
    const { url, description } = req.body;

    const record = await ProductionRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '制作记录不存在',
      });
    }

    record.images.push({
      url,
      description,
      uploadedAt: new Date(),
    });

    await record.save();

    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '上传图片失败',
      error: error.message,
    });
  }
};