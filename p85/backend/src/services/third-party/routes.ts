import { Router } from 'express';
import {
  receiveInspectionData,
  getWebhookStatus,
  syncInspectionData,
} from './controllers/webhookController';
import {
  createApiKey,
  testSignature,
  encryptDataHandler,
  decryptDataHandler,
} from './controllers/securityController';
import { authenticateToken, requireRoles } from '../../shared/middleware/auth';
import { signatureValidationMiddleware } from '../../shared/middleware/requestSecurity';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'third-party' }));
router.post('/webhook/inspection', signatureValidationMiddleware, receiveInspectionData);

router.use(authenticateToken);

router.post('/api-keys', requireRoles('admin'), createApiKey);
router.post('/test-signature', requireRoles('admin'), testSignature);
router.post('/encrypt', requireRoles('admin'), encryptDataHandler);
router.post('/decrypt', requireRoles('admin'), decryptDataHandler);

router.get('/webhook/status/:agencyId', requireRoles('admin'), getWebhookStatus);
router.post('/sync', requireRoles('admin'), syncInspectionData);

export default router;
