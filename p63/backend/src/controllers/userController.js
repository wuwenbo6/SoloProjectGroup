const User = require('../models/User');
const { ROLES } = require('../middleware/auth');

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const query = {};

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: '获取用户列表失败', error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: '获取用户信息失败', error: error.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ message: '无效的角色' });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: '不能修改自己的角色' });
    }

    user.role = role;
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({ message: '角色更新成功', user: userResponse });
  } catch (error) {
    res.status(500).json({ message: '更新角色失败', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { username, email, avatar } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    if (user._id.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ message: '无权修改其他用户信息' });
    }

    if (username) {
      const existingUser = await User.findOne({ username, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ message: '用户名已存在' });
      }
      user.username = username;
    }

    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ message: '邮箱已存在' });
      }
      user.email = email;
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
    }

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({ message: '用户信息更新成功', user: userResponse });
  } catch (error) {
    res.status(500).json({ message: '更新用户信息失败', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: '不能删除自己的账户' });
    }

    if (user.role === ROLES.ADMIN) {
      return res.status(400).json({ message: '不能删除管理员账户' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: '用户删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除用户失败', error: error.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: '获取用户信息失败', error: error.message });
  }
};

exports.getRolePermissions = async (req, res) => {
  try {
    const rolePermissions = {
      [ROLES.USER]: {
        canCreate: true,
        canView: true,
        canEdit: true,
        canDelete: false,
        canConfirm: false,
        canManageUsers: false,
        canManageCollaborators: false,
        canViewStatistics: false,
        canExport: false
      },
      [ROLES.EDITOR]: {
        canCreate: true,
        canView: true,
        canEdit: true,
        canDelete: false,
        canConfirm: true,
        canManageUsers: false,
        canManageCollaborators: false,
        canViewStatistics: true,
        canExport: true
      },
      [ROLES.ADMIN]: {
        canCreate: true,
        canView: true,
        canEdit: true,
        canDelete: true,
        canConfirm: true,
        canManageUsers: true,
        canManageCollaborators: true,
        canViewStatistics: true,
        canExport: true
      }
    };

    res.json({
      userRole: req.user.role,
      permissions: rolePermissions[req.user.role]
    });
  } catch (error) {
    res.status(500).json({ message: '获取权限失败', error: error.message });
  }
};
