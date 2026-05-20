const express = require('express');
const batchController = require('../controllers/batchController');
const { protect, requirePermission, requireRole } = require('../middleware/auth');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const router = express.Router();
router.use(protect);

router.get('/stats', requirePermission(PERMISSIONS.BATCH_READ), batchController.getBatchStats);
router.get('/expiry/warnings', requirePermission(PERMISSIONS.BATCH_READ), batchController.getExpiryWarnings);
router.get('/expiry/report', requirePermission(PERMISSIONS.BATCH_READ), batchController.getBatchExpiryReport);
router.get('/no/:batchNo', requirePermission(PERMISSIONS.BATCH_READ), batchController.getBatchByNo);
router.get('/', requirePermission(PERMISSIONS.BATCH_READ), batchController.getAllBatches);
router.get('/:id', requirePermission(PERMISSIONS.BATCH_READ), batchController.getBatchById);
router.post('/', requireRole(ROLES.ADMIN, ROLES.QUALITY_INSPECTOR), batchController.createBatch);
router.put('/:id', requireRole(ROLES.ADMIN, ROLES.QUALITY_INSPECTOR), batchController.updateBatch);
router.put('/:id/status', requireRole(ROLES.ADMIN, ROLES.QUALITY_INSPECTOR), batchController.updateBatchStatus);
router.put('/:id/expired', requireRole(ROLES.ADMIN, ROLES.QUALITY_INSPECTOR), batchController.markBatchExpired);
router.delete('/:id', requireRole(ROLES.ADMIN), batchController.deleteBatch);

module.exports = router;