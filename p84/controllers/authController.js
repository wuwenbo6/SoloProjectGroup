const jwt = require('jsonwebtoken');
const User = require('../models/auth/User');
const logger = require('../config/logger');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

const register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名或邮箱已存在'
      });
    }

    const user = new User({
      username,
      email,
      password,
      role: role || 'viewer',
      permissions: []
    });

    await user.save();

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: '用户注册成功',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.error('注册失败:', error);
    res.status(500).json({
      success: false,
      message: '注册失败',
      error: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: '账户已被禁用'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        }
      }
    });
  } catch (error) {
    logger.error('登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: error.message
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      error: error.message
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
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
    logger.error('刷新令牌失败:', error);
    res.status(500).json({
      success: false,
      message: '刷新令牌失败',
      error: error.message
    });
  }
};

const updatePermissions = async (req, res) => {
  try {
    const { userId, permissions } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    user.permissions = permissions;
    await user.save();

    res.json({
      success: true,
      message: '权限更新成功',
      data: { permissions: user.permissions }
    });
  } catch (error) {
    logger.error('更新权限失败:', error);
    res.status(500).json({
      success: false,
      message: '更新权限失败',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  refreshToken,
  updatePermissions
};
