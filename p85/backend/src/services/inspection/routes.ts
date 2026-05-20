import { Router } from 'express';
import {
  createInspection,
  getInspections,
  getInspectionById,
  updateInspection,
  getStatistics,
} from './controllers/inspectionController';
import {
  createAgency,
  getAgencies,
  getAgencyById,
  updateAgency,
  regenerateApiKey,
} from './controllers/agencyController';
import { authenticateToken, requireRoles } from '../../shared/middleware/auth';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'inspection' }));

router.use(authenticateToken);

router.get('/inspections', getInspections);
router.get('/inspections/statistics', getStatistics);
router.get('/inspections/:id', getInspectionById);
router.post('/inspections', requireRoles('inspector', 'admin'), createInspection);
router.put('/inspections/:id', requireRoles('inspector', 'admin'), updateInspection);

router.get('/agencies', getAgencies);
router.get('/agencies/:id', getAgencyById);
router.post('/agencies', requireRoles('admin'), createAgency);
router.put('/agencies/:id', requireRoles('admin'), updateAgency);
router.post('/agencies/:id/regenerate-key', requireRoles('admin'), regenerateApiKey);

export default router;
