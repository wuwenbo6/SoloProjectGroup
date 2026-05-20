import { Request, Response } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import { Material } from '../models/Material';
import { successResponse, errorResponse, paginatedResponse } from '../../../shared/utils/response';
import logger from '../../../shared/middleware/logger';

const createMaterialSchema = Joi.object({
  name: Joi.string().max(200).required(),
  category: Joi.string().max(100).required(),
  origin: Joi.string().max(200).required(),
  originCoords: Joi.object({
    lat: Joi.number().required(),
    lng: Joi.number().required(),
  }).optional(),
  description: Joi.string().optional(),
  specifications: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
});

const updateMaterialSchema = Joi.object({
  name: Joi.string().max(200).optional(),
  category: Joi.string().max(100).optional(),
  origin: Joi.string().max(200).optional(),
  originCoords: Joi.object({
    lat: Joi.number().required(),
    lng: Joi.number().required(),
  }).optional(),
  description: Joi.string().optional(),
  specifications: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
});

export const createMaterial = async (req: Request, res: Response) => {
  try {
    const { error, value } = createMaterialSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const material = await Material.create(value);

    logger.info(`Material created: ${material.name}`);

    res.status(201).json(successResponse(material));
  } catch (err) {
    logger.error('Create material error:', err);
    res.status(500).json(errorResponse('创建原料失败', 500));
  }
};

export const getMaterials = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const category = req.query.category as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { origin: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Material.findAndCountAll({
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [['createdAt', 'DESC']],
    });

    res.json(paginatedResponse(rows, count, page, pageSize));
  } catch (err) {
    logger.error('Get materials error:', err);
    res.status(500).json(errorResponse('获取原料列表失败', 500));
  }
};

export const getMaterialById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json(errorResponse('原料不存在', 404));
    }

    res.json(successResponse(material));
  } catch (err) {
    logger.error('Get material error:', err);
    res.status(500).json(errorResponse('获取原料详情失败', 500));
  }
};

export const updateMaterial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = updateMaterialSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json(errorResponse('原料不存在', 404));
    }

    await material.update(value);

    logger.info(`Material updated: ${material.name}`);

    res.json(successResponse(material));
  } catch (err) {
    logger.error('Update material error:', err);
    res.status(500).json(errorResponse('更新原料失败', 500));
  }
};

export const deleteMaterial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json(errorResponse('原料不存在', 404));
    }

    await material.update({ status: 'inactive' });

    logger.info(`Material deleted: ${material.name}`);

    res.json(successResponse(null, '删除成功'));
  } catch (err) {
    logger.error('Delete material error:', err);
    res.status(500).json(errorResponse('删除原料失败', 500));
  }
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const materials = await Material.findAll({
      attributes: ['category'],
      group: ['category'],
      where: { status: 'active' },
    });

    const categories = materials.map((m) => m.category);

    res.json(successResponse(categories));
  } catch (err) {
    logger.error('Get categories error:', err);
    res.status(500).json(errorResponse('获取分类列表失败', 500));
  }
};
