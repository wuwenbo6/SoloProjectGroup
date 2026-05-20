import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/process/User';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    realName: string;
    role: string;
    permissions: string[];
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lacquerware-traceability-2024-secret-key') as any;
    
    const user = await User.findOne({
      where: { userId: decoded.userId, status: 'active' }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '无效的认证令牌'
      });
    }

    req.user = {
      userId: user.userId,
      username: user.username,
      realName: user.realName,
      role: user.role,
      permissions: user.permissions
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '认证失败',
      error: (error as Error).message
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    next();
  };
};

export const requirePermission = (...permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }

    const hasPermission = permissions.some(perm => 
      req.user!.permissions.includes(perm) || req.user!.role === 'admin'
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: '缺少必要权限'
      });
    }

    next();
  };
};
