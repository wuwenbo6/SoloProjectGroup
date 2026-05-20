import { Request, Response } from 'express';
import Joi from 'joi';
import Material from '../models/trace/Material';

export const createMaterial = async (req: Request, res: Response) => {
  try {
    const schema = Joi.object({
      materialName: Joi.string().required(),
      materialType: Joi.string().required(),
      origin: Joi.string().required(),
      supplierId: Joi.string().required(),
      supplierName: Joi.string().required(),
      batchNumber: Joi.string().required(),
      quantity: Joi.number().required(),
      unit: Joi.string().required(),
      qualityLevel: Joi.string().optional(),
      certification: Joi.string().optional(),
      purchaseDate: Joi.date().required(),
      expiryDate: Joi.date().optional(),
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

    const materialId = `M${Date.now()}`;
    const material = await Material.create({
      ...req.body,
      materialId,
      status: 'in_stock'
    });

    res.status(201).json({
      success: true,
      message: '原料创建成功',
      data: material
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建原料失败',
      error: (error as Error).message
    });
  }
};

export const getMaterialList = async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, materialType, status } = req.query;
    const where: any = {};
    
    if (materialType) where.materialType = materialType;
    if (status) where.status = status;

    const { count, rows } = await Material.findAndCountAll({
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
      message: '获取原料列表失败',
      error: (error as Error).message
    });
  }
};

export const getMaterialDetail = async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;
    const material = await Material.findOne({ where: { materialId } });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: '原料不存在'
      });
    }

    res.json({
      success: true,
      data: material
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取原料详情失败',
      error: (error as Error).message
    });
  }
};

export const updateMaterial = async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;
    const material = await Material.findOne({ where: { materialId } });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: '原料不存在'
      });
    }

    await material.update(req.body);

    res.json({
      success: true,
      message: '原料更新成功',
      data: material
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新原料失败',
      error: (error as Error).message
    });
  }
};
