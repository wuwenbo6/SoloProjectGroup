const express = require('express');
const router = express.Router();
const traceController = require('../controllers/traceController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/search', authenticate, traceController.searchTrace);
router.get('/logs', authenticate, requireRole('admin'), traceController.getOperationLogs);
router.get('/book/:bookId/full', authenticate, traceController.getFullTraceChain);
router.get('/book/:bookId/export', authenticate, traceController.exportTraceReport);
router.get('/:traceId', authenticate, traceController.getTraceByTraceId);

module.exports = router;
