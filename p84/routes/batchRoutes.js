const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('admin', 'manager'), batchController.createBatch);
router.get('/', authenticate, batchController.getBatches);
router.get('/:id', authenticate, batchController.getBatchById);
router.put('/:id', authenticate, authorize('admin', 'manager'), batchController.updateBatch);
router.put('/:id/start', authenticate, authorize('admin', 'manager'), batchController.startBatch);
router.put('/:id/complete', authenticate, authorize('admin', 'manager'), batchController.completeBatch);
router.delete('/:id', authenticate, authorize('admin'), batchController.deleteBatch);

module.exports = router;
