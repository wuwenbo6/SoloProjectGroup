import { Router } from 'express';
import { login, register, getCurrentUser, refreshToken } from './controllers/authController';
import { authenticateToken } from '../../shared/middleware/auth';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth' }));
router.post('/login', login);
router.post('/register', register);
router.get('/me', authenticateToken, getCurrentUser);
router.post('/refresh', authenticateToken, refreshToken);

export default router;
