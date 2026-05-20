const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

router.use(authenticateToken);

router.post('/',
  requirePermission('batch:create'),
  validateRequest(schemas.batch.create),
  batchController.createBatch
);

router.get('/',
  requirePermission('batch:read'),
  validateRequest(schemas.batch.query, 'query'),
  batchController.getBatches
);

router.get('/stats',
  requirePermission('batch:read'),
  batchController.getBatchStats
);

router.get('/:id',
  requirePermission('batch:read'),
  batchController.getBatchById
);

router.put('/:id',
  requirePermission('batch:update'),
  batchController.updateBatch
);

router.delete('/:id',
  requirePermission('batch:delete'),
  batchController.deleteBatch
);

router.post('/:id/materials',
  requirePermission('batch:update'),
  batchController.addMaterialToBatch
);

module.exports = router;
