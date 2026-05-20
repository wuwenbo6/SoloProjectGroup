const express = require('express');
const { authenticateToken, requireRoles } = require('../../../shared/middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getCurrentUser);

router.post('/api-key/validate', authController.validateApiKey);
router.post('/api-key', authenticateToken, requireRoles('admin'), authController.createApiKey);
router.get('/api-key', authenticateToken, requireRoles('admin'), authController.getApiKeys);
router.delete('/api-key/:id', authenticateToken, requireRoles('admin'), authController.revokeApiKey);

router.get('/users', authenticateToken, requireRoles('admin'), authController.getUsers);

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Auth service is running', timestamp: new Date().toISOString() });
});

router.post('/security/encrypt', authenticateToken, (req, res) => {
  const { encrypt, generateSignature } = require('../../../shared/middleware/encryption');
  try {
    const { data } = req.body;
    const timestamp = Date.now();
    const nonce = require('crypto').randomBytes(16).toString('hex');
    const encrypted = encrypt(data);
    const signature = generateSignature(data, timestamp, nonce, 'POST', '/api/auth/security/encrypt');
    
    res.json({
      success: true,
      data: {
        encrypted_data: encrypted,
        timestamp,
        nonce,
        signature
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/security/decrypt', authenticateToken, (req, res) => {
  const { decrypt, verifySignature } = require('../../../shared/middleware/encryption');
  try {
    const { encrypted_data, timestamp, nonce, signature } = req.body;
    const decrypted = decrypt(encrypted_data);
    
    const isValid = verifySignature(decrypted, signature, timestamp, nonce, 'POST', '/api/auth/security/decrypt');
    
    res.json({
      success: true,
      data: {
        decrypted_data: decrypted,
        signature_valid: isValid
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/security/key', authenticateToken, requireRoles('admin'), (req, res) => {
  const { generateApiKey, generateApiSecret } = require('../../../shared/middleware/encryption');
  res.json({
    success: true,
    data: {
      api_key: generateApiKey(),
      api_secret: generateApiSecret()
    }
  });
});

module.exports = router;
