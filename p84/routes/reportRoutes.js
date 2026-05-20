const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/stats', authenticate, reportController.getReportStats);
router.get('/process', authenticate, reportController.exportProcessTemplates);
router.get('/production', authenticate, reportController.exportProductionRecords);
router.get('/quality', authenticate, reportController.exportQualityReports);
router.get('/batches', authenticate, reportController.exportBatchReports);
router.get('/alerts', authenticate, reportController.exportAlertReports);

module.exports = router;
