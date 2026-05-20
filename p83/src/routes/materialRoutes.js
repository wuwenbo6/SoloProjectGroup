const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

router.use(authenticateToken);

router.post('/',
  requirePermission('material:create'),
  validateRequest(schemas.material.create),
  materialController.createMaterial
);

router.get('/',
  requirePermission('material:read'),
  validateRequest(schemas.material.query, 'query'),
  materialController.getMaterials
);

router.get('/stats',
  requirePermission('material:read'),
  materialController.getMaterialStats
);

router.get('/origin-process/rules',
  requirePermission('material:read'),
  materialController.getOriginProcessRules
);

router.get('/origin-process/stats',
  requirePermission('material:read'),
  materialController.getOriginProcessStats
);

router.get('/origin-process/process/:processName',
  requirePermission('material:read'),
  materialController.getProcessDetails
);

router.get('/origin-process/materials/:originKey',
  requirePermission('material:read'),
  materialController.getOriginMaterials
);

router.get('/:materialId/processes/match',
  requirePermission('material:read'),
  materialController.matchMaterialProcesses
);

router.get('/:materialId/processes',
  requirePermission('material:read'),
  materialController.getMaterialProcessBindings
);

router.post('/:materialId/processes',
  requirePermission('material:update'),
  materialController.bindProcessesToMaterial
);

router.delete('/:materialId/processes/:processName',
  requirePermission('material:update'),
  materialController.removeProcessFromMaterial
);

router.get('/:id',
  requirePermission('material:read'),
  materialController.getMaterialById
);

router.put('/:id',
  requirePermission('material:update'),
  validateRequest(schemas.material.update),
  materialController.updateMaterial
);

router.delete('/:id',
  requirePermission('material:delete'),
  materialController.deleteMaterial
);

module.exports = router;
