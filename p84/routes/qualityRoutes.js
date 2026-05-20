const express = require('express');
const router = express.Router();
const qualityController = require('../controllers/qualityController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('admin', 'manager', 'inspector'), qualityController.createInspection);
router.get('/', authenticate, qualityController.getInspections);
router.get('/:id', authenticate, qualityController.getInspectionById);
router.put('/:id', authenticate, authorize('admin', 'manager', 'inspector'), qualityController.updateInspection);

module.exports = router;
