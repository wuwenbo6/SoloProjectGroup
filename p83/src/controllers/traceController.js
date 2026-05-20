const TraceRecord = require('../models/trace/TraceRecord');
const Material = require('../models/material/Material');
const traceCodeGenerator = require('../utils/traceCodeGenerator');
const traceExportService = require('../services/traceExportService');

const createTraceRecord = async (req, res) => {
  try {
    const { materialId, previousTraceId } = req.body;
    
    const material = await Material.findOne({ materialId });
    if (!material) {
      return res.status(404).json({
        success: false,
        message: '关联的材质信息不存在',
        code: 'MATERIAL_NOT_FOUND'
      });
    }

    const traceId = await traceCodeGenerator.generateUniqueTraceId(5);
    const traceRecord = new TraceRecord({
      traceId,
      ...req.body,
      createdBy: req.user.userId
    });

    if (previousTraceId) {
      const previousTrace = await TraceRecord.findOne({ traceId: previousTraceId });
      if (previousTrace) {
        if (!previousTrace.nextTraceIds) {
          previousTrace.nextTraceIds = [];
        }
        previousTrace.nextTraceIds.push(traceId);
        await previousTrace.save();
      }
    }

    await traceRecord.save();

    return res.status(201).json({
      success: true,
      message: '溯源记录创建成功',
      data: traceRecord
    });
  } catch (error) {
    if (error.code === 11000) {
      const traceId = await traceCodeGenerator.generateUniqueTraceId(10);
      try {
        const traceRecord = new TraceRecord({
          traceId,
          ...req.body,
          createdBy: req.user.userId
        });
        await traceRecord.save();
        return res.status(201).json({
          success: true,
          message: '溯源记录创建成功（重试机制）',
          data: traceRecord
        });
      } catch (retryError) {
        return res.status(500).json({
          success: false,
          message: '溯源记录创建失败，溯源码多次重试仍冲突',
          code: 'DUPLICATE_TRACE_ID_FATAL',
          error: retryError.message
        });
      }
    }
    return res.status(500).json({
      success: false,
      message: '创建溯源记录失败',
      code: 'CREATE_ERROR',
      error: error.message
    });
  }
};

const getTraceRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      materialId,
      batchId,
      stage,
      status,
      startDate,
      endDate,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (materialId) {
      query.materialId = materialId;
    }

    if (batchId) {
      query.batchId = batchId;
    }

    if (stage) {
      query.stage = stage;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [records, total] = await Promise.all([
      TraceRecord.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      TraceRecord.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: '获取溯源记录列表成功',
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
      message: '获取溯源记录列表失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const getTraceRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await TraceRecord.findOne({ traceId: id });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '溯源记录不存在',
        code: 'TRACE_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '获取溯源记录成功',
      data: record
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取溯源记录失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const getMaterialTraceChain = async (req, res) => {
  try {
    const { materialId } = req.params;

    const records = await TraceRecord.find({ materialId })
      .sort({ timestamp: 1 });

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '该材质暂无溯源记录',
        code: 'NO_TRACE_RECORDS'
      });
    }

    const chainMap = new Map();
    records.forEach(record => {
      chainMap.set(record.traceId, { ...record.toObject(), next: [] });
    });

    const roots = [];
    chainMap.forEach((node, traceId) => {
      if (node.previousTraceId && chainMap.has(node.previousTraceId)) {
        chainMap.get(node.previousTraceId).next.push(node);
      } else {
        roots.push(node);
      }
    });

    return res.status(200).json({
      success: true,
      message: '获取材质溯源链成功',
      data: {
        materialId,
        chain: roots,
        totalStages: records.length,
        stages: [...new Set(records.map(r => r.stage))]
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取材质溯源链失败',
      code: 'CHAIN_ERROR',
      error: error.message
    });
  }
};

const updateTraceRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await TraceRecord.findOne({ traceId: id });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '溯源记录不存在',
        code: 'TRACE_NOT_FOUND'
      });
    }

    Object.assign(record, req.body);
    await record.save();

    return res.status(200).json({
      success: true,
      message: '溯源记录更新成功',
      data: record
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '更新溯源记录失败',
      code: 'UPDATE_ERROR',
      error: error.message
    });
  }
};

const deleteTraceRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await TraceRecord.findOneAndDelete({ traceId: id });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '溯源记录不存在',
        code: 'TRACE_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '溯源记录删除成功'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '删除溯源记录失败',
      code: 'DELETE_ERROR',
      error: error.message
    });
  }
};

const getTraceStats = async (req, res) => {
  try {
    const stageStats = await TraceRecord.aggregate([
      { $group: { _id: '$stage', count: { $sum: 1 } } }
    ]);

    const statusStats = await TraceRecord.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const total = await TraceRecord.countDocuments();

    return res.status(200).json({
      success: true,
      message: '获取溯源统计信息成功',
      data: {
        total,
        byStage: stageStats.map(item => ({ stage: item._id, count: item.count })),
        byStatus: statusStats.map(item => ({ status: item._id, count: item.count }))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取溯源统计信息失败',
      code: 'STATS_ERROR',
      error: error.message
    });
  }
};

const exportTraceData = async (req, res) => {
  try {
    const { format = 'json', includeRaw = false } = req.query;
    const filters = req.body || {};
    
    let result;

    switch (format.toLowerCase()) {
      case 'json':
        result = await traceExportService.exportToJSON(filters, { includeRaw: includeRaw === 'true' });
        break;
      case 'csv':
        result = await traceExportService.exportToCSV(filters);
        break;
      case 'excel':
      case 'xlsx':
        result = await traceExportService.exportToExcel(filters);
        break;
      case 'pdf':
        result = await traceExportService.exportToPDF(filters);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: '不支持的导出格式，支持的格式: json, csv, excel, pdf',
          code: 'UNSUPPORTED_FORMAT'
        });
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    
    if (format.toLowerCase() === 'json') {
      return res.json(JSON.parse(result.data));
    }
    
    return res.send(result.data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '导出溯源数据失败',
      code: 'EXPORT_ERROR',
      error: error.message
    });
  }
};

const exportMaterialTraceChain = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { format = 'json' } = req.query;

    const result = await traceExportService.exportTraceChain(materialId, format);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    
    if (format.toLowerCase() === 'json') {
      return res.json(JSON.parse(result.data));
    }
    
    return res.send(result.data);
  } catch (error) {
    if (error.message === '该材质暂无溯源记录') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'NO_TRACE_RECORDS'
      });
    }
    return res.status(500).json({
      success: false,
      message: '导出溯源链失败',
      code: 'EXPORT_CHAIN_ERROR',
      error: error.message
    });
  }
};

const generateExportTemplate = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const headers = [
      'materialId*',
      'batchId',
      'stage*',
      'status',
      'operator.operatorId',
      'operator.name',
      'operator.role',
      'equipment.equipmentId',
      'equipment.name',
      'equipment.calibrationStatus',
      'actions.0.actionType',
      'actions.0.description',
      'actions.0.parameters',
      'environmentalConditions.temperature',
      'environmentalConditions.humidity',
      'environmentalConditions.pressure',
      'location.country',
      'location.province',
      'location.city',
      'location.address',
      'location.coordinates.latitude',
      'location.coordinates.longitude',
      'previousTraceId'
    ];

    if (format === 'json') {
      const template = {
        description: '溯源数据导入模板',
        requiredFields: ['materialId', 'stage'],
        example: {
          materialId: 'mat-001',
          batchId: 'batch-001',
          stage: 'harvest',
          status: 'completed',
          operator: {
            operatorId: 'op-001',
            name: '张三',
            role: '采集员'
          },
          equipment: {
            equipmentId: 'eq-001',
            name: '伐木设备A',
            calibrationStatus: 'calibrated'
          },
          actions: [
            {
              actionType: 'cutting',
              description: '木材切割作业',
              parameters: { duration: 30, method: 'manual' }
            }
          ],
          location: {
            country: '中国',
            province: '云南',
            city: '西双版纳'
          }
        },
        fields: headers.map(h => ({
          field: h,
          required: h.includes('*')
        }))
      };

      return res.status(200).json({
        success: true,
        message: '生成导入模板成功',
        data: template
      });
    }

    if (format === 'csv') {
      const csvContent = [
        headers.join(','),
        'mat-001,batch-001,harvest,completed,op-001,张三,采集员,eq-001,伐木设备A,calibrated,cutting,木材切割作业,{"duration":30},25,60,101,中国,云南,西双版纳,景洪市,21.9,100.8,'
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="trace_import_template.csv"');
      return res.send('\ufeff' + csvContent);
    }

    return res.status(400).json({
      success: false,
      message: '不支持的模板格式',
      code: 'UNSUPPORTED_FORMAT'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '生成导入模板失败',
      code: 'TEMPLATE_ERROR',
      error: error.message
    });
  }
};

module.exports = {
  createTraceRecord,
  getTraceRecords,
  getTraceRecordById,
  getMaterialTraceChain,
  updateTraceRecord,
  deleteTraceRecord,
  getTraceStats,
  exportTraceData,
  exportMaterialTraceChain,
  generateExportTemplate
};
