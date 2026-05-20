const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Rubbing = require('../models/Rubbing');

const ROLES = {
  USER: 'user',
  EDITOR: 'editor',
  ADMIN: 'admin'
};

const PERMISSIONS = {
  CREATE_RUBBING: [ROLES.USER, ROLES.EDITOR, ROLES.ADMIN],
  VIEW_RUBBING: [ROLES.USER, ROLES.EDITOR, ROLES.ADMIN],
  EDIT_RUBBING: [ROLES.EDITOR, ROLES.ADMIN],
  DELETE_RUBBING: [ROLES.ADMIN],
  INTERPRET_CHARACTER: [ROLES.USER, ROLES.EDITOR, ROLES.ADMIN],
  CONFIRM_INTERPRETATION: [ROLES.EDITOR, ROLES.ADMIN],
  MANAGE_COLLABORATORS: [ROLES.ADMIN],
  MANAGE_USERS: [ROLES.ADMIN],
  VIEW_STATISTICS: [ROLES.EDITOR, ROLES.ADMIN],
  EXPORT_DATA: [ROLES.EDITOR, ROLES.ADMIN]
};

const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: '用户未认证' });
    }

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      return res.status(403).json({ message: '权限未定义' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: '权限不足',
        requiredRole: allowedRoles[0],
        userRole: req.user.role
      });
    }

    next();
  };
};

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: '未提供认证令牌' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }

    if (!user.role || !Object.values(ROLES).includes(user.role)) {
      return res.status(403).json({ message: '用户角色无效' });
    }

    user.lastActive = new Date();
    await user.save();
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: '认证失败', error: error.message });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: '用户未认证' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: '权限不足',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }
    next();
  };
};

const checkRubbingAccess = (accessType = 'view') => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const rubbing = await Rubbing.findById(id);
      
      if (!rubbing) {
        return res.status(404).json({ message: '拓片不存在' });
      }

      if (req.user.role === ROLES.ADMIN) {
        req.rubbing = rubbing;
        return next();
      }

      const isOwner = rubbing.uploadedBy.toString() === req.user._id.toString();
      const isCollaborator = rubbing.collaborators.some(
        c => c.toString() === req.user._id.toString()
      );

      if (accessType === 'view') {
        if (!isOwner && !isCollaborator) {
          return res.status(403).json({ message: '您没有访问此拓片的权限' });
        }
      } else if (accessType === 'edit') {
        if (!isOwner && !isCollaborator) {
          return res.status(403).json({ message: '您没有编辑此拓片的权限' });
        }
      } else if (accessType === 'delete') {
        if (!isOwner && req.user.role !== ROLES.ADMIN) {
          return res.status(403).json({ message: '您没有删除此拓片的权限' });
        }
      } else if (accessType === 'manage') {
        if (!isOwner && req.user.role !== ROLES.ADMIN) {
          return res.status(403).json({ message: '您没有管理此拓片协作者的权限' });
        }
      }

      req.rubbing = rubbing;
      next();
    } catch (error) {
      res.status(500).json({ message: '权限检查失败', error: error.message });
    }
  };
};

const rateLimitByRole = () => {
  const limits = {
    [ROLES.USER]: 100,
    [ROLES.EDITOR]: 500,
    [ROLES.ADMIN]: 1000
  };

  return (req, res, next) => {
    const limit = limits[req.user?.role] || 50;
    req.rateLimit = limit;
    next();
  };
};

module.exports = {
  auth,
  requireRole,
  checkPermission,
  checkRubbingAccess,
  rateLimitByRole,
  ROLES,
  PERMISSIONS
};
