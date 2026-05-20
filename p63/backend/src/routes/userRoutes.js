const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth, requireRole, ROLES } = require('../middleware/auth');

router.get('/me', 
  auth, 
  userController.getCurrentUser
);

router.get('/permissions', 
  auth, 
  userController.getRolePermissions
);

router.get('/', 
  auth, 
  requireRole(ROLES.ADMIN), 
  userController.getUsers
);

router.get('/:id', 
  auth, 
  requireRole(ROLES.ADMIN), 
  userController.getUserById
);

router.put('/:id', 
  auth, 
  userController.updateUser
);

router.put('/:id/role', 
  auth, 
  requireRole(ROLES.ADMIN), 
  userController.updateUserRole
);

router.delete('/:id', 
  auth, 
  requireRole(ROLES.ADMIN), 
  userController.deleteUser
);

module.exports = router;
