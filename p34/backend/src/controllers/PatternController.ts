import { Request, Response } from 'express';
import { PatternService } from '../services/PatternService';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export class PatternController {
  private patternService: PatternService;

  constructor() {
    this.patternService = new PatternService();
  }

  async generatePattern(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await this.patternService.generatePattern(userId, req.body);
      return successResponse(res, result, '图案生成成功');
    } catch (error) {
      logger.error('Generate pattern failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '图案生成失败');
    }
  }

  async getPatterns(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const isPublic = req.query.isPublic === 'true';

      const result = await this.patternService.getPatterns(page, pageSize, isPublic);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get patterns failed:', error);
      return errorResponse(res, '获取图案列表失败');
    }
  }

  async getPatternById(req: Request, res: Response) {
    try {
      const result = await this.patternService.getPatternById(req.params.id);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get pattern by id failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '获取图案信息失败', 404);
    }
  }

  async getMyPatterns(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const userId = (req as any).user.userId;

      const result = await this.patternService.getPatternsByUser(userId, page, pageSize);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get my patterns failed:', error);
      return errorResponse(res, '获取我的图案失败');
    }
  }

  async updatePattern(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await this.patternService.updatePattern(req.params.id, userId, req.body);
      return successResponse(res, result, '图案更新成功');
    } catch (error) {
      logger.error('Update pattern failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '更新图案失败');
    }
  }

  async deletePattern(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      await this.patternService.deletePattern(req.params.id, userId);
      return successResponse(res, null, '图案删除成功');
    } catch (error) {
      logger.error('Delete pattern failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '删除图案失败');
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const result = await this.patternService.getStats();
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get pattern stats failed:', error);
      return errorResponse(res, '获取图案统计失败');
    }
  }
}
