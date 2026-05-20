const express = require('express');
const traceController = require('../controllers/traceController');
const { protect, requirePermission, requireRole } = require('../middleware/auth');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const router = express.Router();
router.use(protect);

router.get('/stats', requirePermission(PERMISSIONS.TRACE_READ), traceController.getStats);
router.get('/statistics', requirePermission(PERMISSIONS.TRACE_READ), traceController.getTraceStatistics);
router.post('/export', requirePermission(PERMISSIONS.TRACE_READ), traceController.exportTraceData);
router.post('/batch-verify', requirePermission(PERMISSIONS.TRACE_READ), traceController.batchVerifyChains);
router.post('/', requireRole(ROLES.ADMIN, ROLES.QUALITY_INSPECTOR), traceController.createRecord);
router.get('/batch/:batchId/full', requirePermission(PERMISSIONS.TRACE_READ), traceController.getFullTraceChain);
router.get('/batch/:batchId/verify', requirePermission(PERMISSIONS.TRACE_READ), traceController.verifyChain);
router.get('/batch/:batchId', requirePermission(PERMISSIONS.TRACE_READ), traceController.getRecordsByBatch);
router.get('/:id', requirePermission(PERMISSIONS.TRACE_READ), traceController.getRecordById);
router.put('/:id', requireRole(ROLES.ADMIN), traceController.updateRecord);

module.exports = router;