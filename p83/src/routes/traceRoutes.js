const express = require('express');
const router = express.Router();
const traceController = require('../controllers/traceController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

router.use(authenticateToken);

router.post('/',
  requirePermission('trace:create'),
  validateRequest(schemas.trace.create),
  traceController.createTraceRecord
);

router.get('/',
  requirePermission('trace:read'),
  validateRequest(schemas.trace.query, 'query'),
  traceController.getTraceRecords
);

router.get('/stats',
  requirePermission('trace:read'),
  traceController.getTraceStats
);

router.get('/chain/:materialId',
  requirePermission('trace:read'),
  traceController.getMaterialTraceChain
);

router.get('/export/template',
  requirePermission('trace:read'),
  traceController.generateExportTemplate
);

router.get('/export/chain/:materialId',
  requirePermission('trace:read'),
  traceController.exportMaterialTraceChain
);

router.post('/export',
  requirePermission('trace:read'),
  traceController.exportTraceData
);

router.get('/:id',
  requirePermission('trace:read'),
  traceController.getTraceRecordById
);

router.put('/:id',
  requirePermission('trace:update'),
  traceController.updateTraceRecord
);

router.delete('/:id',
  requirePermission('trace:delete'),
  traceController.deleteTraceRecord
);

module.exports = router;
