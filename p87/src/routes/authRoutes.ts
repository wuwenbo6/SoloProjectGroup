import { Router } from 'express';
import { login, register, getCurrentUser, refreshToken } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.get('/me', authenticate, getCurrentUser);
router.post('/refresh', authenticate, refreshToken);

export default router;
