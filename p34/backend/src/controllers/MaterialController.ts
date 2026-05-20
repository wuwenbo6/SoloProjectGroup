import { Request, Response } from 'express';
import { MaterialService } from '../services/MaterialService';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export class MaterialController {
  private materialService: MaterialService;

  constructor() {
    this.materialService = new MaterialService();
  }

  async uploadMaterial(req: Request, res: Response) {
    try {
      if (!req.file) {
        return errorResponse(res, '请上传图片文件', 400);
      }

      const userId = (req as any).user.userId;
      const result = await this.materialService.uploadMaterial(userId, req.file, req.body);
      
      return successResponse(res, result, '素材上传成功');
    } catch (error) {
      logger.error('Upload material failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '素材上传失败');
    }
  }

  async getMaterials(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const filters = {
        categoryId: req.query.categoryId as string,
        ethnicity: req.query.ethnicity as string,
        status: req.query.status as string,
      };

      const result = await this.materialService.getMaterials(page, pageSize, filters);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get materials failed:', error);
      return errorResponse(res, '获取素材列表失败');
    }
  }

  async getMaterialById(req: Request, res: Response) {
    try {
      const result = await this.materialService.getMaterialById(req.params.id);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get material by id failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '获取素材信息失败', 404);
    }
  }

  async getMyMaterials(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const userId = (req as any).user.userId;

      const result = await this.materialService.getMaterialsByUser(userId, page, pageSize);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get my materials failed:', error);
      return errorResponse(res, '获取我的素材失败');
    }
  }

  async updateMaterial(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await this.materialService.updateMaterial(req.params.id, userId, req.body);
      return successResponse(res, result, '素材更新成功');
    } catch (error) {
      logger.error('Update material failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '更新素材失败');
    }
  }

  async deleteMaterial(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      await this.materialService.deleteMaterial(req.params.id, userId);
      return successResponse(res, null, '素材删除成功');
    } catch (error) {
      logger.error('Delete material failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '删除素材失败');
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const result = await this.materialService.getStats();
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get material stats failed:', error);
      return errorResponse(res, '获取素材统计失败');
    }
  }
}
