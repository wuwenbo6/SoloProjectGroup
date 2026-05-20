import { Router } from 'express';
import { createMaterial, getMaterialList, getMaterialDetail, updateMaterial } from '../controllers/materialController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, authorize('admin', 'supervisor'), createMaterial);
router.get('/', authenticate, getMaterialList);
router.get('/:materialId', authenticate, getMaterialDetail);
router.put('/:materialId', authenticate, authorize('admin', 'supervisor'), updateMaterial);

export default router;
