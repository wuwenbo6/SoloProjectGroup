const express = require('express');
const { authenticateToken, requireRoles } = require('../../../shared/middleware/auth');
const qualityController = require('../controllers/qualityController');

const router = express.Router();

router.get('/', qualityController.getInspections);
router.get('/grades', qualityController.getGrades);
router.get('/batch/:batch_id', qualityController.getInspectionsByBatch);
router.get('/:id', qualityController.getInspection);
router.post('/', authenticateToken, requireRoles('admin', 'manager', 'user'), qualityController.createInspection);
router.post('/calculate', authenticateToken, qualityController.calculateQualityScore);

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Quality service is running', timestamp: new Date().toISOString() });
});

module.exports = router;
