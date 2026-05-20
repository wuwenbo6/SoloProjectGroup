import { Request, Response } from 'express';
import Joi from 'joi';
import Batch from '../models/process/Batch';
import { AuthRequest } from '../middleware/auth';

export const createBatch = async (req: AuthRequest, res: Response) => {
  try {
    const schema = Joi.object({
      batchName: Joi.string().optional(),
      craftId: Joi.string().required(),
      quantity: Joi.number().required(),
      startDate: Joi.date().required(),
      estimatedEndDate: Joi.date().optional(),
      workshopId: Joi.string().required(),
      workshopName: Joi.string().required(),
      remark: Joi.string().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const batchId = `B${Date.now()}`;
    const batch = await Batch.create({
      ...req.body,
      batchId,
      supervisorId: req.user?.userId,
      supervisorName: req.user?.realName,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: '批次创建成功',
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建批次失败',
      error: (error as Error).message
    });
  }
};

export const getBatchList = async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, craftId, status } = req.query;
    const where: any = {};
    
    if (craftId) where.craftId = craftId;
    if (status) where.status = status;

    const { count, rows } = await Batch.findAndCountAll({
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
      message: '获取批次列表失败',
      error: (error as Error).message
    });
  }
};

export const getBatchDetail = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const batch = await Batch.findOne({ where: { batchId } });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取批次详情失败',
      error: (error as Error).message
    });
  }
};

export const updateBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const batch = await Batch.findOne({ where: { batchId } });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    await batch.update(req.body);

    res.json({
      success: true,
      message: '批次更新成功',
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新批次失败',
      error: (error as Error).message
    });
  }
};

export const startBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const batch = await Batch.findOne({ where: { batchId } });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    await batch.update({
      status: 'in_progress',
      startDate: new Date()
    });

    res.json({
      success: true,
      message: '批次开始成功',
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '开始批次失败',
      error: (error as Error).message
    });
  }
};

export const completeBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const batch = await Batch.findOne({ where: { batchId } });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    await batch.update({
      status: 'completed',
      actualEndDate: new Date()
    });

    res.json({
      success: true,
      message: '批次完成成功',
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '完成批次失败',
      error: (error as Error).message
    });
  }
};
