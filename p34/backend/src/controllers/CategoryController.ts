import { Request, Response } from 'express';
import { CategoryService } from '../services/CategoryService';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export class CategoryController {
  private categoryService: CategoryService;

  constructor() {
    this.categoryService = new CategoryService();
  }

  async getAllCategories(req: Request, res: Response) {
    try {
      const result = await this.categoryService.getAllCategories();
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get all categories failed:', error);
      return errorResponse(res, '获取分类列表失败');
    }
  }

  async getCategoryById(req: Request, res: Response) {
    try {
      const result = await this.categoryService.getCategoryById(req.params.id);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get category by id failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '获取分类信息失败', 404);
    }
  }

  async createCategory(req: Request, res: Response) {
    try {
      const result = await this.categoryService.createCategory(req.body);
      return successResponse(res, result, '分类创建成功');
    } catch (error) {
      logger.error('Create category failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '创建分类失败', 400);
    }
  }

  async updateCategory(req: Request, res: Response) {
    try {
      const result = await this.categoryService.updateCategory(req.params.id, req.body);
      return successResponse(res, result, '分类更新成功');
    } catch (error) {
      logger.error('Update category failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '更新分类失败');
    }
  }

  async deleteCategory(req: Request, res: Response) {
    try {
      await this.categoryService.deleteCategory(req.params.id);
      return successResponse(res, null, '分类删除成功');
    } catch (error) {
      logger.error('Delete category failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '删除分类失败');
    }
  }
}
