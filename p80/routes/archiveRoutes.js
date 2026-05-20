const express = require('express');
const router = express.Router();
const archiveController = require('../controllers/archiveController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/types', authenticate, archiveController.getArchiveTypes);
router.get('/archive-number/:archiveNumber', authenticate, archiveController.getArchiveByArchiveNumber);
router.get('/book/:bookId', authenticate, archiveController.getArchivesByBookId);
router.get('/:id', authenticate, archiveController.getArchiveById);
router.get('/:id/download', authenticate, archiveController.downloadArchive);
router.get('/', authenticate, archiveController.getAllArchives);

router.post('/', authenticate, requireRole('admin', 'archivist', 'restorer'), archiveController.createArchive);
router.post('/generate', authenticate, requireRole('admin', 'archivist', 'restorer'), archiveController.generateArchive);
router.put('/:id', authenticate, requireRole('admin', 'archivist'), archiveController.updateArchive);
router.patch('/:id/submit', authenticate, requireRole('admin', 'archivist', 'restorer'), archiveController.submitArchive);
router.patch('/:id/review', authenticate, requireRole('admin', 'inspector'), archiveController.reviewArchive);
router.patch('/:id/archive', authenticate, requireRole('admin', 'archivist'), archiveController.archiveFinal);
router.delete('/:id', authenticate, requireRole('admin'), archiveController.deleteArchive);

module.exports = router;
