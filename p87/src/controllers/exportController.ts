import { Request, Response } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import CraftProcess from '../models/process/CraftProcess';
import Batch from '../models/process/Batch';
import ProductionRecord from '../models/trace/ProductionRecord';
import QualityInspection from '../models/quality/QualityInspection';
import ThirdPartyReport from '../models/quality/ThirdPartyReport';

const formatDate = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

const formatDateTime = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().replace('T', ' ').substring(0, 19);
};

const generateCSV = (headers: string[], rows: any[][]): string => {
  const headerRow = headers.map(h => `"${h}"`).join(',');
  const dataRows = rows.map(row =>
    row.map(cell => {
      if (cell === null || cell === undefined) return '""';
      const str = String(cell).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
};

const generateSimpleHTML = (title: string, headers: string[], rows: any[][]): string => {
  const headerHTML = headers.map(h => `<th>${h}</th>`).join('');
  const rowsHTML = rows.map(row =>
    `<tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>`
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4CAF50; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .summary { margin: 20px 0; padding: 15px; background: #e8f5e9; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="summary">
        <p><strong>导出时间:</strong> ${formatDateTime(new Date())}</p>
        <p><strong>数据总数:</strong> ${rows.length} 条</p>
    </div>
    <table>
        <thead><tr>${headerHTML}</tr></thead>
        <tbody>${rowsHTML}</tbody>
    </table>
</body>
</html>
  `;
};

export const exportCraftProcesses = async (req: Request, res: Response) => {
  try {
    const schema = Joi.object({
      format: Joi.string().valid('json', 'csv', 'html').default('json'),
      craftType: Joi.string().optional(),
      status: Joi.string().valid('draft', 'active', 'deprecated').optional(),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const { format, craftType, status, startDate, endDate } = value;
    const where: any = {};

    if (craftType) where.craftType = craftType;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const crafts = await CraftProcess.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    const fileName = `craft_processes_${formatDate(new Date())}`;

    switch (format) {
      case 'json': {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.json"`);
        return res.send(JSON.stringify(crafts, null, 2));
      }

      case 'csv': {
        const headers = ['工艺ID', '工艺名称', '工艺类型', '状态', '工匠ID', '工匠名称', '版本', '创建时间', '更新时间'];
        const rows = crafts.map(craft => [
          craft.craftId,
          craft.craftName,
          craft.craftType,
          craft.status,
          craft.artisanId,
          craft.artisanName,
          craft.version,
          formatDateTime(craft.createdAt),
          formatDateTime(craft.updatedAt)
        ]);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
        res.write('\uFEFF');
        return res.send(generateCSV(headers, rows));
      }

      case 'html': {
        const headers = ['工艺ID', '工艺名称', '工艺类型', '状态', '工匠ID', '工匠名称', '版本', '创建时间'];
        const rows = crafts.map(craft => [
          craft.craftId,
          craft.craftName,
          craft.craftType,
          craft.status,
          craft.artisanId,
          craft.artisanName,
          craft.version,
          formatDateTime(craft.createdAt)
        ]);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(generateSimpleHTML('漆器工艺报表', headers, rows));
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出工艺数据失败',
      error: (error as Error).message
    });
  }
};

export const exportBatchProduction = async (req: Request, res: Response) => {
  try {
    const schema = Joi.object({
      format: Joi.string().valid('json', 'csv', 'html').default('json'),
      batchId: Joi.string().optional(),
      status: Joi.string().valid('pending', 'in_progress', 'completed', 'suspended').optional(),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const { format, batchId, status, startDate, endDate } = value;
    const where: any = {};

    if (batchId) where.batchId = batchId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate[Op.gte] = new Date(startDate);
      if (endDate) where.startDate[Op.lte] = new Date(endDate);
    }

    const batches = await Batch.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    const batchIds = batches.map(b => b.batchId);
    const productionRecords = await ProductionRecord.findAll({
      where: { batchId: { [Op.in]: batchIds } }
    });
    const qualityInspections = await QualityInspection.findAll({
      where: { batchId: { [Op.in]: batchIds } }
    });

    const enrichedBatches = batches.map(batch => {
      const records = productionRecords.filter(pr => pr.batchId === batch.batchId);
      const inspections = qualityInspections.filter(qi => qi.batchId === batch.batchId);
      const passedInspections = inspections.filter(qi => qi.overallResult === 'pass');

      return {
        ...batch.toJSON(),
        productionSteps: records.length,
        completedSteps: records.filter(r => r.status === 'completed').length,
        inspectionCount: inspections.length,
        passRate: inspections.length > 0 ? `${((passedInspections.length / inspections.length) * 100).toFixed(1)}%` : 'N/A'
      };
    });

    const fileName = `batch_production_${formatDate(new Date())}`;

    switch (format) {
      case 'json': {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.json"`);
        return res.send(JSON.stringify(enrichedBatches, null, 2));
      }

      case 'csv': {
        const headers = ['批次ID', '批次名称', '工艺ID', '数量', '状态', '车间', '主管', '生产工序', '已完成工序', '检测次数', '合格率', '开始时间', '结束时间'];
        const rows = enrichedBatches.map((batch: any) => [
          batch.batchId,
          batch.batchName || '',
          batch.craftId,
          batch.quantity,
          batch.status,
          batch.workshopName,
          batch.supervisorName,
          batch.productionSteps,
          batch.completedSteps,
          batch.inspectionCount,
          batch.passRate,
          formatDate(batch.startDate),
          formatDate(batch.actualEndDate)
        ]);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
        res.write('\uFEFF');
        return res.send(generateCSV(headers, rows));
      }

      case 'html': {
        const headers = ['批次ID', '批次名称', '数量', '状态', '车间', '主管', '生产工序', '合格率', '开始时间'];
        const rows = enrichedBatches.map((batch: any) => [
          batch.batchId,
          batch.batchName || '',
          batch.quantity,
          batch.status,
          batch.workshopName,
          batch.supervisorName,
          `${batch.completedSteps}/${batch.productionSteps}`,
          batch.passRate,
          formatDate(batch.startDate)
        ]);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(generateSimpleHTML('批次生产报表', headers, rows));
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出批次生产数据失败',
      error: (error as Error).message
    });
  }
};

export const exportQualityReport = async (req: Request, res: Response) => {
  try {
    const schema = Joi.object({
      format: Joi.string().valid('json', 'csv', 'html').default('json'),
      batchId: Joi.string().optional(),
      inspectionType: Joi.string().valid('in_process', 'final', 'sampling', 'third_party').optional(),
      overallResult: Joi.string().valid('pass', 'fail', 'pending').optional(),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const { format, batchId, inspectionType, overallResult, startDate, endDate } = value;
    const where: any = {};

    if (batchId) where.batchId = batchId;
    if (inspectionType) where.inspectionType = inspectionType;
    if (overallResult) where.overallResult = overallResult;
    if (startDate || endDate) {
      where.inspectionDate = {};
      if (startDate) where.inspectionDate[Op.gte] = new Date(startDate);
      if (endDate) where.inspectionDate[Op.lte] = new Date(endDate);
    }

    const inspections = await QualityInspection.findAll({
      where,
      order: [['inspectionDate', 'DESC']]
    });

    const thirdPartyReports = await ThirdPartyReport.findAll({
      where: { syncStatus: 'success' }
    });

    const fileName = `quality_report_${formatDate(new Date())}`;

    switch (format) {
      case 'json': {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.json"`);
        return res.send(JSON.stringify({ inspections, thirdPartyReports }, null, 2));
      }

      case 'csv': {
        const headers = ['检测ID', '批次ID', '检测类型', '检测员', '检测日期', '总体结果', '检测项数', '备注'];
        const rows = inspections.map(inspection => [
          inspection.inspectionId,
          inspection.batchId,
          inspection.inspectionType,
          inspection.inspectorName,
          formatDate(inspection.inspectionDate),
          inspection.overallResult,
          Array.isArray(inspection.items) ? inspection.items.length : 0,
          inspection.remark || ''
        ]);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
        res.write('\uFEFF');
        return res.send(generateCSV(headers, rows));
      }

      case 'html': {
        const headers = ['检测ID', '批次ID', '检测类型', '检测员', '检测日期', '总体结果', '备注'];
        const rows = inspections.map(inspection => [
          inspection.inspectionId,
          inspection.batchId,
          inspection.inspectionType,
          inspection.inspectorName,
          formatDate(inspection.inspectionDate),
          inspection.overallResult,
          inspection.remark || ''
        ]);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(generateSimpleHTML('品质检测报表', headers, rows));
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出品质报告失败',
      error: (error as Error).message
    });
  }
};

export const exportFullTraceability = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findOne({ where: { batchId } });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    const craft = await CraftProcess.findOne({ where: { craftId: batch.craftId } });
    const productionRecords = await ProductionRecord.findAll({
      where: { batchId },
      order: [['stepNumber', 'ASC']]
    });
    const qualityInspections = await QualityInspection.findAll({ where: { batchId } });
    const thirdPartyReports = await ThirdPartyReport.findAll({ where: { batchId } });

    const traceabilityData = {
      batch: batch.toJSON(),
      craft: craft?.toJSON() || null,
      productionRecords: productionRecords.map(pr => pr.toJSON()),
      qualityInspections: qualityInspections.map(qi => qi.toJSON()),
      thirdPartyReports: thirdPartyReports.map(tpr => tpr.toJSON()),
      exportTime: new Date().toISOString()
    };

    const fileName = `traceability_${batchId}_${formatDate(new Date())}`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.json"`);
    res.send(JSON.stringify(traceabilityData, null, 2));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出溯源数据失败',
      error: (error as Error).message
    });
  }
};
