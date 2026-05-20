const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Role = require('../models/Role');
const ApiResponse = require('../../../../shared/utils/response');
const { catchAsync, AppError } = require('../../../../shared/utils/errorHandler');
const { PERMISSIONS, ROLES } = require('../../../../shared/constants');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN)
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id);
  const expiresIn = parseInt(process.env.JWT_EXPIRES_IN);

  user.password = undefined;

  ApiResponse.success(res, {
    token,
    expiresIn,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role ? user.role.name : null
    }
  }, '登录成功', statusCode);
};

const validateLogin = [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空')
];

const login = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ApiResponse.badRequest(res, '参数验证失败', errors.array());
  }

  const { username, password } = req.body;

  const user = await User.findOne({
    where: { username },
    include: [{ model: Role, as: 'role' }]
  });

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('用户名或密码错误', 401));
  }

  if (user.status !== 'active') {
    return next(new AppError('账户已被禁用，请联系管理员', 401));
  }

  createSendToken(user, 200, res);
});

const register = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ApiResponse.badRequest(res, '参数验证失败', errors.array());
  }

  const { username, password, email, phone, roleName } = req.body;

  const existingUser = await User.findOne({ where: { username } });
  if (existingUser) {
    return next(new AppError('用户名已存在', 409));
  }

  const role = await Role.findOne({ where: { name: roleName || ROLES.CONSUMER } });
  if (!role) {
    return next(new AppError('角色不存在', 400));
  }

  const user = await User.create({
    username,
    password,
    email,
    phone,
    role_id: role.id
  });

  user.password = undefined;

  ApiResponse.created(res, {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: role.name
  }, '用户注册成功');
});

const validateRegister = [
  body('username').isLength({ min: 3, max: 50 }).withMessage('用户名长度应在3-50字符之间'),
  body('password').isLength({ min: 6 }).withMessage('密码长度至少为6字符'),
  body('email').optional().isEmail().withMessage('邮箱格式不正确')
];

const getCurrentUser = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.user.id, {
    include: [{ model: Role, as: 'role' }],
    attributes: { exclude: ['password'] }
  });

  ApiResponse.success(res, user);
});

const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findByPk(req.user.id);

  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('当前密码错误', 401));
  }

  user.password = newPassword;
  await user.save();

  ApiResponse.success(res, null, '密码修改成功');
});

const validateToken = catchAsync(async (req, res, next) => {
  ApiResponse.success(res, {
    valid: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role.name,
      permissions: req.user.role.permissions
    }
  });
});

module.exports = {
  login,
  register,
  getCurrentUser,
  changePassword,
  validateToken,
  validateLogin,
  validateRegister
};
