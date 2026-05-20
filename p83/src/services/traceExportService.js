const TraceRecord = require('../models/trace/TraceRecord');
const Material = require('../models/material/Material');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const archiver = require('archiver');

class TraceExportService {
  constructor() {
    this.exportFormats = ['json', 'excel', 'csv', 'pdf'];
  }

  async buildQuery(filters = {}) {
    const {
      materialId,
      batchId,
      stage,
      status,
      startDate,
      endDate,
      operatorId,
      equipmentId,
      search,
      materialTypes,
      origins
    } = filters;

    const query = {};

    if (materialId) {
      query.materialId = materialId;
    }

    if (batchId) {
      query.batchId = batchId;
    }

    if (stage) {
      query.stage = Array.isArray(stage) ? { $in: stage } : stage;
    }

    if (status) {
      query.status = Array.isArray(status) ? { $in: status } : status;
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

    if (operatorId) {
      query['operator.operatorId'] = operatorId;
    }

    if (equipmentId) {
      query['equipment.equipmentId'] = equipmentId;
    }

    if (search) {
      query.$or = [
        { traceId: { $regex: search, $options: 'i' } },
        { materialId: { $regex: search, $options: 'i' } },
        { batchId: { $regex: search, $options: 'i' } },
        { 'operator.name': { $regex: search, $options: 'i' } },
        { 'equipment.name': { $regex: search, $options: 'i' } }
      ];
    }

    return query;
  }

  async fetchTraceRecords(filters = {}, options = {}) {
    const query = await this.buildQuery(filters);
    
    const sort = options.sort || { timestamp: -1 };
    const limit = options.limit ? parseInt(options.limit) : 0;
    const skip = options.skip ? parseInt(options.skip) : 0;

    let recordsQuery = TraceRecord.find(query).sort(sort);
    
    if (limit > 0) {
      recordsQuery = recordsQuery.skip(skip).limit(limit);
    }

    const records = await recordsQuery;
    
    const materialIds = [...new Set(records.map(r => r.materialId).filter(Boolean))];
    const materials = await Material.find({ materialId: { $in: materialIds } });
    const materialMap = new Map(materials.map(m => [m.materialId, m]));

    return {
      records,
      materialMap,
      total: records.length
    };
  }

  buildTraceChain(records, materialMap) {
    const chainMap = new Map();
    const roots = [];

    records.forEach(record => {
      chainMap.set(record.traceId, {
        ...record.toObject(),
        material: materialMap.get(record.materialId) || null,
        next: [],
        children: []
      });
    });

    chainMap.forEach((node, traceId) => {
      if (node.previousTraceId && chainMap.has(node.previousTraceId)) {
        chainMap.get(node.previousTraceId).next.push(node);
        chainMap.get(node.previousTraceId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  async exportToJSON(filters = {}, options = {}) {
    const { records, materialMap, total } = await this.fetchTraceRecords(filters, options);
    
    const chains = this.buildTraceChain(records, materialMap);
    
    const exportData = {
      exportInfo: {
        exportTime: new Date().toISOString(),
        format: 'json',
        totalRecords: total,
        filters
      },
      summary: this.generateSummary(records, materialMap),
      traceChains: chains,
      rawRecords: options.includeRaw ? records : undefined
    };

    return {
      contentType: 'application/json',
      filename: `trace_export_${Date.now()}.json`,
      data: JSON.stringify(exportData, null, 2)
    };
  }

  async exportToCSV(filters = {}, options = {}) {
    const { records, materialMap, total } = await this.fetchTraceRecords(filters, options);

    const headers = [
      '溯源ID',
      '材质ID',
      '材质名称',
      '批次ID',
      '阶段',
      '状态',
      '时间戳',
      '操作员ID',
      '操作员姓名',
      '设备ID',
      '设备名称',
      '操作描述',
      '上一溯源ID',
      '下一溯源IDs',
      '创建时间',
      '更新时间'
    ];

    const rows = records.map(record => {
      const material = materialMap.get(record.materialId);
      return [
        record.traceId,
        record.materialId,
        material?.name || '',
        record.batchId || '',
        record.stage || '',
        record.status || '',
        record.timestamp ? record.timestamp.toISOString() : '',
        record.operator?.operatorId || '',
        record.operator?.name || '',
        record.equipment?.equipmentId || '',
        record.equipment?.name || '',
        record.actions?.map(a => a.description || '').join('; ') || '',
        record.previousTraceId || '',
        (record.nextTraceIds || []).join(', '),
        record.createdAt ? record.createdAt.toISOString() : '',
        record.updatedAt ? record.updatedAt.toISOString() : ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `trace_export_${Date.now()}.csv`,
      data: '\ufeff' + csvContent
    };
  }

  async exportToExcel(filters = {}, options = {}) {
    const { records, materialMap, total } = await this.fetchTraceRecords(filters, options);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '传统乐器材质溯源系统';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('汇总');
    const summary = this.generateSummary(records, materialMap);
    
    summarySheet.addRow(['导出汇总报告']);
    summarySheet.addRow([]);
    summarySheet.addRow(['导出时间', new Date().toISOString()]);
    summarySheet.addRow(['记录总数', total]);
    summarySheet.addRow([]);
    
    summarySheet.addRow(['按阶段统计']);
    Object.entries(summary.byStage).forEach(([stage, count]) => {
      summarySheet.addRow([stage, count]);
    });
    summarySheet.addRow([]);
    
    summarySheet.addRow(['按状态统计']);
    Object.entries(summary.byStatus).forEach(([status, count]) => {
      summarySheet.addRow([status, count]);
    });
    summarySheet.addRow([]);
    
    summarySheet.addRow(['按材质类型统计']);
    Object.entries(summary.byMaterialType).forEach(([type, count]) => {
      summarySheet.addRow([type, count]);
    });

    const detailSheet = workbook.addWorksheet('溯源明细');
    detailSheet.columns = [
      { header: '溯源ID', key: 'traceId', width: 36 },
      { header: '材质ID', key: 'materialId', width: 36 },
      { header: '材质名称', key: 'materialName', width: 20 },
      { header: '批次ID', key: 'batchId', width: 36 },
      { header: '阶段', key: 'stage', width: 15 },
      { header: '状态', key: 'status', width: 12 },
      { header: '时间戳', key: 'timestamp', width: 25 },
      { header: '操作员', key: 'operator', width: 15 },
      { header: '设备', key: 'equipment', width: 20 },
      { header: '操作描述', key: 'description', width: 50 },
      { header: '创建时间', key: 'createdAt', width: 25 }
    ];

    records.forEach(record => {
      const material = materialMap.get(record.materialId);
      detailSheet.addRow({
        traceId: record.traceId,
        materialId: record.materialId,
        materialName: material?.name || '',
        batchId: record.batchId || '',
        stage: this.getStageName(record.stage),
        status: this.getStatusName(record.status),
        timestamp: record.timestamp ? record.timestamp.toISOString() : '',
        operator: record.operator?.name || '',
        equipment: record.equipment?.name || '',
        description: record.actions?.map(a => a.description || '').join('; ') || '',
        createdAt: record.createdAt ? record.createdAt.toISOString() : ''
      });
    });

    detailSheet.getRow(1).font = { bold: true };
    detailSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    const buffer = await workbook.xlsx.writeBuffer();

    return {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `trace_export_${Date.now()}.xlsx`,
      data: buffer
    };
  }

  async exportToPDF(filters = {}, options = {}) {
    const { records, materialMap, total } = await this.fetchTraceRecords(filters, options);
    const summary = this.generateSummary(records, materialMap);

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: '溯源数据导出报告',
        Author: '传统乐器材质溯源系统',
        Creator: '溯源系统导出工具'
      }
    });

    const stream = new PassThrough();
    doc.pipe(stream);

    doc.fontSize(20).text('溯源数据导出报告', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`导出时间: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.text(`记录总数: ${total}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text('一、统计汇总', { underline: true });
    doc.moveDown();

    doc.fontSize(10).text('按阶段统计:');
    Object.entries(summary.byStage).forEach(([stage, count]) => {
      doc.text(`  ${this.getStageName(stage)}: ${count}条`);
    });
    doc.moveDown();

    doc.text('按状态统计:');
    Object.entries(summary.byStatus).forEach(([status, count]) => {
      doc.text(`  ${this.getStatusName(status)}: ${count}条`);
    });
    doc.moveDown();

    doc.text('按材质类型统计:');
    Object.entries(summary.byMaterialType).forEach(([type, count]) => {
      doc.text(`  ${type}: ${count}条`);
    });
    doc.moveDown();

    doc.fontSize(14).text('二、溯源明细', { underline: true });
    doc.moveDown();

    const tableTop = doc.y;
    const colWidths = [120, 100, 80, 150];
    const headers = ['溯源ID', '材质名称', '阶段', '操作描述'];

    doc.fontSize(8).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop);
    });

    let y = tableTop + 20;
    doc.font('Helvetica');

    records.forEach((record, index) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      const material = materialMap.get(record.materialId);
      const x = 50;

      doc.fontSize(7);
      doc.text(record.traceId || '', x, y, { width: colWidths[0], ellipsis: true });
      doc.text(material?.name || '', x + colWidths[0], y, { width: colWidths[1], ellipsis: true });
      doc.text(this.getStageName(record.stage), x + colWidths[0] + colWidths[1], y, { width: colWidths[2], ellipsis: true });
      doc.text(record.actions?.map(a => a.description || '').join('; ') || '', 
        x + colWidths[0] + colWidths[1] + colWidths[2], y, { width: colWidths[3], ellipsis: true });
      
      y += 15;
    });

    doc.end();

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return {
      contentType: 'application/pdf',
      filename: `trace_export_${Date.now()}.pdf`,
      data: buffer
    };
  }

  async exportTraceChain(materialId, format = 'json') {
    const records = await TraceRecord.find({ materialId }).sort({ timestamp: 1 });
    
    if (records.length === 0) {
      throw new Error('该材质暂无溯源记录');
    }

    const materials = await Material.find({ materialId });
    const materialMap = new Map(materials.map(m => [m.materialId, m]));
    
    const chain = this.buildTraceChain(records, materialMap);

    if (format === 'json') {
      return {
        contentType: 'application/json',
        filename: `trace_chain_${materialId}_${Date.now()}.json`,
        data: JSON.stringify({
          materialId,
          materialName: materials[0]?.name || '',
          totalStages: records.length,
          chain,
          exportTime: new Date().toISOString()
        }, null, 2)
      };
    }

    if (format === 'csv') {
      const headers = ['节点序号', '溯源ID', '阶段', '状态', '时间戳', '操作员', '设备', '描述', '父节点ID', '子节点数量'];
      const rows = [];
      
      const flattenChain = (nodes, level = 1, parentId = null) => {
        nodes.forEach(node => {
          rows.push([
            level,
            node.traceId,
            this.getStageName(node.stage),
            this.getStatusName(node.status),
            node.timestamp ? node.timestamp.toISOString() : '',
            node.operator?.name || '',
            node.equipment?.name || '',
            node.actions?.map(a => a.description || '').join('; ') || '',
            parentId || '',
            node.children?.length || 0
          ]);
          
          if (node.children && node.children.length > 0) {
            flattenChain(node.children, level + 1, node.traceId);
          }
        });
      };
      
      flattenChain(chain);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      return {
        contentType: 'text/csv; charset=utf-8',
        filename: `trace_chain_${materialId}_${Date.now()}.csv`,
        data: '\ufeff' + csvContent
      };
    }

    throw new Error(`不支持的格式: ${format}`);
  }

  generateSummary(records, materialMap) {
    const byStage = {};
    const byStatus = {};
    const byMaterialType = {};
    const byOperator = {};
    const byOrigin = {};

    records.forEach(record => {
      byStage[record.stage] = (byStage[record.stage] || 0) + 1;
      byStatus[record.status] = (byStatus[record.status] || 0) + 1;
      
      const material = materialMap.get(record.materialId);
      if (material) {
        byMaterialType[material.type] = (byMaterialType[material.type] || 0) + 1;
        if (material.origin?.country) {
          byOrigin[material.origin.country] = (byOrigin[material.origin.country] || 0) + 1;
        }
      }
      
      if (record.operator?.name) {
        byOperator[record.operator.name] = (byOperator[record.operator.name] || 0) + 1;
      }
    });

    return {
      totalRecords: records.length,
      byStage,
      byStatus,
      byMaterialType,
      byOperator,
      byOrigin,
      dateRange: records.length > 0 ? {
        start: records[records.length - 1]?.timestamp,
        end: records[0]?.timestamp
      } : null
    };
  }

  getStageName(stage) {
    const stageMap = {
      harvest: '原料采集',
      transport: '运输',
      storage: '仓储',
      processing: '加工',
      manufacturing: '制造',
      quality_check: '质量检测',
      distribution: '分销',
      retail: '零售'
    };
    return stageMap[stage] || stage || '未知';
  }

  getStatusName(status) {
    const statusMap = {
      pending: '待处理',
      completed: '已完成',
      verified: '已验证',
      rejected: '已拒绝'
    };
    return statusMap[status] || status || '未知';
  }
}

module.exports = new TraceExportService();
