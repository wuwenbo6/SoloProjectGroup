const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/detect', authenticate, authorize('admin', 'manager', 'operator'), alertController.createAlerts);
router.post('/manual', authenticate, authorize('admin', 'manager', 'inspector'), alertController.createManualAlert);
router.get('/', authenticate, alertController.getAlerts);
router.get('/summary', authenticate, alertController.getAlertSummary);
router.get('/:id', authenticate, alertController.getAlertById);
router.put('/acknowledge', authenticate, authorize('admin', 'manager', 'inspector'), alertController.acknowledgeAlert);
router.put('/resolve', authenticate, authorize('admin', 'manager'), alertController.resolveAlert);
router.put('/ignore', authenticate, authorize('admin', 'manager'), alertController.ignoreAlert);

module.exports = router;
