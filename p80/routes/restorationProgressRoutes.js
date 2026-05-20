const express = require('express');
const router = express.Router();
const restorationProgressController = require('../controllers/restorationProgressController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/my', authenticate, restorationProgressController.getMyProgress);
router.get('/book/:bookId', authenticate, restorationProgressController.getProgressByBookId);
router.get('/:id', authenticate, restorationProgressController.getProgressById);
router.get('/', authenticate, restorationProgressController.getAllProgress);

router.post('/', authenticate, requireRole('admin', 'restorer'), restorationProgressController.createProgress);
router.put('/:id', authenticate, requireRole('admin', 'restorer'), restorationProgressController.updateProgress);
router.patch('/:id/status', authenticate, requireRole('admin', 'restorer'), restorationProgressController.updateProgressStatus);
router.patch('/:id/percent', authenticate, requireRole('admin', 'restorer'), restorationProgressController.updateProgressPercent);
router.patch('/:id/quality-check', authenticate, requireRole('admin', 'inspector'), restorationProgressController.qualityCheck);
router.delete('/:id', authenticate, requireRole('admin'), restorationProgressController.deleteProgress);

module.exports = router;
