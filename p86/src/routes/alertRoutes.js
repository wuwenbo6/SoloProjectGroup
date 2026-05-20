const express = require('express');
const {
  createAlert,
  getAllAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert,
  ignoreAlert,
  batchCheckParameters,
  getAlertStatistics,
  getThresholdConfig,
} = require('../controllers/alertController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/statistics', getAlertStatistics);
router.get('/thresholds', getThresholdConfig);
router.post('/batch-check', authorize('管理员', '质检员'), batchCheckParameters);

router.route('/')
  .get(getAllAlerts)
  .post(authorize('管理员', '质检员'), createAlert);

router.route('/:id')
  .get(getAlertById);

router.put('/:id/acknowledge', authorize('管理员', '质检员'), acknowledgeAlert);
router.put('/:id/resolve', authorize('管理员', '质检员'), resolveAlert);
router.put('/:id/ignore', authorize('管理员', '质检员'), ignoreAlert);

module.exports = router;
