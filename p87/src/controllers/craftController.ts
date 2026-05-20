import { Request, Response } from 'express';
import Joi from 'joi';
import CraftProcess from '../models/process/CraftProcess';
import { AuthRequest } from '../middleware/auth';

export const createCraft = async (req: AuthRequest, res: Response) => {
  try {
    const schema = Joi.object({
      craftName: Joi.string().required(),
      craftType: Joi.string().required(),
      description: Joi.string().optional(),
      steps: Joi.array().items(
        Joi.object({
          stepNumber: Joi.number().required(),
          stepName: Joi.string().required(),
          description: Joi.string().required(),
          duration: Joi.number().optional(),
          tools: Joi.array().items(Joi.string()).optional()
        })
      ).required(),
      materials: Joi.array().items(
        Joi.object({
          materialId: Joi.string().required(),
          materialName: Joi.string().required(),
          quantity: Joi.number().required(),
          unit: Joi.string().required()
        })
      ).required(),
      version: Joi.string().required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const craftId = `C${Date.now()}`;
    const craft = await CraftProcess.create({
      ...req.body,
      craftId,
      artisanId: req.user?.userId,
      artisanName: req.user?.realName,
      status: 'draft'
    });

    res.status(201).json({
      success: true,
      message: '工艺流程创建成功',
      data: craft
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建工艺流程失败',
      error: (error as Error).message
    });
  }
};

export const getCraftList = async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, craftType, status } = req.query;
    const where: any = {};
    
    if (craftType) where.craftType = craftType;
    if (status) where.status = status;

    const { count, rows } = await CraftProcess.findAndCountAll({
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
      message: '获取工艺列表失败',
      error: (error as Error).message
    });
  }
};

export const getCraftDetail = async (req: Request, res: Response) => {
  try {
    const { craftId } = req.params;
    const craft = await CraftProcess.findOne({ where: { craftId } });

    if (!craft) {
      return res.status(404).json({
        success: false,
        message: '工艺流程不存在'
      });
    }

    res.json({
      success: true,
      data: craft
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取工艺详情失败',
      error: (error as Error).message
    });
  }
};

export const updateCraft = async (req: AuthRequest, res: Response) => {
  try {
    const { craftId } = req.params;
    const craft = await CraftProcess.findOne({ where: { craftId } });

    if (!craft) {
      return res.status(404).json({
        success: false,
        message: '工艺流程不存在'
      });
    }

    await craft.update(req.body);

    res.json({
      success: true,
      message: '工艺流程更新成功',
      data: craft
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新工艺流程失败',
      error: (error as Error).message
    });
  }
};

export const deleteCraft = async (req: Request, res: Response) => {
  try {
    const { craftId } = req.params;
    const craft = await CraftProcess.findOne({ where: { craftId } });

    if (!craft) {
      return res.status(404).json({
        success: false,
        message: '工艺流程不存在'
      });
    }

    await craft.destroy();

    res.json({
      success: true,
      message: '工艺流程删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除工艺流程失败',
      error: (error as Error).message
    });
  }
};
