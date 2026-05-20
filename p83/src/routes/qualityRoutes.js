const express = require('express');
const router = express.Router();
const qualityController = require('../controllers/qualityController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

router.use(authenticateToken);

router.post('/',
  requirePermission('quality:create'),
  validateRequest(schemas.quality.create),
  qualityController.createQualityRecord
);

router.get('/',
  requirePermission('quality:read'),
  validateRequest(schemas.quality.query, 'query'),
  qualityController.getQualityRecords
);

router.get('/stats',
  requirePermission('quality:read'),
  qualityController.getQualityStats
);

router.get('/:id',
  requirePermission('quality:read'),
  qualityController.getQualityRecordById
);

router.put('/:id',
  requirePermission('quality:update'),
  qualityController.updateQualityRecord
);

router.delete('/:id',
  requirePermission('quality:delete'),
  qualityController.deleteQualityRecord
);

module.exports = router;
