import { Request, Response } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import { PaperProcess, MaterialProcessMap } from '../models/PaperProcess';
import { Material } from '../models/Material';
import { successResponse, errorResponse, paginatedResponse } from '../../../shared/utils/response';
import logger from '../../../shared/middleware/logger';

const createProcessSchema = Joi.object({
  name: Joi.string().max(200).required(),
  code: Joi.string().max(50).required(),
  description: Joi.string().optional(),
  originRegions: Joi.array().items(Joi.string()).optional(),
  steps: Joi.array()
    .items(
      Joi.object({
        order: Joi.number().required(),
        name: Joi.string().required(),
        description: Joi.string().required(),
        duration: Joi.string().optional(),
      })
    )
    .optional(),
  materials: Joi.array()
    .items(
      Joi.object({
        materialId: Joi.string().uuid().required(),
        usage: Joi.string().required(),
        quantity: Joi.number().optional(),
        unit: Joi.string().optional(),
      })
    )
    .optional(),
  qualityStandards: Joi.object().optional(),
  traditional: Joi.boolean().optional(),
  difficulty: Joi.string().valid('easy', 'medium', 'hard', 'expert').optional(),
  status: Joi.string().valid('active', 'inactive', 'deprecated').optional(),
});

const updateProcessSchema = createProcessSchema.keys({
  name: Joi.string().max(200).optional(),
  code: Joi.string().max(50).optional(),
});

const mapMaterialSchema = Joi.object({
  materialId: Joi.string().uuid().required(),
  usageRatio: Joi.number().min(0).max(100).optional(),
  notes: Joi.string().optional(),
});

export const createProcess = async (req: Request, res: Response) => {
  try {
    const { error, value } = createProcessSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const existingProcess = await PaperProcess.findOne({
      where: { code: value.code },
    });

    if (existingProcess) {
      return res.status(409).json(errorResponse('工艺编码已存在', 409));
    }

    const process = await PaperProcess.create(value);

    logger.info(`Paper process created: ${process.name} (${process.code})`);

    res.status(201).json(successResponse(process));
  } catch (err) {
    logger.error('Create paper process error:', err);
    res.status(500).json(errorResponse('创建造纸工艺失败', 500));
  }
};

export const getProcesses = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as string;
    const traditional = req.query.traditional as string;
    const originRegion = req.query.originRegion as string;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (traditional !== undefined) {
      where.traditional = traditional === 'true';
    }

    if (originRegion) {
      where.originRegions = { [Op.contains]: [originRegion] };
    }

    const { count, rows } = await PaperProcess.findAndCountAll({
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [['createdAt', 'DESC']],
    });

    res.json(paginatedResponse(rows, count, page, pageSize));
  } catch (err) {
    logger.error('Get paper processes error:', err);
    res.status(500).json(errorResponse('获取造纸工艺列表失败', 500));
  }
};

export const getProcessById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const process = await PaperProcess.findByPk(id);
    if (!process) {
      return res.status(404).json(errorResponse('造纸工艺不存在', 404));
    }

    res.json(successResponse(process));
  } catch (err) {
    logger.error('Get paper process error:', err);
    res.status(500).json(errorResponse('获取造纸工艺详情失败', 500));
  }
};

export const updateProcess = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = updateProcessSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const process = await PaperProcess.findByPk(id);
    if (!process) {
      return res.status(404).json(errorResponse('造纸工艺不存在', 404));
    }

    if (value.code && value.code !== process.code) {
      const existingProcess = await PaperProcess.findOne({
        where: { code: value.code },
      });
      if (existingProcess) {
        return res.status(409).json(errorResponse('工艺编码已存在', 409));
      }
    }

    await process.update(value);

    logger.info(`Paper process updated: ${process.name} (${process.code})`);

    res.json(successResponse(process));
  } catch (err) {
    logger.error('Update paper process error:', err);
    res.status(500).json(errorResponse('更新造纸工艺失败', 500));
  }
};

export const deleteProcess = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const process = await PaperProcess.findByPk(id);
    if (!process) {
      return res.status(404).json(errorResponse('造纸工艺不存在', 404));
    }

    await process.destroy();

    logger.info(`Paper process deleted: ${process.name} (${process.code})`);

    res.json(successResponse({ message: '造纸工艺已删除' }));
  } catch (err) {
    logger.error('Delete paper process error:', err);
    res.status(500).json(errorResponse('删除造纸工艺失败', 500));
  }
};

export const mapMaterialToProcess = async (req: Request, res: Response) => {
  try {
    const { processId } = req.params;
    const { error, value } = mapMaterialSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const process = await PaperProcess.findByPk(processId);
    if (!process) {
      return res.status(404).json(errorResponse('造纸工艺不存在', 404));
    }

    const material = await Material.findByPk(value.materialId);
    if (!material) {
      return res.status(404).json(errorResponse('原料不存在', 404));
    }

    const existingMap = await MaterialProcessMap.findOne({
      where: {
        materialId: value.materialId,
        processId,
      },
    });

    if (existingMap) {
      return res.status(409).json(errorResponse('该原料已关联到此工艺', 409));
    }

    await MaterialProcessMap.create({
      processId,
      materialId: value.materialId,
      usageRatio: value.usageRatio || 1.0,
      notes: value.notes || '',
    });

    logger.info(`Material ${value.materialId} mapped to process ${processId}`);

    res.json(successResponse({ message: '原料与工艺关联成功' }));
  } catch (err) {
    logger.error('Map material to process error:', err);
    res.status(500).json(errorResponse('关联原料到工艺失败', 500));
  }
};

export const unmapMaterialFromProcess = async (req: Request, res: Response) => {
  try {
    const { processId, materialId } = req.params;

    const result = await MaterialProcessMap.destroy({
      where: {
        materialId,
        processId,
      },
    });

    if (result === 0) {
      return res.status(404).json(errorResponse('关联关系不存在', 404));
    }

    logger.info(`Material ${materialId} unmapped from process ${processId}`);

    res.json(successResponse({ message: '已解除原料与工艺的关联' }));
  } catch (err) {
    logger.error('Unmap material from process error:', err);
    res.status(500).json(errorResponse('解除原料与工艺关联失败', 500));
  }
};

export const getProcessMaterials = async (req: Request, res: Response) => {
  try {
    const { processId } = req.params;

    const mappings = await MaterialProcessMap.findAll({
      where: { processId },
    });

    const materialIds = mappings.map((m) => m.materialId);
    const materials = await Material.findAll({
      where: { id: { [Op.in]: materialIds } },
    });

    const materialMap = new Map(materials.map((m) => [m.id, m]));
    const result = mappings.map((mapping) => ({
      material: materialMap.get(mapping.materialId),
      usageRatio: mapping.usageRatio,
      notes: mapping.notes,
    }));

    res.json(successResponse(result));
  } catch (err) {
    logger.error('Get process materials error:', err);
    res.status(500).json(errorResponse('获取工艺关联原料失败', 500));
  }
};

export const getMaterialProcesses = async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;

    const mappings = await MaterialProcessMap.findAll({
      where: { materialId },
    });

    const processIds = mappings.map((m) => m.processId);
    const processes = await PaperProcess.findAll({
      where: { id: { [Op.in]: processIds } },
    });

    const processMap = new Map(processes.map((p) => [p.id, p]));
    const result = mappings.map((mapping) => ({
      process: processMap.get(mapping.processId),
      usageRatio: mapping.usageRatio,
      notes: mapping.notes,
    }));

    res.json(successResponse(result));
  } catch (err) {
    logger.error('Get material processes error:', err);
    res.status(500).json(errorResponse('获取原料关联工艺失败', 500));
  }
};

export const getProcessesByOrigin = async (req: Request, res: Response) => {
  try {
    const { origin } = req.params;

    const processes = await PaperProcess.findAll({
      where: {
        originRegions: {
          [Op.contains]: [origin],
        },
        status: 'active',
      },
      order: [['name', 'ASC']],
    });

    res.json(successResponse({
      origin,
      processCount: processes.length,
      processes,
    }));
  } catch (err) {
    logger.error('Get processes by origin error:', err);
    res.status(500).json(errorResponse('获取产地关联工艺失败', 500));
  }
};
