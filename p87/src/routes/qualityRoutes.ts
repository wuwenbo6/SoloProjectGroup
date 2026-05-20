import { Router } from 'express';
import { createQualityInspection, getQualityInspectionList, getQualityInspectionDetail, updateQualityInspection } from '../controllers/qualityController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, authorize('admin', 'inspector'), createQualityInspection);
router.get('/', authenticate, getQualityInspectionList);
router.get('/:inspectionId', authenticate, getQualityInspectionDetail);
router.put('/:inspectionId', authenticate, authorize('admin', 'inspector'), updateQualityInspection);

export default router;
