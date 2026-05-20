const jwt = require('jsonwebtoken');
const { AppError } = require('../../../../shared/utils/errorHandler');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('未提供认证令牌', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role || 'consumer',
      permissions: decoded.permissions || []
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('无效的认证令牌', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('认证令牌已过期', 401));
    }
    next(error);
  }
};

const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('未授权访问', 403));
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.every(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      return next(new AppError('权限不足', 403));
    }

    next();
  };
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('未授权访问', 403));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('角色权限不足', 403));
    }

    next();
  };
};

module.exports = {
  protect,
  requirePermission,
  requireRole
};
