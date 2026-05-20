const jwt = require('jsonwebtoken');
const User = require('../models/auth/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

exports.register = async (req, res) => {
  try {
    const { username, password, name, email, phone, role, department } = req.body;

    const userExists = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: '用户名或邮箱已存在',
      });
    }

    const permissions = getPermissionsByRole(role);

    const user = await User.create({
      username,
      password,
      name,
      email,
      phone,
      role,
      department,
      permissions,
      createdBy: req.user ? req.user._id : null,
    });

    user.password = undefined;

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '注册失败',
      error: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供用户名和密码',
      });
    }

    const user = await User.findOne({ username }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }

    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }

    if (user.status !== '正常') {
      return res.status(401).json({
        success: false,
        message: '账号已被禁用',
      });
    }

    user.lastLogin = Date.now();
    await user.save();

    const token = generateToken(user._id);

    user.password = undefined;

    res.status(200).json({
      success: true,
      token,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: error.message,
    });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      error: error.message,
    });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    const isPasswordMatch = await user.comparePassword(oldPassword);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: '旧密码错误',
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: '密码更新成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新密码失败',
      error: error.message,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (status) query.status = status;

    const users = await User.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取用户列表失败',
      error: error.message,
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, department, status } = req.body;

    const updateData = { name, email, phone, department, status };
    
    if (role) {
      updateData.role = role;
      updateData.permissions = getPermissionsByRole(role);
    }

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新用户失败',
      error: error.message,
    });
  }
};

function getPermissionsByRole(role) {
  const rolePermissions = {
    '管理员': ['craft:create', 'craft:read', 'craft:update', 'craft:delete', 'production:create', 'production:read', 'production:update', 'production:delete', 'quality:create', 'quality:read', 'quality:update', 'quality:delete', 'batch:create', 'batch:read', 'batch:update', 'batch:delete', 'thirdparty:sync', 'user:create', 'user:read', 'user:update', 'user:delete'],
    '工艺师': ['craft:create', 'craft:read', 'craft:update', 'production:read'],
    '操作员': ['production:create', 'production:read', 'production:update', 'batch:read'],
    '质检员': ['quality:create', 'quality:read', 'quality:update', 'production:read', 'batch:read'],
    '第三方机构': ['quality:read', 'thirdparty:sync'],
  };

  return rolePermissions[role] || [];
}