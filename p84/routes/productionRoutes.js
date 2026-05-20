const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('admin', 'manager', 'operator'), productionController.createProductionRecord);
router.get('/', authenticate, productionController.getProductionRecords);
router.get('/:id', authenticate, productionController.getProductionRecordById);
router.put('/step-parameters', authenticate, authorize('admin', 'manager', 'operator'), productionController.updateStepParameters);
router.put('/batch-parameters', authenticate, authorize('admin', 'manager', 'operator'), productionController.batchUpdateParameters);
router.put('/complete-step', authenticate, authorize('admin', 'manager', 'operator'), productionController.completeStep);

module.exports = router;
