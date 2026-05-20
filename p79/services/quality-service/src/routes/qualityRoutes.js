const express = require('express');
const qualityController = require('../controllers/qualityController');
const { protect, requirePermission, requireRole } = require('../middleware/auth');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const router = express.Router();
router.use(protect);

router.get('/stats', requirePermission(PERMISSIONS.QUALITY_READ), qualityController.getStats);
router.get('/standards', requirePermission(PERMISSIONS.QUALITY_READ), qualityController.getStandards);
router.post('/standards', requireRole(ROLES.ADMIN), qualityController.createStandard);
router.post('/evaluate', requireRole(ROLES.ADMIN, ROLES.QUALITY_INSPECTOR), qualityController.evaluate);
router.get('/reports', requirePermission(PERMISSIONS.QUALITY_READ), qualityController.getAllReports);
router.get('/reports/batch/:batchId', requirePermission(PERMISSIONS.QUALITY_READ), qualityController.getReportsByBatch);
router.get('/reports/:id', requirePermission(PERMISSIONS.QUALITY_READ), qualityController.getReportById);
router.put('/reports/:id/approve', requireRole(ROLES.ADMIN), qualityController.approveReport);

module.exports = router;