const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const { authenticate } = require('../middleware/auth');

router.get('/dashboard', authenticate, progressController.getProgressDashboard);
router.get('/production/:recordId', authenticate, progressController.getProductionProgress);
router.get('/batch/:batchId', authenticate, progressController.getBatchProgress);
router.get('/prop/:serialNumber', authenticate, progressController.getPropProgressBySerial);

module.exports = router;
