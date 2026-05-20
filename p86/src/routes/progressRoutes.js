const express = require('express');
const {
  getBatchProgress,
  getCraftProgressSummary,
  getWorkshopProgress,
  getStepTimeline,
  getRealTimeProgress,
  updateProgressMilestone,
  getProgressDashboard,
} = require('../controllers/progressController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/dashboard', getProgressDashboard);
router.get('/realtime', getRealTimeProgress);
router.get('/workshop', getWorkshopProgress);

router.get('/batch/:batchId', getBatchProgress);
router.get('/batch/:batchId/timeline', getStepTimeline);
router.post('/batch/:batchId/milestones', authorize('管理员'), updateProgressMilestone);

router.get('/craft/:craftId', getCraftProgressSummary);

module.exports = router;
