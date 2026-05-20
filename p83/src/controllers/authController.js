const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const User = require('../models/auth/User');
const Role = require('../models/auth/Role');

const register = async (req, res) => {
  try {
    const { username, email, password, name, phone, department, position } = req.body;

    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名或邮箱已存在',
        code: 'USER_EXISTS'
      });
    }

    const userId = uuidv4();
    const user = new User({
      userId,
      username,
      email,
      password,
      name,
      phone,
      department,
      position,
      status: 'active',
      permissions: [],
      createdBy: userId
    });

    await user.save();

    const accessToken = jwt.sign(
      { userId: user.userId, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = jwt.sign(
      { userId: user.userId },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      success: true,
      message: '用户注册成功',
      data: {
        user: {
          userId: user.userId,
          username: user.username,
          email: user.email,
          name: user.name,
          department: user.department,
          position: user.position,
          roles: user.roles,
          permissions: user.permissions,
          status: user.status
        },
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 60 * 60 * 24 * 7
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '用户注册失败',
      code: 'REGISTER_ERROR',
      error: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: '账号已被禁用',
        code: 'ACCOUNT_DISABLED'
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = jwt.sign(
      { userId: user.userId, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = jwt.sign(
      { userId: user.userId },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          userId: user.userId,
          username: user.username,
          email: user.email,
          name: user.name,
          department: user.department,
          position: user.position,
          roles: user.roles,
          permissions: user.permissions,
          status: user.status
        },
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 60 * 60 * 24 * 7
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '登录失败',
      code: 'LOGIN_ERROR',
      error: error.message
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '刷新令牌缺失',
        code: 'REFRESH_TOKEN_MISSING'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ userId: decoded.userId });
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已被禁用',
        code: 'USER_NOT_FOUND'
      });
    }

    const accessToken = jwt.sign(
      { userId: user.userId, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.userId },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: '令牌刷新成功',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: 60 * 60 * 24 * 7
      }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '刷新令牌已过期',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }
    return res.status(500).json({
      success: false,
      message: '刷新令牌失败',
      code: 'REFRESH_ERROR',
      error: error.message
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
        code: 'USER_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '获取用户信息成功',
      data: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        name: user.name,
        phone: user.phone,
        department: user.department,
        position: user.position,
        roles: user.roles,
        permissions: user.permissions,
        organization: user.organization,
        status: user.status,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
        code: 'USER_NOT_FOUND'
      });
    }

    const isPasswordValid = await user.comparePassword(oldPassword);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: '旧密码错误',
        code: 'INVALID_OLD_PASSWORD'
      });
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '密码修改失败',
      code: 'CHANGE_PASSWORD_ERROR',
      error: error.message
    });
  }
};

const createRole = async (req, res) => {
  try {
    const { name, code, description, permissions } = req.body;

    const existingRole = await Role.findOne({
      $or: [{ name }, { code }]
    });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: '角色名称或代码已存在',
        code: 'ROLE_EXISTS'
      });
    }

    const roleId = uuidv4();
    const role = new Role({
      roleId,
      name,
      code: code.toUpperCase(),
      description,
      permissions,
      createdBy: req.user.userId,
      updatedBy: req.user.userId
    });

    await role.save();

    return res.status(201).json({
      success: true,
      message: '角色创建成功',
      data: role
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '创建角色失败',
      code: 'CREATE_ROLE_ERROR',
      error: error.message
    });
  }
};

const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({}).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: '获取角色列表成功',
      data: roles
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取角色列表失败',
      code: 'FETCH_ROLES_ERROR',
      error: error.message
    });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const role = await Role.findOne({ roleId: id });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: '角色不存在',
        code: 'ROLE_NOT_FOUND'
      });
    }

    if (role.isSystem) {
      return res.status(403).json({
        success: false,
        message: '系统角色不可修改',
        code: 'SYSTEM_ROLE_NOT_EDITABLE'
      });
    }

    if (name) role.name = name;
    if (description !== undefined) role.description = description;
    if (permissions) role.permissions = permissions;
    role.updatedBy = req.user.userId;

    await role.save();

    return res.status(200).json({
      success: true,
      message: '角色更新成功',
      data: role
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '更新角色失败',
      code: 'UPDATE_ROLE_ERROR',
      error: error.message
    });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findOne({ roleId: id });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: '角色不存在',
        code: 'ROLE_NOT_FOUND'
      });
    }

    if (role.isSystem) {
      return res.status(403).json({
        success: false,
        message: '系统角色不可删除',
        code: 'SYSTEM_ROLE_NOT_DELETABLE'
      });
    }

    await Role.findOneAndDelete({ roleId: id });

    return res.status(200).json({
      success: true,
      message: '角色删除成功'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '删除角色失败',
      code: 'DELETE_ROLE_ERROR',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getCurrentUser,
  changePassword,
  createRole,
  getRoles,
  updateRole,
  deleteRole
};
