const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { generateToken } = require('../../../shared/middleware/auth');
const { successResponse, errorResponse, paginatedResponse } = require('../../../shared/utils/response');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');

let userModel, apiKeyModel;

const initModels = (pool) => {
  userModel = new User(pool);
  apiKeyModel = new ApiKey(pool);
};

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'manager', 'user').default('user')
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

const register = async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return errorResponse(res, '参数验证失败', 400, error.details);
    }

    const existingUser = await userModel.findByUsername(value.username);
    if (existingUser) {
      return errorResponse(res, '用户名已存在', 409);
    }

    const existingEmail = await userModel.findByEmail(value.email);
    if (existingEmail) {
      return errorResponse(res, '邮箱已被注册', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(value.password, salt);

    const user = await userModel.create({
      username: value.username,
      email: value.email,
      password_hash,
      role: value.role
    });

    successResponse(res, user, '用户注册成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return errorResponse(res, '参数验证失败', 400, error.details);
    }

    const user = await userModel.findByUsername(value.username);
    if (!user) {
      return errorResponse(res, '用户名或密码错误', 401);
    }

    const isValidPassword = await bcrypt.compare(value.password, user.password_hash);
    if (!isValidPassword) {
      return errorResponse(res, '用户名或密码错误', 401);
    }

    const token = generateToken(user);

    successResponse(res, {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    }, '登录成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    successResponse(res, user, '获取用户信息成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const validateApiKey = async (req, res) => {
  try {
    const { api_key } = req.body;
    if (!api_key) {
      return errorResponse(res, 'API Key 不能为空', 400);
    }

    const apiKey = await apiKeyModel.validateKey(api_key);
    if (!apiKey) {
      return errorResponse(res, 'API Key 无效或已过期', 401);
    }

    successResponse(res, {
      service_name: apiKey.service_name,
      permissions: apiKey.permissions
    }, 'API Key 验证成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const createApiKey = async (req, res) => {
  try {
    const apiKey = await apiKeyModel.create(req.body);
    successResponse(res, apiKey, 'API Key 创建成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getApiKeys = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await apiKeyModel.findAll(page, limit);
    paginatedResponse(res, result.apiKeys, page, limit, result.total, '获取API Key列表成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const revokeApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await apiKeyModel.revoke(id);
    if (success) {
      successResponse(res, null, 'API Key 已撤销');
    } else {
      errorResponse(res, 'API Key 不存在', 404);
    }
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await userModel.findAll(page, limit);
    paginatedResponse(res, result.users, page, limit, result.total, '获取用户列表成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

module.exports = {
  initModels,
  register,
  login,
  getCurrentUser,
  validateApiKey,
  createApiKey,
  getApiKeys,
  revokeApiKey,
  getUsers
};
