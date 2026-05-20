import { Request, Response } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import { Inspection } from '../models/Inspection';
import { successResponse, errorResponse, paginatedResponse } from '../../../shared/utils/response';
import { calculateInspectionResult, validateInspectionData } from '../../../shared/utils/inspectionCalculator';
import { withRetry, withTransaction } from '../../../shared/utils/retry';
import { initInspectionDatabase } from '../../../shared/config/database';
import logger from '../../../shared/middleware/logger';

const inspectionItemSchema = Joi.object({
  name: Joi.string().required(),
  value: Joi.string().required(),
  standard: Joi.string().optional(),
});

const createInspectionSchema = Joi.object({
  collectionId: Joi.string().uuid().required(),
  inspectionType: Joi.string().valid('internal', 'third_party').required(),
  items: Joi.array().items(inspectionItemSchema).min(1).required(),
  conclusion: Joi.string().valid('pass', 'fail', 'pending').required(),
  reportUrl: Joi.string().uri().optional(),
  agencyId: Joi.string().uuid().optional(),
});

const updateInspectionSchema = Joi.object({
  inspectionType: Joi.string().valid('internal', 'third_party').optional(),
  items: Joi.array().items(inspectionItemSchema).min(1).optional(),
  conclusion: Joi.string().valid('pass', 'fail', 'pending').optional(),
  reportUrl: Joi.string().uri().optional(),
  agencyId: Joi.string().uuid().optional(),
});

export const createInspection = async (req: Request, res: Response) => {
  try {
    const { error, value } = createInspectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const validation = validateInspectionData(value.items);
    if (!validation.valid) {
      return res.status(400).json(
        errorResponse('检测数据验证失败', 400, {
          errors: validation.errors,
        })
      );
    }

    const calculationResult = calculateInspectionResult(value.items);

    let conclusion = value.conclusion;
    if (conclusion === 'pending') {
      conclusion = calculationResult.passed ? 'pass' : 'fail';
    }

    const sequelize = initInspectionDatabase();

    const inspection = await withRetry(
      () =>
        withTransaction(sequelize, async (transaction) => {
          return await Inspection.create(
            {
              ...value,
              conclusion,
              inspectorId: req.user!.id,
              score: calculationResult.score,
              calculatedDetails: calculationResult.details,
            },
            { transaction }
          );
        }),
      { maxRetries: 3, delayMs: 200 }
    );

    logger.info(
      `Inspection created: ${inspection.id}, score: ${calculationResult.score}, passed: ${calculationResult.passed}`
    );

    res.status(201).json(
      successResponse({
        inspection,
        calculation: {
          score: calculationResult.score,
          passed: calculationResult.passed,
          details: calculationResult.details,
        },
      })
    );
  } catch (err) {
    logger.error('Create inspection error:', err);
    res.status(500).json(errorResponse('创建检测记录失败', 500));
  }
};

export const getInspections = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const collectionId = req.query.collectionId as string;
    const conclusion = req.query.conclusion as string;
    const inspectionType = req.query.inspectionType as string;

    const where: any = {};

    if (collectionId) {
      where.collectionId = collectionId;
    }

    if (conclusion) {
      where.conclusion = conclusion;
    }

    if (inspectionType) {
      where.inspectionType = inspectionType;
    }

    const { count, rows } = await Inspection.findAndCountAll({
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [['createdAt', 'DESC']],
    });

    res.json(paginatedResponse(rows, count, page, pageSize));
  } catch (err) {
    logger.error('Get inspections error:', err);
    res.status(500).json(errorResponse('获取检测记录列表失败', 500));
  }
};

export const getInspectionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const inspection = await Inspection.findByPk(id);
    if (!inspection) {
      return res.status(404).json(errorResponse('检测记录不存在', 404));
    }

    res.json(successResponse(inspection));
  } catch (err) {
    logger.error('Get inspection error:', err);
    res.status(500).json(errorResponse('获取检测记录详情失败', 500));
  }
};

export const updateInspection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = updateInspectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const inspection = await Inspection.findByPk(id);
    if (!inspection) {
      return res.status(404).json(errorResponse('检测记录不存在', 404));
    }

    await inspection.update(value);

    logger.info(`Inspection updated: ${inspection.id}`);

    res.json(successResponse(inspection));
  } catch (err) {
    logger.error('Update inspection error:', err);
    res.status(500).json(errorResponse('更新检测记录失败', 500));
  }
};

export const getStatistics = async (req: Request, res: Response) => {
  try {
    const passCount = await Inspection.count({ where: { conclusion: 'pass' } });
    const failCount = await Inspection.count({ where: { conclusion: 'fail' } });
    const pendingCount = await Inspection.count({ where: { conclusion: 'pending' } });
    const totalCount = await Inspection.count();

    res.json(
      successResponse({
        total: totalCount,
        pass: passCount,
        fail: failCount,
        pending: pendingCount,
      })
    );
  } catch (err) {
    logger.error('Get statistics error:', err);
    res.status(500).json(errorResponse('获取统计数据失败', 500));
  }
};
