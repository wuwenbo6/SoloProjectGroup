const express = require('express');
const router = express.Router();
const encryptionController = require('../controllers/encryptionController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/encrypt',
  requirePermission('encryption:use'),
  encryptionController.encryptData
);

router.post('/decrypt',
  requirePermission('encryption:use'),
  encryptionController.decryptData
);

router.post('/sign',
  requirePermission('encryption:use'),
  encryptionController.generateSignature
);

router.post('/verify',
  requirePermission('encryption:use'),
  encryptionController.verifySignature
);

router.post('/generate-key',
  requirePermission('encryption:manage'),
  encryptionController.generateApiKey
);

router.post('/hash',
  requirePermission('encryption:use'),
  encryptionController.hashData
);

module.exports = router;
