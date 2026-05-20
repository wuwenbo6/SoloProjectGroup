import { Router } from 'express';
import { ImageProcessingController } from '../controllers/ImageProcessingController';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
const controller = new ImageProcessingController();

router.post('/color/adjust', authenticateToken, (req, res) => controller.adjustColor(req, res));
router.post('/style/filter', authenticateToken, (req, res) => controller.applyStyleFilter(req, res));
router.post('/export/pattern/:patternId', authenticateToken, (req, res) => controller.exportPattern(req, res));
router.post('/export/batch', authenticateToken, (req, res) => controller.batchExport(req, res));
router.post('/search/image', authenticateToken, upload.single('image'), (req, res) => controller.searchByImage(req, res));
router.get('/search/material/:materialId', authenticateToken, (req, res) => controller.searchByMaterial(req, res));
router.get('/related/:materialId', authenticateToken, (req, res) => controller.getRelatedMaterials(req, res));
router.post('/features/rebuild', authenticateToken, (req, res) => controller.rebuildFeatureVectors(req, res));

export default router;
