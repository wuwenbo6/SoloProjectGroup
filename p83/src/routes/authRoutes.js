const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

router.post('/register',
  validateRequest(schemas.auth.register),
  authController.register
);

router.post('/login',
  validateRequest(schemas.auth.login),
  authController.login
);

router.post('/refresh',
  validateRequest(schemas.auth.refreshToken),
  authController.refreshToken
);

router.get('/me',
  authenticateToken,
  authController.getCurrentUser
);

router.post('/change-password',
  authenticateToken,
  validateRequest(schemas.auth.changePassword),
  authController.changePassword
);

router.post('/roles',
  authenticateToken,
  requirePermission('role:create'),
  authController.createRole
);

router.get('/roles',
  authenticateToken,
  requirePermission('role:read'),
  authController.getRoles
);

router.put('/roles/:id',
  authenticateToken,
  requirePermission('role:update'),
  authController.updateRole
);

router.delete('/roles/:id',
  authenticateToken,
  requirePermission('role:delete'),
  authController.deleteRole
);

module.exports = router;
