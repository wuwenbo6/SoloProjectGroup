import { Router } from 'express';
import { createBatch, getBatchList, getBatchDetail, updateBatch, startBatch, completeBatch } from '../controllers/batchController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, authorize('admin', 'supervisor'), createBatch);
router.get('/', authenticate, getBatchList);
router.get('/:batchId', authenticate, getBatchDetail);
router.put('/:batchId', authenticate, authorize('admin', 'supervisor'), updateBatch);
router.post('/:batchId/start', authenticate, authorize('admin', 'supervisor'), startBatch);
router.post('/:batchId/complete', authenticate, authorize('admin', 'supervisor'), completeBatch);

export default router;
