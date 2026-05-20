import { Router } from 'express';
import {
  getExpiringMaterials,
  getExpiredMaterials,
  getBatchMaterialExpiryWarning,
  getAlertStatistics
} from '../controllers/materialAlertController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/expiring', authenticate, getExpiringMaterials);
router.get('/expired', authenticate, getExpiredMaterials);
router.get('/batch/:batchId', authenticate, getBatchMaterialExpiryWarning);
router.get('/statistics', authenticate, getAlertStatistics);

export default router;
