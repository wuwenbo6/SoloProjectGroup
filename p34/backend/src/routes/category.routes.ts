import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const categoryController = new CategoryController();

router.get('/', (req, res) => categoryController.getAllCategories(req, res));
router.get('/:id', (req, res) => categoryController.getCategoryById(req, res));

router.use(authenticateToken);
router.use(requireRole(['ADMIN', 'DESIGNER']));
router.post('/', (req, res) => categoryController.createCategory(req, res));
router.put('/:id', (req, res) => categoryController.updateCategory(req, res));
router.delete('/:id', (req, res) => categoryController.deleteCategory(req, res));

export default router;
