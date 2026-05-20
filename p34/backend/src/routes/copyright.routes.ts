import { Router } from 'express';
import {
  createRegistration,
  getRegistrations,
  getRegistrationById,
  updateRegistration,
  submitForReview,
  reviewRegistration,
  registerBlockchain,
  uploadCertificate,
  deleteRegistration,
  getMyRegistrations,
  getRegistrationLogs,
  getStatistics,
} from '../controllers/CopyrightController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/', (req, res) => createRegistration(req, res));
router.get('/', (req, res) => getRegistrations(req, res));
router.get('/statistics', (req, res) => getStatistics(req, res));
router.get('/me', (req, res) => getMyRegistrations(req, res));
router.get('/:id', (req, res) => getRegistrationById(req, res));
router.put('/:id', (req, res) => updateRegistration(req, res));
router.post('/:id/submit', (req, res) => submitForReview(req, res));
router.post('/:id/review', (req, res) => reviewRegistration(req, res));
router.post('/:id/blockchain', (req, res) => registerBlockchain(req, res));
router.post('/:id/certificate', (req, res) => uploadCertificate(req, res));
router.delete('/:id', (req, res) => deleteRegistration(req, res));
router.get('/:id/logs', (req, res) => getRegistrationLogs(req, res));

export default router;
