const express = require('express');
const router = express.Router();
const pdfExportController = require('../controllers/pdfExportController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/history', authenticate, pdfExportController.getExportHistory);
router.get('/archive/:id', authenticate, pdfExportController.exportSinglePDF);
router.get('/book/:bookId/full-report', authenticate, pdfExportController.exportBookFullReport);
router.post('/batch', authenticate, requireRole('admin', 'archivist'), pdfExportController.exportBatchPDF);

module.exports = router;
