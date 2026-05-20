import { Router } from 'express';
import { createProductionRecord, getProductionRecordList, getProductionRecordDetail, updateProductionRecord, completeProductionStep } from '../controllers/productionController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, authorize('admin', 'artisan'), createProductionRecord);
router.get('/', authenticate, getProductionRecordList);
router.get('/:recordId', authenticate, getProductionRecordDetail);
router.put('/:recordId', authenticate, authorize('admin', 'artisan'), updateProductionRecord);
router.post('/:recordId/complete', authenticate, authorize('admin', 'artisan'), completeProductionStep);

export default router;
