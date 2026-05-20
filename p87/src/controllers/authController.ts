import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import User from '../models/process/User';
import { AuthRequest } from '../middleware/auth';

const generateToken = (user: any) => {
  return jwt.sign(
    {
      userId: user.userId,
      username: user.username,
      role: user.role
    },
    process.env.JWT_SECRET || 'lacquerware-traceability-2024-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

export const login = async (req: Request, res: Response) => {
  try {
    const schema = Joi.object({
      username: Joi.string().required(),
      password: Joi.string().required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const { username, password } = req.body;

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: '账户已被禁用'
      });
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          userId: user.userId,
          username: user.username,
          realName: user.realName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          permissions: user.permissions,
          department: user.department
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: (error as Error).message
    });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const schema = Joi.object({
      username: Joi.string().min(3).max(50).required(),
      password: Joi.string().min(6).required(),
      realName: Joi.string().required(),
      email: Joi.string().email().optional(),
      phone: Joi.string().optional(),
      role: Joi.string().valid('admin', 'artisan', 'inspector', 'supervisor', 'viewer').required(),
      department: Joi.string().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        error: error.details[0].message
      });
    }

    const existingUser = await User.findOne({ where: { username: req.body.username } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }

    const userId = `U${Date.now()}`;
    const user = await User.create({
      ...req.body,
      userId,
      permissions: []
    });

    res.status(201).json({
      success: true,
      message: '用户注册成功',
      data: {
        userId: user.userId,
        username: user.username,
        realName: user.realName,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '注册失败',
      error: (error as Error).message
    });
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({
      where: { userId: req.user?.userId },
      attributes: { exclude: ['password'] }
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      error: (error as Error).message
    });
  }
};

export const refreshToken = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ where: { userId: req.user?.userId } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: '令牌刷新成功',
      data: { token }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '刷新令牌失败',
      error: (error as Error).message
    });
  }
};
