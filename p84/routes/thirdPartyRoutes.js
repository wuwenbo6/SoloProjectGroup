const express = require('express');
const router = express.Router();
const thirdPartyController = require('../controllers/thirdPartyController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/sync', authenticate, authorize('admin', 'manager'), thirdPartyController.syncToThirdParty);
router.post('/pull', authenticate, authorize('admin', 'manager'), thirdPartyController.pullFromThirdParty);
router.get('/sync-records', authenticate, authorize('admin', 'manager'), thirdPartyController.getSyncRecords);
router.post('/retry', authenticate, authorize('admin', 'manager'), thirdPartyController.retrySync);
router.get('/agencies', authenticate, thirdPartyController.getAgencyList);

module.exports = router;
