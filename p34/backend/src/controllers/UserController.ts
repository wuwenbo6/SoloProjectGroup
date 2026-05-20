import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async getAllUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const filters = {
        role: req.query.role as any,
        status: req.query.status as any,
      };

      const result = await this.userService.getAllUsers(page, pageSize, filters);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get all users failed:', error);
      return errorResponse(res, '获取用户列表失败');
    }
  }

  async getUserById(req: Request, res: Response) {
    try {
      const result = await this.userService.getUserById(req.params.id);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get user by id failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '获取用户信息失败', 404);
    }
  }

  async createUser(req: Request, res: Response) {
    try {
      const result = await this.userService.createUser(req.body);
      return successResponse(res, result, '用户创建成功');
    } catch (error) {
      logger.error('Create user failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '创建用户失败', 400);
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const result = await this.userService.updateUser(req.params.id, req.body);
      return successResponse(res, result, '用户更新成功');
    } catch (error) {
      logger.error('Update user failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '更新用户失败');
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      await this.userService.deleteUser(req.params.id);
      return successResponse(res, null, '用户删除成功');
    } catch (error) {
      logger.error('Delete user failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '删除用户失败');
    }
  }

  async getUserOperations(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await this.userService.getUserOperations(req.params.id, page, pageSize);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get user operations failed:', error);
      return errorResponse(res, '获取用户操作日志失败');
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const result = await this.userService.getStats();
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get user stats failed:', error);
      return errorResponse(res, '获取用户统计失败');
    }
  }
}
