import { Router } from 'express';
import { syncThirdPartyReport, getThirdPartyReportList, getThirdPartyReportDetail, createThirdPartyReport, getTraceabilityChain } from '../controllers/thirdPartyController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/sync', authenticate, authorize('admin', 'inspector'), syncThirdPartyReport);
router.get('/', authenticate, getThirdPartyReportList);
router.get('/:reportId', authenticate, getThirdPartyReportDetail);
router.post('/', authenticate, authorize('admin', 'inspector'), createThirdPartyReport);
router.get('/traceability/:batchId', authenticate, getTraceabilityChain);

export default router;
