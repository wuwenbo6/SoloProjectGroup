const express = require('express');
const {
  sendInspectionToThirdParty,
  receiveThirdPartyReport,
  getThirdPartyReport,
  syncBatchInspections,
  getThirdPartyOrganizations,
  testThirdPartyConnection,
} = require('../controllers/thirdPartyController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/report/webhook', receiveThirdPartyReport);

router.use(auth);

router.post('/inspections/:inspectionId/sync', authorize('管理员', '质检员', '第三方机构'), sendInspectionToThirdParty);

router.get('/inspections/:inspectionId/report', authorize('管理员', '质检员', '第三方机构'), getThirdPartyReport);

router.post('/batches/:batchId/sync', authorize('管理员', '质检员', '第三方机构'), syncBatchInspections);

router.get('/organizations', authorize('管理员'), getThirdPartyOrganizations);

router.get('/test-connection', authorize('管理员'), testThirdPartyConnection);

module.exports = router;