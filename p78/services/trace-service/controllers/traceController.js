const { successResponse, errorResponse, paginatedResponse } = require('../../../shared/utils/response');
const TraceRecord = require('../models/TraceRecord');
const OriginRecord = require('../models/OriginRecord');
const ProcessingRecord = require('../models/ProcessingRecord');
const TransportRecord = require('../models/TransportRecord');

let traceRecordModel, originRecordModel, processingRecordModel, transportRecordModel;

const initModels = (pool) => {
  traceRecordModel = new TraceRecord(pool);
  originRecordModel = new OriginRecord(pool);
  processingRecordModel = new ProcessingRecord(pool);
  transportRecordModel = new TransportRecord(pool);
};

const createTraceRecord = async (req, res) => {
  try {
    const record = await traceRecordModel.create({
      ...req.body,
      operator_id: req.user.id,
      operator_name: req.user.username
    });
    successResponse(res, record, '溯源记录创建成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getTraceRecords = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filters = {
      batch_id: req.query.batch_id,
      trace_type: req.query.trace_type
    };

    const result = await traceRecordModel.findAll(filters, page, limit);
    paginatedResponse(res, result.records, page, limit, result.total, '获取溯源记录列表成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getTraceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await traceRecordModel.findById(id);
    if (!record) {
      return errorResponse(res, '溯源记录不存在', 404);
    }
    successResponse(res, record, '获取溯源记录成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const invalidateTraceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await traceRecordModel.invalidate(id);
    if (success) {
      successResponse(res, null, '溯源记录已作废');
    } else {
      errorResponse(res, '溯源记录不存在', 404);
    }
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const createOriginRecord = async (req, res) => {
  try {
    const record = await originRecordModel.create(req.body);
    successResponse(res, record, '产地记录创建成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const createProcessingRecord = async (req, res) => {
  try {
    const record = await processingRecordModel.create(req.body);
    successResponse(res, record, '加工记录创建成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const createTransportRecord = async (req, res) => {
  try {
    const record = await transportRecordModel.create(req.body);
    successResponse(res, record, '运输记录创建成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getFullTraceChain = async (req, res) => {
  try {
    const { batch_id } = req.params;
    
    const [traceRecords, originRecords, processingRecords, transportRecords] = await Promise.all([
      traceRecordModel.findByBatchId(batch_id),
      originRecordModel.findByBatchId(batch_id),
      processingRecordModel.findByBatchId(batch_id),
      transportRecordModel.findByBatchId(batch_id)
    ]);

    successResponse(res, {
      batch_id,
      trace_records: traceRecords,
      origin_records: originRecords,
      processing_records: processingRecords,
      transport_records: transportRecords,
      chain_length: traceRecords.length + originRecords.length + processingRecords.length + transportRecords.length
    }, '获取完整溯源链成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const batchExportTraceData = async (req, res) => {
  try {
    const { batch_ids, export_types = ['all'], start_date, end_date, format = 'json' } = req.body;

    if (!batch_ids || !Array.isArray(batch_ids) || batch_ids.length === 0) {
      return errorResponse(res, '请提供批次ID列表', 400);
    }

    if (batch_ids.length > 100) {
      return errorResponse(res, '单次最多导出100个批次', 400);
    }

    const exportPromises = batch_ids.map(async (batchId) => {
      const batchData = { batch_id: batchId, exported_at: new Date().toISOString() };

      const exportPromises = [];

      if (export_types.includes('all') || export_types.includes('trace')) {
        exportPromises.push(traceRecordModel.findByBatchId(batchId).then(data => ({ type: 'trace', data })));
      }
      if (export_types.includes('all') || export_types.includes('origin')) {
        exportPromises.push(originRecordModel.findByBatchId(batchId).then(data => ({ type: 'origin', data })));
      }
      if (export_types.includes('all') || export_types.includes('processing')) {
        exportPromises.push(processingRecordModel.findByBatchId(batchId).then(data => ({ type: 'processing', data })));
      }
      if (export_types.includes('all') || export_types.includes('transport')) {
        exportPromises.push(transportRecordModel.findByBatchId(batchId).then(data => ({ type: 'transport', data })));
      }

      const results = await Promise.all(exportPromises);

      results.forEach(({ type, data }) => {
        if (type === 'trace') batchData.trace_records = data;
        if (type === 'origin') batchData.origin_records = data;
        if (type === 'processing') batchData.processing_records = data;
        if (type === 'transport') batchData.transport_records = data;
      });

      return batchData;
    });

    const exportedData = await Promise.all(exportPromises);

    const summary = {
      total_batches: exportedData.length,
      export_types,
      export_format: format,
      total_records: exportedData.reduce((sum, batch) => {
        return sum + (batch.trace_records?.length || 0) + (batch.origin_records?.length || 0) +
                   (batch.processing_records?.length || 0) + (batch.transport_records?.length || 0);
      }, 0),
      generated_at: new Date().toISOString()
    };

    if (format === 'csv') {
      const csvContent = convertToCSV(exportedData);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="trace_export_${Date.now()}.csv"`);
      return res.send(csvContent);
    }

    successResponse(res, {
      summary,
      data: exportedData
    }, '批量导出成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const convertToCSV = (data) => {
  let csv = 'Batch ID,Record Type,Operation Time,Operator,Location,Description\n';
  
  data.forEach(batch => {
    const batchId = batch.batch_id;
    
    if (batch.trace_records) {
      batch.trace_records.forEach(record => {
        csv += `"${batchId}","Trace","${record.operation_time || ''}","${record.operator_name || ''}","${record.location || ''}","${(record.description || '').replace(/"/g, '""')}"\n`;
      });
    }
    
    if (batch.origin_records) {
      batch.origin_records.forEach(record => {
        csv += `"${batchId}","Origin","${record.harvest_date || ''}","-","${record.origin_city || ''}","Farmer: ${record.farmer_name || ''}"\n`;
      });
    }
    
    if (batch.processing_records) {
      batch.processing_records.forEach(record => {
        csv += `"${batchId}","Processing","${record.start_time || ''}","${record.operator_name || ''}","${record.workshop || ''}","Stage: ${record.process_stage || ''}"\n`;
      });
    }
    
    if (batch.transport_records) {
      batch.transport_records.forEach(record => {
        csv += `"${batchId}","Transport","${record.departure_time || ''}","${record.driver_name || ''}","${record.departure_location || ''} -> ${record.arrival_location || ''}","Vehicle: ${record.vehicle_number || ''}"\n`;
      });
    }
  });
  
  return csv;
};

const getExportTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: 'full_trace',
        name: '完整溯源模板',
        description: '包含产地、加工、运输、质检全流程数据',
        included_types: ['origin', 'processing', 'transport', 'quality'],
        supported_formats: ['json', 'csv', 'excel']
      },
      {
        id: 'origin_only',
        name: '产地溯源模板',
        description: '仅包含产地信息和种植数据',
        included_types: ['origin'],
        supported_formats: ['json', 'csv']
      },
      {
        id: 'processing_only',
        name: '加工流程模板',
        description: '仅包含加工过程和工艺参数',
        included_types: ['processing'],
        supported_formats: ['json', 'csv']
      },
      {
        id: 'quality_report',
        name: '质检报告模板',
        description: '包含所有质检和分级数据',
        included_types: ['quality'],
        supported_formats: ['json', 'pdf']
      }
    ];
    
    successResponse(res, templates, '获取导出模板成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

module.exports = {
  initModels,
  createTraceRecord,
  getTraceRecords,
  getTraceRecord,
  invalidateTraceRecord,
  createOriginRecord,
  createProcessingRecord,
  createTransportRecord,
  getFullTraceChain,
  batchExportTraceData,
  getExportTemplates
};
