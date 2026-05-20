const express = require('express');
const { authenticateToken, requireRoles } = require('../../../shared/middleware/auth');
const thirdPartyController = require('../controllers/thirdPartyController');

const router = express.Router();

router.post('/inspection', authenticateToken, requireRoles('admin', 'manager'), thirdPartyController.createInspectionTask);
router.get('/inspection/:task_id/status', thirdPartyController.getInspectionStatus);
router.get('/inspection/:task_id/report', thirdPartyController.getInspectionReport);
router.post('/webhook', thirdPartyController.webhookReceiver);
router.post('/sync', authenticateToken, thirdPartyController.syncInspectionData);
router.get('/labs', thirdPartyController.getLabs);

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Third-party service is running', timestamp: new Date().toISOString() });
});

module.exports = router;
