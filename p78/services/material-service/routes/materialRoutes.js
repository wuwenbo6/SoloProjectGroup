const express = require('express');
const { authenticateToken, requireRoles } = require('../../../shared/middleware/auth');
const materialController = require('../controllers/materialController');

const router = express.Router();

router.get('/categories', materialController.getCategories);
router.post('/categories', authenticateToken, requireRoles('admin', 'manager'), materialController.createCategory);
router.put('/categories/:id', authenticateToken, requireRoles('admin', 'manager'), materialController.updateCategory);
router.delete('/categories/:id', authenticateToken, requireRoles('admin'), materialController.deleteCategory);

router.get('/', materialController.getMaterials);
router.get('/:id', materialController.getMaterial);
router.post('/', authenticateToken, requireRoles('admin', 'manager'), materialController.createMaterial);
router.put('/:id', authenticateToken, requireRoles('admin', 'manager'), materialController.updateMaterial);
router.delete('/:id', authenticateToken, requireRoles('admin'), materialController.deleteMaterial);

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Material service is running', timestamp: new Date().toISOString() });
});

module.exports = router;
