const jwt = require('jsonwebtoken');
const User = require('../models/auth/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '访问令牌缺失',
        code: 'TOKEN_MISSING'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findOne({ userId: decoded.userId });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: '用户账号已被禁用',
        code: 'USER_INACTIVE'
      });
    }

    if (decoded.iat && user.passwordChangedAt) {
      const passwordChangedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      if (decoded.iat < passwordChangedTimestamp) {
        return res.status(401).json({
          success: false,
          message: '密码已修改，请重新登录',
          code: 'PASSWORD_CHANGED'
        });
      }
    }

    req.user = {
      userId: user.userId,
      username: user.username,
      email: user.email,
      name: user.name,
      roles: user.roles,
      permissions: user.permissions,
      organization: user.organization
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '访问令牌已过期',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '无效的访问令牌',
        code: 'INVALID_TOKEN'
      });
    }
    return res.status(500).json({
      success: false,
      message: '认证失败',
      code: 'AUTH_ERROR',
      error: error.message
    });
  }
};

const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证',
        code: 'UNAUTHORIZED'
      });
    }

    const userPermissions = req.user.permissions || [];
    
    if (userPermissions.includes('*') || userPermissions.includes(requiredPermission)) {
      return next();
    }

    const hasRolePermission = req.user.roles && req.user.roles.some(role => {
      return requiredPermission.startsWith(role.toLowerCase() + ':');
    });

    if (hasRolePermission) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: '权限不足，无法执行此操作',
      code: 'PERMISSION_DENIED',
      requiredPermission
    });
  };
};

const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证',
        code: 'UNAUTHORIZED'
      });
    }

    const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    const userRoles = req.user.roles || [];
    
    const hasRequiredRole = rolesArray.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      return res.status(403).json({
        success: false,
        message: '需要特定角色权限',
        code: 'ROLE_REQUIRED',
        requiredRoles
      });
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ userId: decoded.userId });
    
    if (user && user.status === 'active') {
      req.user = {
        userId: user.userId,
        username: user.username,
        email: user.email,
        name: user.name,
        roles: user.roles,
        permissions: user.permissions,
        organization: user.organization
      };
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole,
  optionalAuth
};
