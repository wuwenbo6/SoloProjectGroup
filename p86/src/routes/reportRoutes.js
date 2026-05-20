const express = require('express');
const {
  exportCrafts,
  exportProductionRecords,
  exportQualityInspections,
  exportBatchSummary,
  getExportTemplates,
} = require('../controllers/reportController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/templates', getExportTemplates);

router.get('/crafts', authorize('管理员', '工艺师'), exportCrafts);
router.get('/production', authorize('管理员', '操作员'), exportProductionRecords);
router.get('/quality', authorize('管理员', '质检员'), exportQualityInspections);
router.get('/batch-summary', authorize('管理员'), exportBatchSummary);

module.exports = router;
