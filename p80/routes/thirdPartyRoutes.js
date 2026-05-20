const express = require('express');
const router = express.Router();
const thirdPartyController = require('../controllers/thirdPartyController');
const { authenticate, requireRole, verifyThirdParty } = require('../middleware/auth');

router.post('/webhook', verifyThirdParty, thirdPartyController.receiveWebhook);
router.get('/types', authenticate, thirdPartyController.getDetectionTypes);
router.get('/detection-id/:detectionId/status', authenticate, thirdPartyController.getSyncStatus);
router.get('/detection-id/:detectionId', authenticate, thirdPartyController.getDetectionByDetectionId);
router.get('/book/:bookId', authenticate, thirdPartyController.getDetectionsByBookId);
router.get('/:id', authenticate, thirdPartyController.getDetectionById);
router.get('/', authenticate, thirdPartyController.getAllDetections);

router.post('/', authenticate, requireRole('admin', 'inspector'), thirdPartyController.createDetection);
router.put('/:id', authenticate, requireRole('admin', 'inspector'), thirdPartyController.updateDetection);
router.patch('/:id/verify', authenticate, requireRole('admin', 'inspector'), thirdPartyController.verifyDetection);
router.post('/:detectionId/sync', authenticate, requireRole('admin', 'inspector'), thirdPartyController.syncWithThirdParty);
router.delete('/:id', authenticate, requireRole('admin'), thirdPartyController.deleteDetection);

module.exports = router;
