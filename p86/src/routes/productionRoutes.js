const express = require('express');
const {
  createProductionRecord,
  getAllProductionRecords,
  getProductionRecordById,
  updateProductionRecord,
  completeProductionRecord,
  updateProductionParameters,
  uploadProductionImage,
  batchUpdateProductionParameters,
} = require('../controllers/productionController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.route('/')
  .get(getAllProductionRecords)
  .post(authorize('管理员', '操作员'), createProductionRecord);

router.route('/:id')
  .get(getProductionRecordById)
  .put(authorize('管理员', '操作员'), updateProductionRecord);

router.put('/:id/complete', authorize('管理员', '操作员'), completeProductionRecord);
router.put('/:id/parameters', authorize('管理员', '操作员'), updateProductionParameters);
router.put('/batch/parameters', authorize('管理员', '操作员'), batchUpdateProductionParameters);
router.post('/:id/images', authorize('管理员', '操作员'), uploadProductionImage);

module.exports = router;