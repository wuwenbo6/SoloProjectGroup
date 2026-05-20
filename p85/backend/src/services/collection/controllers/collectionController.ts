import { Request, Response } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import { Collection } from '../models/Collection';
import { successResponse, errorResponse, paginatedResponse } from '../../../shared/utils/response';
import { withRetry, withTransaction } from '../../../shared/utils/retry';
import { createQueue } from '../../../shared/utils/asyncQueue';
import { exportReport, generateCollectionReport, generateStatisticsSummary } from '../../../shared/utils/reportExporter';
import { initCollectionDatabase } from '../../../shared/config/database';
import logger from '../../../shared/middleware/logger';

const syncQueue = createQueue(
  async (ids: string[]) => {
    await Collection.update(
      { syncStatus: 'synced' },
      { where: { id: { [Op.in]: ids } } }
    );
    logger.info(`Async sync completed: ${ids.length} records`);
  },
  { concurrency: 10 }
);

const createCollectionSchema = Joi.object({
  materialId: Joi.string().uuid().required(),
  collectionTime: Joi.date().required(),
  location: Joi.string().max(200).required(),
  quantity: Joi.number().positive().required(),
  unit: Joi.string().max(20).required(),
  weather: Joi.string().max(100).optional(),
  notes: Joi.string().optional(),
});

const updateCollectionSchema = Joi.object({
  materialId: Joi.string().uuid().optional(),
  collectionTime: Joi.date().optional(),
  location: Joi.string().max(200).optional(),
  quantity: Joi.number().positive().optional(),
  unit: Joi.string().max(20).optional(),
  weather: Joi.string().max(100).optional(),
  notes: Joi.string().optional(),
  syncStatus: Joi.string().valid('pending', 'synced', 'failed').optional(),
});

export const createCollection = async (req: Request, res: Response) => {
  try {
    const { error, value } = createCollectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const sequelize = initCollectionDatabase();

    const collection = await withRetry(
      () =>
        withTransaction(sequelize, async (transaction) => {
          return await Collection.create(
            {
              ...value,
              collectorId: req.user!.id,
              syncStatus: 'pending',
            },
            { transaction }
          );
        }),
      { maxRetries: 3, delayMs: 200 }
    );

    logger.info(`Collection created: ${collection.id} with transaction protection`);

    res.status(201).json(successResponse(collection));
  } catch (err) {
    logger.error('Create collection error after retries:', err);
    res.status(500).json(errorResponse('创建采集记录失败，请重试', 500));
  }
};

export const getCollections = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const materialId = req.query.materialId as string;
    const syncStatus = req.query.syncStatus as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = {};

    if (materialId) {
      where.materialId = materialId;
    }

    if (syncStatus) {
      where.syncStatus = syncStatus;
    }

    if (startDate || endDate) {
      where.collectionTime = {};
      if (startDate) {
        where.collectionTime[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.collectionTime[Op.lte] = new Date(endDate);
      }
    }

    const { count, rows } = await Collection.findAndCountAll({
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [['collectionTime', 'DESC']],
    });

    res.json(paginatedResponse(rows, count, page, pageSize));
  } catch (err) {
    logger.error('Get collections error:', err);
    res.status(500).json(errorResponse('获取采集记录列表失败', 500));
  }
};

export const getCollectionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const collection = await Collection.findByPk(id);
    if (!collection) {
      return res.status(404).json(errorResponse('采集记录不存在', 404));
    }

    res.json(successResponse(collection));
  } catch (err) {
    logger.error('Get collection error:', err);
    res.status(500).json(errorResponse('获取采集记录详情失败', 500));
  }
};

export const updateCollection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = updateCollectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const collection = await Collection.findByPk(id);
    if (!collection) {
      return res.status(404).json(errorResponse('采集记录不存在', 404));
    }

    await collection.update(value);

    logger.info(`Collection updated: ${collection.id}`);

    res.json(successResponse(collection));
  } catch (err) {
    logger.error('Update collection error:', err);
    res.status(500).json(errorResponse('更新采集记录失败', 500));
  }
};

export const syncCollections = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json(errorResponse('无效的ID列表', 400));
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      syncQueue.add(batch);
    }

    logger.info(`Sync queued: ${ids.length} records, batch count: ${Math.ceil(ids.length / BATCH_SIZE)}`);

    res.json(
      successResponse({
        queuedCount: ids.length,
        message: '同步任务已加入队列，将在后台异步处理',
      })
    );
  } catch (err) {
    logger.error('Sync collections error:', err);
    res.status(500).json(errorResponse('同步采集记录失败', 500));
  }
};

export const batchCreateCollections = async (req: Request, res: Response) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json(errorResponse('无效的记录列表', 400));
    }

    const sequelize = initCollectionDatabase();
    const createdRecords: any[] = [];

    const BATCH_SIZE = 20;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const batchResults = await withTransaction(sequelize, async (transaction) => {
        const promises = batch.map((record: any) =>
          Collection.create(
            {
              ...record,
              collectorId: req.user!.id,
              syncStatus: 'pending',
            },
            { transaction }
          )
        );
        return Promise.all(promises);
      });
      createdRecords.push(...batchResults);
    }

    logger.info(`Batch create completed: ${createdRecords.length} records`);

    res.status(201).json(
      successResponse({
        createdCount: createdRecords.length,
        records: createdRecords,
      })
    );
  } catch (err) {
    logger.error('Batch create collections error:', err);
    res.status(500).json(errorResponse('批量创建采集记录失败', 500));
  }
};

export const getStatistics = async (req: Request, res: Response) => {
  try {
    const pendingCount = await Collection.count({ where: { syncStatus: 'pending' } });
    const syncedCount = await Collection.count({ where: { syncStatus: 'synced' } });
    const totalCount = await Collection.count();

    res.json(
      successResponse({
        total: totalCount,
        pending: pendingCount,
        synced: syncedCount,
      })
    );
  } catch (err) {
    logger.error('Get statistics error:', err);
    res.status(500).json(errorResponse('获取统计数据失败', 500));
  }
};

export const exportCollections = async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const materialId = req.query.materialId as string;
    const syncStatus = req.query.syncStatus as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = {};

    if (materialId) {
      where.materialId = materialId;
    }

    if (syncStatus) {
      where.syncStatus = syncStatus;
    }

    if (startDate || endDate) {
      where.collectionTime = {};
      if (startDate) {
        where.collectionTime[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.collectionTime[Op.lte] = new Date(endDate);
      }
    }

    const collections = await Collection.findAll({
      where,
      order: [['collectionTime', 'DESC']],
    });

    const reportData = generateCollectionReport(collections);
    const summary = generateStatisticsSummary(collections);
    const buffer = exportReport(reportData.data, {
      format: format as any,
      columns: reportData.columns,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `采集数据报表_${timestamp}.${format}`;

    logger.info(`Exporting collection report: ${filename}, total: ${collections.length} records`);

    res.setHeader('Content-Type', `text/${format}; charset=utf-8`);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('X-Export-Summary', JSON.stringify(summary));

    res.send(buffer);
  } catch (err) {
    logger.error('Export collections error:', err);
    res.status(500).json(errorResponse('导出报表失败', 500));
  }
};
