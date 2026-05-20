const express = require('express');
const testingController = require('../controllers/testingController');
const { protect, apiKeyAuth, requirePermission, requireRole } = require('../middleware/auth');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const router = express.Router();

router.post('/sync', apiKeyAuth, testingController.syncTestingData);

router.use(protect);

router.get('/stats', requirePermission(PERMISSIONS.TESTING_READ), testingController.getStats);
router.get('/institutions', requirePermission(PERMISSIONS.TESTING_READ), testingController.getAllInstitutions);
router.get('/institutions/:id', requirePermission(PERMISSIONS.TESTING_READ), testingController.getInstitutionById);
router.post('/institutions', requireRole(ROLES.ADMIN), testingController.createInstitution);
router.put('/institutions/:id', requireRole(ROLES.ADMIN), testingController.updateInstitution);
router.post('/institutions/:id/regenerate-key', requireRole(ROLES.ADMIN), testingController.regenerateApiKey);
router.get('/reports', requirePermission(PERMISSIONS.TESTING_READ), testingController.getReports);
router.get('/reports/:id', requirePermission(PERMISSIONS.TESTING_READ), testingController.getReportById);
router.put('/reports/:id/verify', requireRole(ROLES.ADMIN, ROLES.REGULATOR), testingController.verifyReport);

module.exports = router;