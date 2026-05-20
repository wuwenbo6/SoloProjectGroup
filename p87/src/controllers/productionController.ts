import { Request, Response } from 'express';
import Joi from 'joi';
import { Transaction } from 'sequelize';
import ProductionRecord from '../models/trace/ProductionRecord';
import Material from '../models/trace/Material';
import { traceDB } from '../config/databases';
import { generateProductionTraceCode } from '../utils/traceCodeGenerator';
import { AuthRequest } from '../middleware/auth';

const productionRecordSchema = Joi.object({
  batchId: Joi.string().required(),
  stepNumber: Joi.number().integer().min(1).required(),
  stepName: Joi.string().required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().optional(),
  workshopId: Joi.string().required(),
  workshopName: Joi.string().required(),
  materialsUsed: Joi.array().items(
    Joi.object({
      materialId: Joi.string().required(),
      materialName: Joi.string().required(),
      quantity: Joi.number().positive().required(),
      unit: Joi.string().required()
    })
  ).optional(),
  toolsUsed: Joi.array().items(Joi.string()).optional(),
  environmentParams: Joi.object().optional(),
  processParameters: Joi.object().optional(),
  images: Joi.array().items(Joi.string()).optional(),
  remark: Joi.string().optional()
});

const validateMaterials = async (materials: any[]): Promise<{ valid: boolean; errors: string[] }> => {
  const errors: string[] = [];

  if (!materials || materials.length === 0) {
    return { valid: true, errors };
  }

  for (const mat of materials) {
    const material = await Material.findOne({
      where: { materialId: mat.materialId }
    });

    if (!material) {
      errors.push(`Material ${mat.materialId} not found`);
      continue;
    }

    if (material.status !== 'in_stock') {
      errors.push(`Material ${mat.materialId} is not in stock`);
    }

    if (material.quantity < mat.quantity) {
      errors.push(`Insufficient quantity for material ${mat.materialId}`);
    }
  }

  return { valid: errors.length === 0, errors };
};

export const createProductionRecord = async (req: AuthRequest, res: Response) => {
  const transaction = await traceDB.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
  });

  try {
    const { error, value } = productionRecordSchema.validate(req.body);
    if (error) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const materialsValidation = await validateMaterials(value.materialsUsed);
    if (!materialsValidation.valid) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '原料验证失败',
        errors: materialsValidation.errors
      });
    }

    const existingRecord = await ProductionRecord.findOne({
      where: {
        batchId: value.batchId,
        stepNumber: value.stepNumber,
        status: 'in_progress'
      },
      transaction
    });

    if (existingRecord) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: '该工序正在进行中'
      });
    }

    const traceCode = await generateProductionTraceCode(async (code: string) => {
      const exists = await ProductionRecord.findOne({
        where: { traceCode: code },
        transaction
      });
      return !!exists;
    });

    const recordId = `PR${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
    const record = await ProductionRecord.create({
      ...value,
      recordId,
      traceCode,
      operatorId: req.user?.userId,
      operatorName: req.user?.realName,
      status: 'in_progress'
    }, { transaction });

    if (value.materialsUsed && value.materialsUsed.length > 0) {
      for (const mat of value.materialsUsed) {
        await Material.decrement('quantity', {
          by: mat.quantity,
          where: { materialId: mat.materialId },
          transaction
        });
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: '生产记录创建成功',
      data: record
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: '创建生产记录失败',
      error: (error as Error).message
    });
  }
};

export const getProductionRecordList = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      batchId,
      status,
      startDate,
      endDate
    } = req.query;

    const where: any = {};

    if (batchId) where.batchId = batchId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate as string);
      if (endDate) where.startTime.lte = new Date(endDate as string);
    }

    const { count, rows } = await ProductionRecord.findAndCountAll({
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
      message: '获取生产记录列表失败',
      error: (error as Error).message
    });
  }
};

export const getProductionRecordDetail = async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const record = await ProductionRecord.findOne({ where: { recordId } });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '生产记录不存在'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取生产记录详情失败',
      error: (error as Error).message
    });
  }
};

export const updateProductionRecord = async (req: AuthRequest, res: Response) => {
  const transaction = await traceDB.transaction();

  try {
    const { recordId } = req.params;
    const record = await ProductionRecord.findOne({
      where: { recordId },
      transaction
    });

    if (!record) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '生产记录不存在'
      });
    }

    const { error, value } = productionRecordSchema.validate(req.body);
    if (error) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    await record.update(value, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: '生产记录更新成功',
      data: record
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: '更新生产记录失败',
      error: (error as Error).message
    });
  }
};

export const completeProductionStep = async (req: AuthRequest, res: Response) => {
  const transaction = await traceDB.transaction();

  try {
    const { recordId } = req.params;
    const { qualityCheck, endTime } = req.body;

    const record = await ProductionRecord.findOne({
      where: { recordId },
      transaction
    });

    if (!record) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '生产记录不存在'
      });
    }

    if (record.status === 'completed') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '该工序已完成'
      });
    }

    await record.update({
      status: 'completed',
      endTime: endTime || new Date(),
      qualityCheck
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: '工序完成成功',
      data: record
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: '完成工序失败',
      error: (error as Error).message
    });
  }
};
