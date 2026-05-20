import { Router } from 'express';
import {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  getBatchTrace,
  getStatistics,
  getExpiryWarnings,
  markWarningSent,
} from './controllers/batchController';
import { authenticateToken, requireRoles } from '../../shared/middleware/auth';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'batch' }));

router.use(authenticateToken);

router.get('/', getBatches);
router.get('/statistics', getStatistics);
router.get('/expiry-warnings', getExpiryWarnings);
router.get('/:id', getBatchById);
router.get('/trace/:batchNo', getBatchTrace);
router.post('/', requireRoles('batch_manager', 'admin'), createBatch);
router.put('/:id', requireRoles('batch_manager', 'admin'), updateBatch);
router.post('/:id/mark-warning-sent', requireRoles('batch_manager', 'admin'), markWarningSent);

export default router;
