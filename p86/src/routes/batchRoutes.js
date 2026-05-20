const express = require('express');
const {
  createBatch,
  getAllBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  startBatch,
  pauseBatch,
  completeBatch,
  cancelBatch,
  updateBatchProgress,
  assignBatch,
  getBatchStatistics,
} = require('../controllers/batchController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/statistics', getBatchStatistics);

router.route('/')
  .get(getAllBatches)
  .post(authorize('管理员'), createBatch);

router.route('/:id')
  .get(getBatchById)
  .put(authorize('管理员'), updateBatch)
  .delete(authorize('管理员'), deleteBatch);

router.put('/:id/start', authorize('管理员'), startBatch);
router.put('/:id/pause', authorize('管理员'), pauseBatch);
router.put('/:id/complete', authorize('管理员'), completeBatch);
router.put('/:id/cancel', authorize('管理员'), cancelBatch);
router.put('/:id/progress', authorize('管理员'), updateBatchProgress);
router.put('/:id/assign', authorize('管理员'), assignBatch);

module.exports = router;