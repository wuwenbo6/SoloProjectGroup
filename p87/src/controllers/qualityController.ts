import { Request, Response } from 'express';
import Joi from 'joi';
import QualityInspection from '../models/quality/QualityInspection';
import { AuthRequest } from '../middleware/auth';

export const createQualityInspection = async (req: AuthRequest, res: Response) => {
  try {
    const schema = Joi.object({
      batchId: Joi.string().required(),
      inspectionType: Joi.string().valid('in_process', 'final', 'sampling', 'third_party').required(),
      inspectionDate: Joi.date().required(),
      items: Joi.array().items(
        Joi.object({
          itemName: Joi.string().required(),
          standard: Joi.string().required(),
          result: Joi.string().required(),
          isPass: Joi.boolean().required(),
          remark: Joi.string().optional()
        })
      ).required(),
      defects: Joi.array().items(
        Joi.object({
          defectType: Joi.string().required(),
          description: Joi.string().required(),
          quantity: Joi.number().required(),
          severity: Joi.string().valid('minor', 'major', 'critical').required()
        })
      ).optional(),
      images: Joi.array().items(Joi.string()).optional(),
      remark: Joi.string().optional(),
      nextAction: Joi.string().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const inspectionId = `QI${Date.now()}`;
    const allPass = req.body.items.every((item: any) => item.isPass);
    
    const inspection = await QualityInspection.create({
      ...req.body,
      inspectionId,
      inspectorId: req.user?.userId,
      inspectorName: req.user?.realName,
      overallResult: allPass ? 'pass' : 'fail'
    });

    res.status(201).json({
      success: true,
      message: '品质检测创建成功',
      data: inspection
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建品质检测失败',
      error: (error as Error).message
    });
  }
};

export const getQualityInspectionList = async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, batchId, inspectionType, overallResult } = req.query;
    const where: any = {};
    
    if (batchId) where.batchId = batchId;
    if (inspectionType) where.inspectionType = inspectionType;
    if (overallResult) where.overallResult = overallResult;

    const { count, rows } = await QualityInspection.findAndCountAll({
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
      message: '获取品质检测列表失败',
      error: (error as Error).message
    });
  }
};

export const getQualityInspectionDetail = async (req: Request, res: Response) => {
  try {
    const { inspectionId } = req.params;
    const inspection = await QualityInspection.findOne({ where: { inspectionId } });

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测不存在'
      });
    }

    res.json({
      success: true,
      data: inspection
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取品质检测详情失败',
      error: (error as Error).message
    });
  }
};

export const updateQualityInspection = async (req: Request, res: Response) => {
  try {
    const { inspectionId } = req.params;
    const inspection = await QualityInspection.findOne({ where: { inspectionId } });

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: '品质检测不存在'
      });
    }

    const updateData = { ...req.body };
    if (updateData.items) {
      updateData.overallResult = updateData.items.every((item: any) => item.isPass) ? 'pass' : 'fail';
    }

    await inspection.update(updateData);

    res.json({
      success: true,
      message: '品质检测更新成功',
      data: inspection
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新品质检测失败',
      error: (error as Error).message
    });
  }
};
