const express = require('express');
const router = express.Router();
const techniqueController = require('../controllers/techniqueController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/my', authenticate, techniqueController.getMyTechniques);
router.get('/recommended', authenticate, techniqueController.getRecommendedTechniques);
router.get('/book/:bookId', authenticate, techniqueController.getTechniquesByBookId);
router.get('/:id', authenticate, techniqueController.getTechniqueById);
router.get('/', authenticate, techniqueController.getAllTechniques);

router.post('/', authenticate, requireRole('admin', 'restorer'), techniqueController.createTechnique);
router.put('/:id', authenticate, requireRole('admin', 'restorer'), techniqueController.updateTechnique);
router.patch('/:id/verify', authenticate, requireRole('admin', 'inspector'), techniqueController.verifyTechnique);
router.delete('/:id', authenticate, requireRole('admin'), techniqueController.deleteTechnique);

router.post('/:id/upload-images/:type',
  authenticate,
  requireRole('admin', 'restorer'),
  techniqueController.upload.array('images', 10),
  techniqueController.uploadImages
);

module.exports = router;
