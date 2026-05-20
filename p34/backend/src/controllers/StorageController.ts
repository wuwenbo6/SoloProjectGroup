import { Request, Response } from 'express';
import { StorageService } from '../services/StorageService';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const storageService = new StorageService();

export const getStorageStats = async (req: Request, res: Response) => {
  try {
    const stats = await storageService.getStorageStats();
    return successResponse(res, stats);
  } catch (error) {
    logger.error('Get storage stats failed:', error);
    return errorResponse(res, '获取存储统计失败');
  }
};

export const getMaterialStorageInfo = async (req: Request, res: Response) => {
  try {
    const info = await storageService.getMaterialStorageInfo(req.params.materialId);
    if (!info) {
      return errorResponse(res, '素材存储信息不存在', 404);
    }
    return successResponse(res, info);
  } catch (error) {
    logger.error('Get material storage info failed:', error);
    return errorResponse(res, '获取素材存储信息失败');
  }
};

export const runLifecycle = async (req: Request, res: Response) => {
  try {
    const result = await storageService.runStorageLifecycle();
    return successResponse(res, result, '存储生命周期管理执行完成');
  } catch (error) {
    logger.error('Run storage lifecycle failed:', error);
    return errorResponse(res, '执行存储生命周期管理失败');
  }
};

export const promoteMaterial = async (req: Request, res: Response) => {
  try {
    const { materialId, targetTier } = req.body;
    if (!['HOT', 'COLD', 'ARCHIVE'].includes(targetTier)) {
      return errorResponse(res, '无效的存储层级', 400);
    }
    await storageService.manualPromote(materialId, targetTier);
    return successResponse(res, null, `素材已迁移到${targetTier}存储层`);
  } catch (error) {
    logger.error('Promote material failed:', error);
    return errorResponse(res, '迁移素材存储层失败');
  }
};

export const deleteMaterialStorage = async (req: Request, res: Response) => {
  try {
    await storageService.deleteMaterial(req.params.materialId);
    return successResponse(res, null, '素材存储已删除');
  } catch (error) {
    logger.error('Delete material storage failed:', error);
    return errorResponse(res, '删除素材存储失败');
  }
};
