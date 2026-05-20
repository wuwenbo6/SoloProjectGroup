import { Request, Response } from 'express';
import Joi from 'joi';
import axios, { AxiosError } from 'axios';
import { Transaction } from 'sequelize';
import ThirdPartyReport from '../models/quality/ThirdPartyReport';
import Batch from '../models/process/Batch';
import CraftProcess from '../models/process/CraftProcess';
import ProductionRecord from '../models/trace/ProductionRecord';
import QualityInspection from '../models/quality/QualityInspection';
import Material from '../models/trace/Material';
import { qualityDB } from '../config/databases';
import { generateQualityTraceCode } from '../utils/traceCodeGenerator';
import logger from '../config/logger';

interface FieldMapping {
  [key: string]: string | string[];
}

const fieldMappings: FieldMapping = {
  reportNo: 'reportNumber',
  report_code: 'reportNumber',
  inspection_report_no: 'reportNumber',
  reportDate: ['reportDate', 'inspectionDate'],
  test_date: 'reportDate',
  inspectionItems: 'testItems',
  test_items: 'testItems',
  inspection_items: 'testItems',
  testResult: 'result',
  test_result: 'result',
  passStatus: 'isPass',
  pass_status: 'isPass',
  is_passed: 'isPass',
  inspector: 'inspectorName',
  inspector_name: 'inspectorName',
  reviewer: 'reviewerName',
  reviewer_name: 'reviewerName',
  conclusionResult: 'conclusion',
  finalConclusion: 'conclusion',
  batch_no: 'batchId',
  batchNumber: 'batchId',
  agencyCode: 'agencyId',
  agency_name: 'agencyName',
  report_url: 'reportUrl',
  pdf_url: 'reportPdf'
};

const normalizeFields = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const normalized: any = {};

  for (const [key, value] of Object.entries(data)) {
    const mappedKey = fieldMappings[key] || key;

    if (Array.isArray(mappedKey)) {
      for (const k of mappedKey) {
        normalized[k] = value;
      }
    } else {
      normalized[mappedKey] = value;
    }
  }

  if (normalized.testItems && Array.isArray(normalized.testItems)) {
    normalized.testItems = normalized.testItems.map((item: any) => normalizeFields(item));
  }

  return normalized;
};

const mapTestItems = (items: any[]): any[] => {
  if (!items || !Array.isArray(items)) {
    return [];
  }

  return items.map((item: any) => {
    const normalized = normalizeFields(item);
    return {
      itemName: normalized.itemName || normalized.name || '',
      testMethod: normalized.testMethod || normalized.method || '',
      standard: normalized.standard || normalized.standardValue || '',
      result: normalized.result || normalized.testResult || '',
      unit: normalized.unit || '',
      isPass: typeof normalized.isPass === 'boolean'
        ? normalized.isPass
        : ['pass', 'passed', '合格', 'PASS', 'true'].includes(String(normalized.isPass || normalized.result).toLowerCase())
    };
  });
};

const determineConclusion = (conclusion: string | undefined, items: any[]): 'qualified' | 'unqualified' | 'conditional' => {
  if (conclusion) {
    const lowerConclusion = String(conclusion).toLowerCase();
    if (['qualified', 'pass', '合格', '通过', 'success'].includes(lowerConclusion)) {
      return 'qualified';
    }
    if (['unqualified', 'fail', '不合格', '不通过'].includes(lowerConclusion)) {
      return 'unqualified';
    }
  }

  if (items && items.length > 0) {
    const allPass = items.every((item: any) => item.isPass === true);
    const someFail = items.some((item: any) => item.isPass === false);
    if (allPass) return 'qualified';
    if (someFail) return 'unqualified';
  }

  return 'conditional';
};

const syncReportSchema = Joi.object({
  batchId: Joi.string().required(),
  agencyId: Joi.string().required(),
  agencyName: Joi.string().optional(),
  reportNumber: Joi.string().optional(),
  reportDate: Joi.date().optional(),
  reportUrl: Joi.string().uri().optional(),
  reportPdf: Joi.string().optional(),
  testItems: Joi.array().optional(),
  conclusion: Joi.string().valid('qualified', 'unqualified', 'conditional').optional(),
  inspectorName: Joi.string().optional(),
  reviewerName: Joi.string().optional()
});

export const syncThirdPartyReport = async (req: Request, res: Response) => {
  const transaction = await qualityDB.transaction();

  try {
    const { error, value } = syncReportSchema.validate(req.body);
    if (error) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const { batchId, agencyId } = value;
    const apiUrl = process.env.THIRD_PARTY_API_URL;
    const apiKey = process.env.THIRD_PARTY_API_KEY;

    if (!apiUrl || !apiKey) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: '第三方检测机构API配置缺失'
      });
    }

    let pendingReport = await ThirdPartyReport.findOne({
      where: {
        batchId,
        agencyId,
        syncStatus: 'pending'
      },
      transaction
    });

    if (!pendingReport) {
      const reportId = `TPR${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
      const traceCode = await generateQualityTraceCode(async (code: string) => {
        const exists = await ThirdPartyReport.findOne({
          where: { traceCode: code },
          transaction
        });
        return !!exists;
      });

      pendingReport = await ThirdPartyReport.create({
        reportId,
        traceCode,
        batchId,
        agencyId,
        agencyName: value.agencyName || '第三方检测机构',
        reportNumber: value.reportNumber || `REP${Date.now()}`,
        reportDate: value.reportDate || new Date(),
        testItems: [],
        conclusion: 'conditional',
        syncStatus: 'pending'
      }, { transaction });
    }

    try {
      const response = await axios.post(
        `${apiUrl}/api/reports/sync`,
        { batchId, agencyId },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const rawData = response.data;
      logger.info('第三方检测机构原始响应', { rawData });

      const normalizedData = normalizeFields(rawData);
      logger.info('字段标准化后数据', { normalizedData });

      const mappedTestItems = mapTestItems(normalizedData.testItems || value.testItems || []);
      const conclusion = determineConclusion(normalizedData.conclusion || value.conclusion, mappedTestItems);

      const updateData: any = {
        reportNumber: normalizedData.reportNumber || pendingReport.reportNumber,
        reportDate: normalizedData.reportDate ? new Date(normalizedData.reportDate) : pendingReport.reportDate,
        testItems: mappedTestItems,
        conclusion,
        inspectorName: normalizedData.inspectorName || value.inspectorName,
        reviewerName: normalizedData.reviewerName || value.reviewerName,
        reportUrl: normalizedData.reportUrl || value.reportUrl,
        reportPdf: normalizedData.reportPdf || value.reportPdf,
        syncedAt: new Date(),
        syncStatus: 'success'
      };

      await pendingReport.update(updateData, { transaction });
      await transaction.commit();

      res.json({
        success: true,
        message: '第三方检测报告同步成功',
        data: pendingReport
      });
    } catch (apiError: unknown) {
      await transaction.rollback();

      let errorMessage = '未知错误';
      if (apiError instanceof AxiosError) {
        errorMessage = apiError.response?.data?.message || apiError.message || 'API请求失败';
        logger.error('第三方检测API调用失败', {
          error: errorMessage,
          status: apiError.response?.status,
          data: apiError.response?.data
        });
      } else if (apiError instanceof Error) {
        errorMessage = apiError.message;
      }

      await pendingReport.update({
        syncStatus: 'failed',
        syncedAt: new Date()
      });

      res.status(500).json({
        success: false,
        message: '第三方检测API同步失败',
        error: errorMessage
      });
    }
  } catch (error) {
    logger.error('同步第三方检测报告异常', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: '同步第三方检测报告失败',
      error: (error as Error).message
    });
  }
};

export const getThirdPartyReportList = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      batchId,
      agencyId,
      syncStatus,
      conclusion,
      startDate,
      endDate
    } = req.query;

    const where: any = {};

    if (batchId) where.batchId = batchId;
    if (agencyId) where.agencyId = agencyId;
    if (syncStatus) where.syncStatus = syncStatus;
    if (conclusion) where.conclusion = conclusion;

    if (startDate || endDate) {
      where.reportDate = {};
      if (startDate) where.reportDate.gte = new Date(startDate as string);
      if (endDate) where.reportDate.lte = new Date(endDate as string);
    }

    const { count, rows } = await ThirdPartyReport.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        list: rows,
        total: count,
        page: Number(page),
        pageSize: Number(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取第三方检测报告列表失败',
      error: (error as Error).message
    });
  }
};

export const getThirdPartyReportDetail = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const report = await ThirdPartyReport.findOne({ where: { reportId } });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: '第三方检测报告不存在'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取第三方检测报告详情失败',
      error: (error as Error).message
    });
  }
};

export const createThirdPartyReport = async (req: Request, res: Response) => {
  const transaction = await qualityDB.transaction();

  try {
    const schema = Joi.object({
      batchId: Joi.string().required(),
      agencyId: Joi.string().required(),
      agencyName: Joi.string().required(),
      reportNumber: Joi.string().required(),
      reportDate: Joi.date().required(),
      reportUrl: Joi.string().uri().optional(),
      reportPdf: Joi.string().optional(),
      testItems: Joi.array().items(
        Joi.object({
          itemName: Joi.string().required(),
          testMethod: Joi.string().optional(),
          standard: Joi.string().optional(),
          result: Joi.string().required(),
          unit: Joi.string().optional(),
          isPass: Joi.boolean().required()
        })
      ).required(),
      conclusion: Joi.string().valid('qualified', 'unqualified', 'conditional').required(),
      inspectorName: Joi.string().optional(),
      reviewerName: Joi.string().optional(),
      remark: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const existingReport = await ThirdPartyReport.findOne({
      where: {
        batchId: value.batchId,
        reportNumber: value.reportNumber
      },
      transaction
    });

    if (existingReport) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: '该批次报告已存在'
      });
    }

    const reportId = `TPR${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
    const traceCode = await generateQualityTraceCode(async (code: string) => {
      const exists = await ThirdPartyReport.findOne({
        where: { traceCode: code },
        transaction
      });
      return !!exists;
    });

    const report = await ThirdPartyReport.create({
      ...value,
      reportId,
      traceCode,
      syncedAt: new Date(),
      syncStatus: 'success'
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: '第三方检测报告创建成功',
      data: report
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: '创建第三方检测报告失败',
      error: (error as Error).message
    });
  }
};

export const getTraceabilityChain = async (req: Request, res: Response) => {
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
    const qualityInspections = await QualityInspection.findAll({
      where: { batchId }
    });
    const thirdPartyReports = await ThirdPartyReport.findAll({
      where: { batchId }
    });

    const materialIds = new Set<string>();
    productionRecords.forEach(record => {
      if (record.materialsUsed) {
        record.materialsUsed.forEach((mat: any) => {
          if (mat.materialId) materialIds.add(mat.materialId);
        });
      }
    });

    const materials = await Material.findAll({
      where: { materialId: Array.from(materialIds) }
    });

    res.json({
      success: true,
      data: {
        batch,
        craft,
        materials,
        productionRecords,
        qualityInspections,
        thirdPartyReports
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取溯源链失败',
      error: (error as Error).message
    });
  }
};
