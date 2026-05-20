const express = require('express');
const {
  register,
  login,
  getCurrentUser,
  updatePassword,
  getAllUsers,
  updateUser,
} = require('../controllers/authController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.post('/register', auth, authorize('管理员'), register);

router.get('/me', auth, getCurrentUser);
router.put('/update-password', auth, updatePassword);

router.get('/users', auth, authorize('管理员'), getAllUsers);
router.put('/users/:id', auth, authorize('管理员'), updateUser);

module.exports = router;