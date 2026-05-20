const express = require('express');
const router = express.Router();
const techniqueVersionController = require('../controllers/techniqueVersionController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/statistics', authenticate, techniqueVersionController.getVersionStatistics);
router.get('/baselines', authenticate, techniqueVersionController.getBaselineVersions);
router.get('/compare', authenticate, techniqueVersionController.compareVersions);
router.get('/technique/:techniqueId', authenticate, techniqueVersionController.getVersionsByTechniqueId);
router.get('/technique/:techniqueId/current', authenticate, techniqueVersionController.getCurrentVersion);
router.get('/book/:bookId', authenticate, techniqueVersionController.getVersionsByBookId);
router.get('/:id/export', authenticate, techniqueVersionController.exportVersion);
router.get('/:id', authenticate, techniqueVersionController.getVersionById);

router.post('/', authenticate, requireRole('admin', 'restorer'), techniqueVersionController.createVersion);
router.patch('/:id/set-current', authenticate, requireRole('admin', 'restorer'), techniqueVersionController.setCurrentVersion);
router.patch('/:id/verify', authenticate, requireRole('admin', 'inspector'), techniqueVersionController.verifyVersion);
router.patch('/:id/baseline', authenticate, requireRole('admin', 'inspector'), techniqueVersionController.setBaselineVersion);
router.patch('/:id/tags', authenticate, requireRole('admin', 'restorer'), techniqueVersionController.updateVersionTags);
router.post('/:id/restore', authenticate, requireRole('admin', 'restorer'), techniqueVersionController.restoreVersion);
router.delete('/:id', authenticate, requireRole('admin'), techniqueVersionController.deleteVersion);

module.exports = router;
