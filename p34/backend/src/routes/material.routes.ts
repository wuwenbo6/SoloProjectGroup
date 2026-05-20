import { Router } from 'express';
import { MaterialController } from '../controllers/MaterialController';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
const materialController = new MaterialController();

router.get('/', (req, res) => materialController.getMaterials(req, res));
router.get('/stats', (req, res) => materialController.getStats(req, res));
router.get('/:id', (req, res) => materialController.getMaterialById(req, res));

router.use(authenticateToken);
router.post('/', upload.single('image'), (req, res) => materialController.uploadMaterial(req, res));
router.get('/me/list', (req, res) => materialController.getMyMaterials(req, res));
router.put('/:id', (req, res) => materialController.updateMaterial(req, res));
router.delete('/:id', (req, res) => materialController.deleteMaterial(req, res));

export default router;
