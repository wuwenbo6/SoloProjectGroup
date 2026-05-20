import { Request, Response } from 'express';
import { FeatureService } from '../services/FeatureService';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export class FeatureController {
  private featureService: FeatureService;

  constructor() {
    this.featureService = new FeatureService();
  }

  async extractFeatures(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await this.featureService.extractFeatures(userId, req.body);
      return successResponse(res, result, '特征提取成功');
    } catch (error) {
      logger.error('Extract features failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '特征提取失败');
    }
  }

  async getFeatures(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await this.featureService.getFeatures(page, pageSize);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get features failed:', error);
      return errorResponse(res, '获取特征列表失败');
    }
  }

  async getFeatureByMaterial(req: Request, res: Response) {
    try {
      const result = await this.featureService.getFeatureByMaterial(req.params.materialId);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get feature by material failed:', error);
      return errorResponse(res, '获取特征信息失败');
    }
  }

  async getMyFeatures(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const userId = (req as any).user.userId;

      const result = await this.featureService.getFeaturesByUser(userId, page, pageSize);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get my features failed:', error);
      return errorResponse(res, '获取我的特征失败');
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const result = await this.featureService.getStats();
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get feature stats failed:', error);
      return errorResponse(res, '获取特征统计失败');
    }
  }
}
