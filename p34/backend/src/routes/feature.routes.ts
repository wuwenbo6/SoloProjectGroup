import { Router } from 'express';
import { FeatureController } from '../controllers/FeatureController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const featureController = new FeatureController();

router.get('/', (req, res) => featureController.getFeatures(req, res));
router.get('/stats', (req, res) => featureController.getStats(req, res));
router.get('/material/:materialId', (req, res) => featureController.getFeatureByMaterial(req, res));

router.use(authenticateToken);
router.post('/extract', (req, res) => featureController.extractFeatures(req, res));
router.get('/me/list', (req, res) => featureController.getMyFeatures(req, res));

export default router;
