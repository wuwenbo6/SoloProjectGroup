const express = require('express');
const router = express.Router();
const processController = require('../controllers/processController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('admin', 'manager'), processController.createTemplate);
router.get('/', authenticate, processController.getTemplates);
router.get('/:id', authenticate, processController.getTemplateById);
router.put('/:id', authenticate, authorize('admin', 'manager'), processController.updateTemplate);
router.delete('/:id', authenticate, authorize('admin'), processController.deleteTemplate);

module.exports = router;
