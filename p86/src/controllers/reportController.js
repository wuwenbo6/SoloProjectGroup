const WoodcarvingCraft = require('../models/craft/WoodcarvingCraft');
const ProductionRecord = require('../models/production/ProductionRecord');
const Batch = require('../models/production/Batch');
const QualityInspection = require('../models/quality/QualityInspection');

const generateCSV = (data, columns) => {
  const header = columns.map(col => col.label).join(',');
  const rows = data.map(item => {
    return columns.map(col => {
      let value = item[col.key] || '';
      if (typeof value === 'string' && value.includes(',')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      if (value instanceof Date) {
        value = value.toISOString();
      }
      return value;
    }).join(',');
  });
  return [header, ...rows].join('\n');
};

const convertToJSON = (data) => {
  return JSON.stringify(data, null, 2);
};

const convertToHTML = (data, title) => {
  if (!data || data.length === 0) return `<html><body><h1>${title}</h1><p>无数据</p></body></html>`;

  const headers = Object.keys(data[0]);
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4CAF50; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        h1 { color: #333; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
      <table>
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${data.map(item => `
            <tr>${headers.map(h => `<td>${item[h] || ''}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
};

exports.exportCrafts = async (req, res) => {
  try {
    const { format = 'json', category, status, keyword } = req.query;

    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (keyword) {
      query.$or = [
        { craftName: { $regex: keyword, $options: 'i' } },
        { craftCode: { $regex: keyword, $options: 'i' } },
      ];
    }

    const crafts = await WoodcarvingCraft.find(query).sort({ createdAt: -1 });

    const exportData = crafts.map(craft => ({
      工艺编号: craft.craftCode,
      工艺名称: craft.craftName,
      工艺分类: craft.category,
      难度级别: craft.difficultyLevel,
      预计工期分钟: craft.estimatedDuration,
      状态: craft.status,
      创建时间: craft.createdAt,
      材料清单: craft.materials?.map(m => `${m.woodType}(${m.quantity}${m.unit})`).join('; ') || '',
      工具清单: craft.tools?.map(t => t.toolName).join('; ') || '',
      工序数量: craft.steps?.length || 0,
    }));

    let responseData;
    let contentType;
    let filename = `工艺数据报表_${Date.now()}`;

    switch (format.toLowerCase()) {
      case 'csv':
        responseData = generateCSV(exportData, [
          { key: '工艺编号', label: '工艺编号' },
          { key: '工艺名称', label: '工艺名称' },
          { key: '工艺分类', label: '工艺分类' },
          { key: '难度级别', label: '难度级别' },
          { key: '预计工期分钟', label: '预计工期分钟' },
          { key: '状态', label: '状态' },
          { key: '创建时间', label: '创建时间' },
          { key: '材料清单', label: '材料清单' },
          { key: '工具清单', label: '工具清单' },
          { key: '工序数量', label: '工序数量' },
        ]);
        contentType = 'text/csv; charset=utf-8';
        filename += '.csv';
        break;
      case 'html':
        responseData = convertToHTML(exportData, '木雕工艺数据报表');
        contentType = 'text/html; charset=utf-8';
        filename += '.html';
        break;
      default:
        responseData = convertToJSON({
          total: exportData.length,
          generatedAt: new Date().toISOString(),
          data: exportData,
        });
        contentType = 'application/json; charset=utf-8';
        filename += '.json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Cache-Control', 'no-cache');

    res.send(responseData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出工艺报表失败',
      error: error.message,
    });
  }
};

exports.exportProductionRecords = async (req, res) => {
  try {
    const { format = 'json', batchId, status, startDate, endDate } = req.query;

    const query = {};
    if (batchId) query.batchId = batchId;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const records = await ProductionRecord.find(query).sort({ createdAt: -1 });

    const exportData = records.map(record => ({
      记录编号: record.recordCode,
      批次ID: record.batchCode,
      工序编号: record.stepNumber,
      工序名称: record.stepName,
      操作员: record.operatorName,
      开始时间: record.startTime,
      结束时间: record.endTime,
      耗时分钟: record.duration,
      状态: record.status,
      温度: record.parameters?.temperature || '',
      湿度: record.parameters?.humidity || '',
      刀具压力: record.parameters?.toolPressure || '',
      雕刻深度: record.parameters?.carvingDepth || '',
      雕刻速度: record.parameters?.carvingSpeed || '',
      木材含水率: record.parameters?.woodMoisture || '',
      使用材料: record.materialsUsed?.map(m => `${m.materialType}(${m.quantity}${m.unit})`).join('; ') || '',
      使用工具: record.toolsUsed?.map(t => t.toolName).join('; ') || '',
      质检状态: record.qualityCheck?.passed ? '合格' : '不合格',
    }));

    let responseData;
    let contentType;
    let filename = `制作记录报表_${Date.now()}`;

    switch (format.toLowerCase()) {
      case 'csv':
        responseData = generateCSV(exportData, [
          { key: '记录编号', label: '记录编号' },
          { key: '批次ID', label: '批次ID' },
          { key: '工序编号', label: '工序编号' },
          { key: '工序名称', label: '工序名称' },
          { key: '操作员', label: '操作员' },
          { key: '开始时间', label: '开始时间' },
          { key: '结束时间', label: '结束时间' },
          { key: '耗时分钟', label: '耗时分钟' },
          { key: '状态', label: '状态' },
          { key: '温度', label: '温度' },
          { key: '湿度', label: '湿度' },
          { key: '刀具压力', label: '刀具压力' },
          { key: '雕刻深度', label: '雕刻深度' },
          { key: '雕刻速度', label: '雕刻速度' },
          { key: '木材含水率', label: '木材含水率' },
          { key: '使用材料', label: '使用材料' },
          { key: '使用工具', label: '使用工具' },
          { key: '质检状态', label: '质检状态' },
        ]);
        contentType = 'text/csv; charset=utf-8';
        filename += '.csv';
        break;
      case 'html':
        responseData = convertToHTML(exportData, '木雕制作记录报表');
        contentType = 'text/html; charset=utf-8';
        filename += '.html';
        break;
      default:
        responseData = convertToJSON({
          total: exportData.length,
          generatedAt: new Date().toISOString(),
          data: exportData,
        });
        contentType = 'application/json; charset=utf-8';
        filename += '.json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(responseData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出制作记录报表失败',
      error: error.message,
    });
  }
};

exports.exportQualityInspections = async (req, res) => {
  try {
    const { format = 'json', batchId, overallResult, inspectionType, startDate, endDate } = req.query;

    const query = {};
    if (batchId) query.batchId = batchId;
    if (overallResult) query.overallResult = overallResult;
    if (inspectionType) query.inspectionType = inspectionType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const inspections = await QualityInspection.find(query).sort({ createdAt: -1 });

    const exportData = inspections.map(inspection => ({
      检测编号: inspection.inspectionCode,
      批次ID: inspection.batchCode,
      检测类型: inspection.inspectionType,
      检测员: inspection.inspectorName,
      检测时间: inspection.inspectionTime,
      总体结果: inspection.overallResult,
      状态: inspection.status,
      检测项数量: inspection.items?.length || 0,
      合格项数: inspection.items?.filter(i => i.result === '合格').length || 0,
      缺陷数量: inspection.defects?.length || 0,
      第三方机构: inspection.thirdPartyInfo?.organizationName || '',
      第三方报告号: inspection.thirdPartyInfo?.reportNumber || '',
    }));

    let responseData;
    let contentType;
    let filename = `品质检测报表_${Date.now()}`;

    switch (format.toLowerCase()) {
      case 'csv':
        responseData = generateCSV(exportData, [
          { key: '检测编号', label: '检测编号' },
          { key: '批次ID', label: '批次ID' },
          { key: '检测类型', label: '检测类型' },
          { key: '检测员', label: '检测员' },
          { key: '检测时间', label: '检测时间' },
          { key: '总体结果', label: '总体结果' },
          { key: '状态', label: '状态' },
          { key: '检测项数量', label: '检测项数量' },
          { key: '合格项数', label: '合格项数' },
          { key: '缺陷数量', label: '缺陷数量' },
          { key: '第三方机构', label: '第三方机构' },
          { key: '第三方报告号', label: '第三方报告号' },
        ]);
        contentType = 'text/csv; charset=utf-8';
        filename += '.csv';
        break;
      case 'html':
        responseData = convertToHTML(exportData, '品质检测报表');
        contentType = 'text/html; charset=utf-8';
        filename += '.html';
        break;
      default:
        responseData = convertToJSON({
          total: exportData.length,
          generatedAt: new Date().toISOString(),
          data: exportData,
        });
        contentType = 'application/json; charset=utf-8';
        filename += '.json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(responseData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出品质检测报表失败',
      error: error.message,
    });
  }
};

exports.exportBatchSummary = async (req, res) => {
  try {
    const { format = 'json', status, workshop, startDate, endDate } = req.query;

    const query = {};
    if (status) query.status = status;
    if (workshop) query.workshop = workshop;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const batches = await Batch.find(query).sort({ createdAt: -1 });

    const batchIds = batches.map(b => b._id);

    const recordCounts = await ProductionRecord.aggregate([
      { $match: { batchId: { $in: batchIds } } },
      { $group: { _id: '$batchId', count: { $sum: 1 } } },
    ]);

    const qualityCounts = await QualityInspection.aggregate([
      { $match: { batchId: { $in: batchIds } } },
      { $group: { _id: '$batchId', count: { $sum: 1 }, passCount: { $sum: { $cond: [{ $eq: ['$overallResult', '合格'] }, 1, 0] } } } },
    ]);

    const exportData = batches.map(batch => {
      const recordCount = recordCounts.find(r => r._id.toString() === batch._id.toString())?.count || 0;
      const qualityData = qualityCounts.find(q => q._id.toString() === batch._id.toString());
      const inspectionCount = qualityData?.count || 0;
      const passCount = qualityData?.passCount || 0;
      const passRate = inspectionCount > 0 ? ((passCount / inspectionCount) * 100).toFixed(2) + '%' : '-';

      return {
        批次编号: batch.batchCode,
        工艺名称: batch.craftName,
        车间: batch.workshop,
        数量: batch.quantity,
        状态: batch.status,
        进度: `${batch.progress || 0}%`,
        开始时间: batch.startDate,
        预计结束: batch.estimatedEndDate,
        实际结束: batch.actualEndDate || '-',
        制作记录数: recordCount,
        检测次数: inspectionCount,
        合格率: passRate,
      };
    });

    let responseData;
    let contentType;
    let filename = `批次汇总报表_${Date.now()}`;

    switch (format.toLowerCase()) {
      case 'csv':
        responseData = generateCSV(exportData, [
          { key: '批次编号', label: '批次编号' },
          { key: '工艺名称', label: '工艺名称' },
          { key: '车间', label: '车间' },
          { key: '数量', label: '数量' },
          { key: '状态', label: '状态' },
          { key: '进度', label: '进度' },
          { key: '开始时间', label: '开始时间' },
          { key: '预计结束', label: '预计结束' },
          { key: '实际结束', label: '实际结束' },
          { key: '制作记录数', label: '制作记录数' },
          { key: '检测次数', label: '检测次数' },
          { key: '合格率', label: '合格率' },
        ]);
        contentType = 'text/csv; charset=utf-8';
        filename += '.csv';
        break;
      case 'html':
        responseData = convertToHTML(exportData, '批次汇总报表');
        contentType = 'text/html; charset=utf-8';
        filename += '.html';
        break;
      default:
        responseData = convertToJSON({
          total: exportData.length,
          generatedAt: new Date().toISOString(),
          data: exportData,
        });
        contentType = 'application/json; charset=utf-8';
        filename += '.json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(responseData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出批次汇总报表失败',
      error: error.message,
    });
  }
};

exports.getExportTemplates = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: [
        {
          id: 'crafts',
          name: '工艺数据报表',
          description: '导出木雕工艺的详细信息，包括材料、工具、工序等',
          supportedFormats: ['json', 'csv', 'html'],
          filterParams: ['category', 'status', 'keyword'],
        },
        {
          id: 'production',
          name: '制作记录报表',
          description: '导出制作过程的详细记录，包括参数、材料、工具等',
          supportedFormats: ['json', 'csv', 'html'],
          filterParams: ['batchId', 'status', 'startDate', 'endDate'],
        },
        {
          id: 'quality',
          name: '品质检测报表',
          description: '导出品质检测的详细信息，包括检测项、缺陷等',
          supportedFormats: ['json', 'csv', 'html'],
          filterParams: ['batchId', 'overallResult', 'inspectionType', 'startDate', 'endDate'],
        },
        {
          id: 'batch',
          name: '批次汇总报表',
          description: '导出批次的汇总信息，包括进度、合格率等统计',
          supportedFormats: ['json', 'csv', 'html'],
          filterParams: ['status', 'workshop', 'startDate', 'endDate'],
        },
      ],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取导出模板失败',
      error: error.message,
    });
  }
};
