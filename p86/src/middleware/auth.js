const jwt = require('jsonwebtoken');
const User = require('../models/auth/User');

const auth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在',
      });
    }

    if (user.status !== '正常') {
      return res.status(401).json({
        success: false,
        message: '用户账号已被禁用',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '认证令牌无效或已过期',
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `角色 '${req.user.role}' 无权限访问此资源`,
      });
    }
    next();
  };
};

const hasPermission = (...permissions) => {
  return (req, res, next) => {
    const hasAllPermissions = permissions.every(perm => 
      req.user.permissions.includes(perm)
    );
    
    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        message: '缺少必要的操作权限',
      });
    }
    next();
  };
};

module.exports = {
  auth,
  authorize,
  hasPermission,
};