const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/login', permissionController.login);
router.post('/register', permissionController.register);
router.get('/roles', authenticate, permissionController.getRoles);

router.get('/me', authenticate, permissionController.getCurrentUser);
router.put('/profile', authenticate, permissionController.updateProfile);
router.put('/change-password', authenticate, permissionController.changePassword);

router.get('/:id', authenticate, requireRole('admin'), permissionController.getUserById);
router.get('/', authenticate, requireRole('admin'), permissionController.getAllUsers);
router.put('/:id', authenticate, requireRole('admin'), permissionController.updateUser);
router.patch('/:id/status', authenticate, requireRole('admin'), permissionController.updateUserStatus);
router.delete('/:id', authenticate, requireRole('admin'), permissionController.deleteUser);

module.exports = router;
