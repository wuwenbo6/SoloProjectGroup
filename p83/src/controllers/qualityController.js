const { v4: uuidv4 } = require('uuid');
const QualityRecord = require('../models/quality/QualityRecord');
const Material = require('../models/material/Material');
const precisionUtils = require('../utils/precisionUtils');

const createQualityRecord = async (req, res) => {
  try {
    const { materialId, testItems, qualityScore } = req.body;
    
    const material = await Material.findOne({ materialId });
    if (!material) {
      return res.status(404).json({
        success: false,
        message: '关联的材质信息不存在',
        code: 'MATERIAL_NOT_FOUND'
      });
    }

    const processedTestItems = precisionUtils.processTestItems(testItems);
    
    let calculatedQualityScore = qualityScore;
    if (calculatedQualityScore === undefined || calculatedQualityScore === null) {
      calculatedQualityScore = precisionUtils.calculateQualityScore(processedTestItems);
    } else {
      calculatedQualityScore = precisionUtils.roundToDecimalPlaces(calculatedQualityScore, 2);
    }

    const qualityId = uuidv4();
    const qualityRecord = new QualityRecord({
      qualityId,
      ...req.body,
      testItems: processedTestItems,
      qualityScore: calculatedQualityScore,
      createdBy: req.user.userId,
      updatedBy: req.user.userId
    });

    await qualityRecord.save();

    return res.status(201).json({
      success: true,
      message: '品质检测记录创建成功',
      data: qualityRecord
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: '品质检测记录ID已存在',
        code: 'DUPLICATE_QUALITY_ID'
      });
    }
    return res.status(500).json({
      success: false,
      message: '创建品质检测记录失败',
      code: 'CREATE_ERROR',
      error: error.message
    });
  }
};

const getQualityRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      materialId,
      batchId,
      inspectionType,
      overallResult,
      status,
      isThirdParty,
      startDate,
      endDate,
      sortBy = 'inspectionDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (materialId) {
      query.materialId = materialId;
    }

    if (batchId) {
      query.batchId = batchId;
    }

    if (inspectionType) {
      query.inspectionType = inspectionType;
    }

    if (overallResult) {
      query.overallResult = overallResult;
    }

    if (status) {
      query.status = status;
    }

    if (isThirdParty !== undefined) {
      query['testingAgency.isThirdParty'] = isThirdParty === 'true';
    }

    if (startDate || endDate) {
      query.inspectionDate = {};
      if (startDate) {
        query.inspectionDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.inspectionDate.$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [records, total] = await Promise.all([
      QualityRecord.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      QualityRecord.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: '获取品质检测记录列表成功',
      data: {
        records,
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
      message: '获取品质检测记录列表失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const getQualityRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await QualityRecord.findOne({ qualityId: id });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
        code: 'QUALITY_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '获取品质检测记录成功',
      data: record
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取品质检测记录失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const updateQualityRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { testItems, qualityScore } = req.body;

    const record = await QualityRecord.findOne({ qualityId: id });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
        code: 'QUALITY_NOT_FOUND'
      });
    }

    const updateData = { ...req.body, updatedBy: req.user.userId };

    if (testItems) {
      updateData.testItems = precisionUtils.processTestItems(testItems);
      
      if (qualityScore === undefined || qualityScore === null) {
        updateData.qualityScore = precisionUtils.calculateQualityScore(updateData.testItems);
      } else {
        updateData.qualityScore = precisionUtils.roundToDecimalPlaces(qualityScore, 2);
      }
    } else if (qualityScore !== undefined) {
      updateData.qualityScore = precisionUtils.roundToDecimalPlaces(qualityScore, 2);
    }

    Object.assign(record, updateData);
    await record.save();

    return res.status(200).json({
      success: true,
      message: '品质检测记录更新成功',
      data: record
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '更新品质检测记录失败',
      code: 'UPDATE_ERROR',
      error: error.message
    });
  }
};

const deleteQualityRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await QualityRecord.findOneAndDelete({ qualityId: id });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '品质检测记录不存在',
        code: 'QUALITY_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '品质检测记录删除成功'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '删除品质检测记录失败',
      code: 'DELETE_ERROR',
      error: error.message
    });
  }
};

const getQualityStats = async (req, res) => {
  try {
    const resultStats = await QualityRecord.aggregate([
      { $group: { _id: '$overallResult', count: { $sum: 1 } } }
    ]);

    const typeStats = await QualityRecord.aggregate([
      { $group: { _id: '$inspectionType', count: { $sum: 1 } } }
    ]);

    const statusStats = await QualityRecord.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const avgScore = await QualityRecord.aggregate([
      { $match: { qualityScore: { $exists: true, $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$qualityScore' } } }
    ]);

    const total = await QualityRecord.countDocuments();

    return res.status(200).json({
      success: true,
      message: '获取品质统计信息成功',
      data: {
        total,
        averageScore: precisionUtils.roundToDecimalPlaces(avgScore[0]?.avg || 0, 2),
        byResult: resultStats.map(item => ({ result: item._id, count: item.count })),
        byType: typeStats.map(item => ({ type: item._id, count: item.count })),
        byStatus: statusStats.map(item => ({ status: item._id, count: item.count }))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取品质统计信息失败',
      code: 'STATS_ERROR',
      error: error.message
    });
  }
};

module.exports = {
  createQualityRecord,
  getQualityRecords,
  getQualityRecordById,
  updateQualityRecord,
  deleteQualityRecord,
  getQualityStats
};
