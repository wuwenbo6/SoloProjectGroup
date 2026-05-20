const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/statistics', authenticate, alertController.getAlertStatistics);
router.get('/my', authenticate, alertController.getMyAlerts);
router.get('/book/:bookId', authenticate, alertController.getAlertsByBookId);
router.get('/:id', authenticate, alertController.getAlertById);
router.get('/', authenticate, alertController.getAllAlerts);

router.post('/', authenticate, requireRole('admin', 'restorer', 'inspector'), alertController.createAlert);
router.post('/check', authenticate, requireRole('admin', 'restorer'), alertController.checkAndGenerateAlerts);
router.put('/:id', authenticate, requireRole('admin', 'restorer'), alertController.updateAlert);
router.patch('/:id/acknowledge', authenticate, alertController.acknowledgeAlert);
router.patch('/:id/resolve', authenticate, alertController.resolveAlert);
router.patch('/:id/dismiss', authenticate, alertController.dismissAlert);
router.delete('/:id', authenticate, requireRole('admin'), alertController.deleteAlert);

module.exports = router;
