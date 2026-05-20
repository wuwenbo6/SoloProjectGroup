const express = require('express');
const { authenticateToken, requireRoles } = require('../../../shared/middleware/auth');
const traceController = require('../controllers/traceController');

const router = express.Router();

router.get('/', traceController.getTraceRecords);
router.get('/:id', traceController.getTraceRecord);
router.post('/', authenticateToken, requireRoles('admin', 'manager', 'user'), traceController.createTraceRecord);
router.delete('/:id', authenticateToken, requireRoles('admin'), traceController.invalidateTraceRecord);

router.post('/origin', authenticateToken, requireRoles('admin', 'manager', 'user'), traceController.createOriginRecord);
router.post('/processing', authenticateToken, requireRoles('admin', 'manager', 'user'), traceController.createProcessingRecord);
router.post('/transport', authenticateToken, requireRoles('admin', 'manager', 'user'), traceController.createTransportRecord);

router.get('/chain/:batch_id', traceController.getFullTraceChain);

router.post('/export', authenticateToken, traceController.batchExportTraceData);
router.get('/export/templates', authenticateToken, traceController.getExportTemplates);

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Trace service is running', timestamp: new Date().toISOString() });
});

module.exports = router;
