import { Router } from 'express';
import {
  exportCraftProcesses,
  exportBatchProduction,
  exportQualityReport,
  exportFullTraceability
} from '../controllers/exportController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/crafts', authenticate, exportCraftProcesses);
router.get('/production', authenticate, exportBatchProduction);
router.get('/quality', authenticate, exportQualityReport);
router.get('/traceability/:batchId', authenticate, exportFullTraceability);

export default router;
