import { Request, Response } from 'express';
import { MuseumSyncService, MuseumSourceConfig } from '../services/MuseumSyncService';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const museumService = new MuseumSyncService();

export const createDataSource = async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user.userId;
    const result = await museumService.createDataSource(req.body, operatorId);
    return successResponse(res, result, '数据源创建成功');
  } catch (error) {
    logger.error('Create data source failed:', error);
    return errorResponse(res, '创建数据源失败');
  }
};

export const updateDataSource = async (req: Request, res: Response) => {
  try {
    const result = await museumService.updateDataSource(req.params.id, req.body);
    return successResponse(res, result, '数据源更新成功');
  } catch (error) {
    logger.error('Update data source failed:', error);
    return errorResponse(res, '更新数据源失败');
  }
};

export const deleteDataSource = async (req: Request, res: Response) => {
  try {
    await museumService.deleteDataSource(req.params.id);
    return successResponse(res, null, '数据源删除成功');
  } catch (error) {
    logger.error('Delete data source failed:', error);
    return errorResponse(res, '删除数据源失败');
  }
};

export const getAllDataSources = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await museumService.getAllDataSources(page, pageSize);
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get data sources failed:', error);
    return errorResponse(res, '获取数据源列表失败');
  }
};

export const getDataSourceById = async (req: Request, res: Response) => {
  try {
    const result = await museumService.getDataSourceById(req.params.id);
    if (!result) {
      return errorResponse(res, '数据源不存在', 404);
    }
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get data source failed:', error);
    return errorResponse(res, '获取数据源详情失败');
  }
};

export const syncDataSource = async (req: Request, res: Response) => {
  try {
    const result = await museumService.syncDataSource(req.params.id);
    return successResponse(res, result, '同步任务已启动');
  } catch (error) {
    logger.error('Sync data source failed:', error);
    return errorResponse(res, '同步数据源失败');
  }
};

export const syncAllDataSources = async (req: Request, res: Response) => {
  try {
    await museumService.syncAllActiveSources();
    return successResponse(res, null, '全量同步任务已启动');
  } catch (error) {
    logger.error('Sync all data sources failed:', error);
    return errorResponse(res, '全量同步失败');
  }
};

export const getSyncLogs = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await museumService.getSyncLogs(req.params.dataSourceId, page, pageSize);
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get sync logs failed:', error);
    return errorResponse(res, '获取同步日志失败');
  }
};

export const getStatistics = async (req: Request, res: Response) => {
  try {
    const result = await museumService.getSyncStatistics();
    return successResponse(res, result);
  } catch (error) {
    logger.error('Get statistics failed:', error);
    return errorResponse(res, '获取统计数据失败');
  }
};
