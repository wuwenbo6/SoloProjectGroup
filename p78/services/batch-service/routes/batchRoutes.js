const express = require('express');
const { authenticateToken, requireRoles } = require('../../../shared/middleware/auth');
const batchController = require('../controllers/batchController');

const router = express.Router();

router.get('/', batchController.getBatches);
router.get('/:id', batchController.getBatch);
router.get('/no/:batch_no', batchController.getBatchByNo);
router.post('/', authenticateToken, requireRoles('admin', 'manager'), batchController.createBatch);
router.put('/:id/status', authenticateToken, requireRoles('admin', 'manager'), batchController.updateBatchStatus);

router.get('/:batch_id/flow', batchController.getFlowRecords);
router.post('/:batch_id/flow', authenticateToken, requireRoles('admin', 'manager', 'user'), batchController.addFlowRecord);

router.get('/warnings/expiry', authenticateToken, batchController.getExpiryWarnings);
router.get('/warnings', authenticateToken, batchController.getWarnings);
router.put('/warnings/:id/acknowledge', authenticateToken, requireRoles('admin', 'manager'), batchController.acknowledgeWarning);
router.post('/warnings/trigger', authenticateToken, requireRoles('admin'), batchController.triggerWarningGeneration);

router.post('/origin-process-relations', authenticateToken, requireRoles('admin', 'manager'), batchController.createOriginProcessRelation);
router.get('/origin-process-relations', authenticateToken, batchController.getOriginProcessRelations);
router.get('/origin-process-relations/recommended', authenticateToken, batchController.getRecommendedProcesses);
router.put('/origin-process-relations/:id', authenticateToken, requireRoles('admin', 'manager'), batchController.updateOriginProcessRelation);
router.delete('/origin-process-relations/:id', authenticateToken, requireRoles('admin'), batchController.deleteOriginProcessRelation);
router.get('/origin-process-relations/statistics', authenticateToken, batchController.getProcessStatistics);

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Batch service is running', timestamp: new Date().toISOString() });
});

module.exports = router;
