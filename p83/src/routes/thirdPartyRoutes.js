const express = require('express');
const router = express.Router();
const thirdPartyController = require('../controllers/thirdPartyController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

router.post('/webhook/:agencyId', thirdPartyController.handleWebhook);

router.use(authenticateToken);

router.post('/',
  requirePermission('third_party:create'),
  validateRequest(schemas.testingAgency.create),
  thirdPartyController.createTestingAgency
);

router.get('/',
  requirePermission('third_party:read'),
  thirdPartyController.getTestingAgencies
);

router.get('/:id',
  requirePermission('third_party:read'),
  thirdPartyController.getTestingAgencyById
);

router.put('/:id',
  requirePermission('third_party:update'),
  thirdPartyController.updateTestingAgency
);

router.delete('/:id',
  requirePermission('third_party:delete'),
  thirdPartyController.deleteTestingAgency
);

router.post('/:agencyId/sync',
  requirePermission('third_party:sync'),
  thirdPartyController.syncQualityRecord
);

router.get('/:agencyId/records',
  requirePermission('third_party:read'),
  thirdPartyController.fetchThirdPartyRecords
);

router.post('/:agencyId/import',
  requirePermission('third_party:import'),
  thirdPartyController.importThirdPartyRecord
);

module.exports = router;
