import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { User } from '../models/User';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { signToken } from '../../../shared/middleware/auth';
import logger from '../../../shared/middleware/logger';

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string()
    .valid('admin', 'material_manager', 'collector', 'inspector', 'batch_manager', 'third_party')
    .required(),
});

export const login = async (req: Request, res: Response) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const { username, password } = value;

    const user = await User.findOne({
      where: { username, isActive: true },
    });

    if (!user) {
      return res.status(401).json(errorResponse('用户名或密码错误', 401));
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json(errorResponse('用户名或密码错误', 401));
    }

    const token = signToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });

    logger.info(`User ${username} logged in successfully`);

    res.json(
      successResponse({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      })
    );
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json(errorResponse('登录失败', 500));
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }

    const { username, email, password, role } = value;

    const existingUser = await User.findOne({
      where: { username },
    });

    if (existingUser) {
      return res.status(409).json(errorResponse('用户名已存在', 409));
    }

    const existingEmail = await User.findOne({
      where: { email },
    });

    if (existingEmail) {
      return res.status(409).json(errorResponse('邮箱已被注册', 409));
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      passwordHash,
      role,
    });

    logger.info(`User ${username} registered successfully`);

    res.status(201).json(
      successResponse({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      })
    );
  } catch (err) {
    logger.error('Registration error:', err);
    res.status(500).json(errorResponse('注册失败', 500));
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json(errorResponse('未认证', 401));
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json(errorResponse('用户不存在', 404));
    }

    res.json(
      successResponse({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      })
    );
  } catch (err) {
    logger.error('Get current user error:', err);
    res.status(500).json(errorResponse('获取用户信息失败', 500));
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json(errorResponse('未认证', 401));
    }

    const token = signToken({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
    });

    res.json(successResponse({ token }));
  } catch (err) {
    logger.error('Refresh token error:', err);
    res.status(500).json(errorResponse('刷新令牌失败', 500));
  }
};
