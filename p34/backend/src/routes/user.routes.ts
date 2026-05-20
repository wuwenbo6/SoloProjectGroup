import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const userController = new UserController();

router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

router.get('/', (req, res) => userController.getAllUsers(req, res));
router.get('/stats', (req, res) => userController.getStats(req, res));
router.get('/:id', (req, res) => userController.getUserById(req, res));
router.post('/', (req, res) => userController.createUser(req, res));
router.put('/:id', (req, res) => userController.updateUser(req, res));
router.delete('/:id', (req, res) => userController.deleteUser(req, res));
router.get('/:id/operations', (req, res) => userController.getUserOperations(req, res));

export default router;
