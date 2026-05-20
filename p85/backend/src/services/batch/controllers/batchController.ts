import { Request, Response } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import { Batch, BatchCollection } from '../models/Batch';
import { successResponse, errorResponse, paginatedResponse } from '../../../shared/utils/response';
import logger from '../../../shared/middleware/logger';

const createBatchSchema = Joi.object({
  batchNo: Joi.string().max(100).required(),
  materialId: Joi.string().uuid().required(),
  collectionIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  productionDate: Joi.date().required(),
  expiryDate: Joi.date().optional(),
  quantity: Joi.number().positive().required(),
  unit: Joi.string().max(20).required(),
});

const updateBatchSchema = Joi.object({
  batchNo: Joi.string().max(100).optional(),
  materialId: Joi.string().uuid().optional(),
  collectionIds: Joi.array().items(Joi.string().uuid()).min(1).optional(),
  productionDate: Joi.date().optional(),
  expiryDate: Joi.date().optional(),
  quantity: Joi.number().positive().optional(),
  unit: Joi.string().max(20).optional(),
  status: Joi.string().valid('producing', 'completed', 'shipped', 'expired').optional(),
});

export const createBatch = async (req: Request, res: Response) => {
  try {
    const { error, value } = createBatchSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const { collectionIds, ...batchData } = value;

    const existingBatch = await Batch.findOne({
      where: { batchNo: batchData.batchNo },
    });

    if (existingBatch) {
      return res.status(409).json(errorResponse('批次号已存在', 409));
    }

    const batch = await Batch.create(batchData);

    const batchCollections = collectionIds.map((collectionId: string) => ({
      batchId: batch.id,
      collectionId,
    }));

    await BatchCollection.bulkCreate(batchCollections);

    logger.info(`Batch created: ${batch.batchNo}`);

    res.status(201).json(successResponse({ ...batch.toJSON(), collectionIds }));
  } catch (err) {
    logger.error('Create batch error:', err);
    res.status(500).json(errorResponse('创建批次失败', 500));
  }
};

export const getBatches = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const materialId = req.query.materialId as string;
    const status = req.query.status as string;
    const batchNo = req.query.batchNo as string;

    const where: any = {};

    if (materialId) {
      where.materialId = materialId;
    }

    if (status) {
      where.status = status;
    }

    if (batchNo) {
      where.batchNo = { [Op.iLike]: `%${batchNo}%` };
    }

    const { count, rows } = await Batch.findAndCountAll({
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [['createdAt', 'DESC']],
    });

    res.json(paginatedResponse(rows, count, page, pageSize));
  } catch (err) {
    logger.error('Get batches error:', err);
    res.status(500).json(errorResponse('获取批次列表失败', 500));
  }
};

export const getBatchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const batch = await Batch.findByPk(id);
    if (!batch) {
      return res.status(404).json(errorResponse('批次不存在', 404));
    }

    const batchCollections = await BatchCollection.findAll({
      where: { batchId: id },
    });

    const collectionIds = batchCollections.map((bc) => bc.collectionId);

    res.json(successResponse({ ...batch.toJSON(), collectionIds }));
  } catch (err) {
    logger.error('Get batch error:', err);
    res.status(500).json(errorResponse('获取批次详情失败', 500));
  }
};

export const updateBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = updateBatchSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const { collectionIds, ...batchData } = value;

    const batch = await Batch.findByPk(id);
    if (!batch) {
      return res.status(404).json(errorResponse('批次不存在', 404));
    }

    await batch.update(batchData);

    if (collectionIds) {
      await BatchCollection.destroy({ where: { batchId: id } });
      const batchCollections = collectionIds.map((collectionId: string) => ({
        batchId: id,
        collectionId,
      }));
      await BatchCollection.bulkCreate(batchCollections);
    }

    logger.info(`Batch updated: ${batch.batchNo}`);

    res.json(successResponse(batch));
  } catch (err) {
    logger.error('Update batch error:', err);
    res.status(500).json(errorResponse('更新批次失败', 500));
  }
};

export const getBatchTrace = async (req: Request, res: Response) => {
  try {
    const { batchNo } = req.params;

    const batch = await Batch.findOne({ where: { batchNo } });
    if (!batch) {
      return res.status(404).json(errorResponse('批次不存在', 404));
    }

    const traceChain: any[] = [
      {
        type: 'batch',
        id: batch.id,
        timestamp: batch.createdAt,
        data: {
          batchNo: batch.batchNo,
          quantity: batch.quantity,
          unit: batch.unit,
          status: batch.status,
          productionDate: batch.productionDate,
        },
      },
    ];

    res.json(successResponse({ batch, traceChain }));
  } catch (err) {
    logger.error('Get batch trace error:', err);
    res.status(500).json(errorResponse('获取溯源信息失败', 500));
  }
};

export const getStatistics = async (req: Request, res: Response) => {
  try {
    const producingCount = await Batch.count({ where: { status: 'producing' } });
    const completedCount = await Batch.count({ where: { status: 'completed' } });
    const shippedCount = await Batch.count({ where: { status: 'shipped' } });
    const expiredCount = await Batch.count({ where: { status: 'expired' } });
    const totalCount = await Batch.count();

    res.json(
      successResponse({
        total: totalCount,
        producing: producingCount,
        completed: completedCount,
        shipped: shippedCount,
        expired: expiredCount,
      })
    );
  } catch (err) {
    logger.error('Get statistics error:', err);
    res.status(500).json(errorResponse('获取统计数据失败', 500));
  }
};

export const getExpiryWarnings = async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const now = new Date();
    const warningDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const criticalDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const warningBatches = await Batch.findAll({
      where: {
        expiryDate: {
          [Op.between]: [now, warningDate],
        },
        status: { [Op.ne]: 'expired' },
      },
      order: [['expiryDate', 'ASC']],
    });

    const warningList = warningBatches.map((batch) => {
      const expiryDate = batch.expiryDate as Date;
      const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const warningLevel = daysLeft <= 7 ? 'critical' : 'warning';

      return {
        ...batch.toJSON(),
        daysLeft,
        warningLevel,
      };
    });

    const criticalCount = warningList.filter((w) => w.warningLevel === 'critical').length;

    res.json(
      successResponse({
        warningDays: days,
        totalWarnings: warningList.length,
        criticalCount,
        warningCount: warningList.length - criticalCount,
        batches: warningList,
      })
    );
  } catch (err) {
    logger.error('Get expiry warnings error:', err);
    res.status(500).json(errorResponse('获取过期预警失败', 500));
  }
};

export const markWarningSent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const batch = await Batch.findByPk(id);
    if (!batch) {
      return res.status(404).json(errorResponse('批次不存在', 404));
    }

    await batch.update({ warningSent: true });

    logger.info(`Warning marked as sent for batch: ${batch.batchNo}`);

    res.json(successResponse({ message: '预警通知已标记为已发送' }));
  } catch (err) {
    logger.error('Mark warning sent error:', err);
    res.status(500).json(errorResponse('标记预警失败', 500));
  }
};
