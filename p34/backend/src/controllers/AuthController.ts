import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async login(req: Request, res: Response) {
    try {
      const result = await this.authService.login(req.body);
      return successResponse(res, result, '登录成功');
    } catch (error) {
        console.log(error);
      logger.error('Login failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '登录失败', 401);
    }
  }

  async register(req: Request, res: Response) {
    try {
      const result = await this.authService.register(req.body);
      return successResponse(res, result, '注册成功');
    } catch (error) {
      logger.error('Registration failed:', error);
      return errorResponse(res, error instanceof Error ? error.message : '注册失败', 400);
    }
  }

  async getCurrentUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await this.authService.getCurrentUser(userId);
      return successResponse(res, result);
    } catch (error) {
      logger.error('Get current user failed:', error);
      return errorResponse(res, '获取用户信息失败', 500);
    }
  }
}
