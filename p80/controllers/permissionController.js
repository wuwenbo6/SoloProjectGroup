const User = require('../models/restoration/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: '账号已被禁用' });
    }

    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    await user.update({ lastLoginAt: new Date() });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, realName: user.realName },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          realName: user.realName,
          email: user.email,
          role: user.role,
          department: user.department,
          title: user.title
        }
      }
    });
  } catch (error) {
    logger.error('登录失败:', error);
    res.status(500).json({ error: '登录失败', message: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { username, password, realName, email, role } = req.body;
    
    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const user = await User.create({
      username,
      password,
      realName,
      email,
      role: role || 'viewer'
    });

    res.status(201).json({
      message: '注册成功',
      data: { id: user.id, username: user.username, realName: user.realName }
    });
  } catch (error) {
    logger.error('注册失败:', error);
    res.status(500).json({ error: '注册失败', message: error.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.json({ data: user });
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败', message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { realName, email, phone, avatar } = req.body;
    const user = await User.findByPk(req.user.id);
    
    await user.update({ realName, email, phone, avatar });

    res.json({
      message: '更新成功',
      data: { id: user.id, username: user.username, realName: user.realName, email: user.email }
    });
  } catch (error) {
    logger.error('更新用户信息失败:', error);
    res.status(500).json({ error: '更新用户信息失败', message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);
    
    const isValid = await user.validatePassword(oldPassword);
    if (!isValid) {
      return res.status(400).json({ error: '原密码错误' });
    }

    await user.update({ password: newPassword });

    res.json({ message: '密码修改成功' });
  } catch (error) {
    logger.error('修改密码失败:', error);
    res.status(500).json({ error: '修改密码失败', message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status, keyword } = req.query;
    
    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (keyword) {
      where[require('sequelize').Op.or] = [
        { username: { [require('sequelize').Op.like]: `%${keyword}%` } },
        { realName: { [require('sequelize').Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      offset: (page - 1) * limit,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败', message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ data: user });
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败', message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { realName, email, phone, role, department, title, status, permissions } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    await user.update({ realName, email, phone, role, department, title, status, permissions });

    res.json({
      message: '更新成功',
      data: { id: user.id, username: user.username, realName: user.realName, role: user.role }
    });
  } catch (error) {
    logger.error('更新用户失败:', error);
    res.status(500).json({ error: '更新用户失败', message: error.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    await user.update({ status });

    res.json({
      message: '状态更新成功',
      data: { id: user.id, status: user.status }
    });
  } catch (error) {
    logger.error('更新用户状态失败:', error);
    res.status(500).json({ error: '更新用户状态失败', message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (user.username === 'admin') {
      return res.status(400).json({ error: '不能删除管理员账号' });
    }

    await user.destroy();

    res.json({ message: '用户删除成功' });
  } catch (error) {
    logger.error('删除用户失败:', error);
    res.status(500).json({ error: '删除用户失败', message: error.message });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const roles = [
      { code: 'admin', name: '管理员', description: '系统管理员，拥有所有权限' },
      { code: 'restorer', name: '修复师', description: '负责古籍修复工作' },
      { code: 'inspector', name: '质检员', description: '负责修复质量检查' },
      { code: 'archivist', name: '档案员', description: '负责修复档案管理' },
      { code: 'viewer', name: '访客', description: '仅可查看信息' }
    ];

    res.json({ data: roles });
  } catch (error) {
    logger.error('获取角色列表失败:', error);
    res.status(500).json({ error: '获取角色列表失败', message: error.message });
  }
};
