const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/refresh-token', authenticate, authController.refreshToken);
router.put('/permissions', authenticate, authorize('admin'), authController.updatePermissions);

module.exports = router;
