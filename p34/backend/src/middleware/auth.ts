import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../config/database';
import { AuthenticatedRequest, JwtPayload } from '../types';
import logger from '../utils/logger';

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { permissions: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: '用户账户已被禁用' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    return res.status(401).json({ success: false, message: '无效的认证令牌' });
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '未授权访问' });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Permission denied: User ${req.user.username} (${req.user.role}) tried to access resource requiring ${roles.join(',')}`);
      return res.status(403).json({ success: false, message: '权限不足' });
    }

    next();
  };
}

export function requireAnyPermission(permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '未授权访问' });
    }

    if (req.user.role === 'ADMIN') {
      return next();
    }

    const hasPermission = req.user.permissions?.some(
      (p) => permissions.includes(p.name) && p.enabled
    );

    if (!hasPermission) {
      logger.warn(`Permission denied: User ${req.user.username} lacks required permissions`);
      return res.status(403).json({ success: false, message: '权限不足' });
    }

    next();
  };
}
