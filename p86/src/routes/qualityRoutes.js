const express = require('express');
const {
  createQualityInspection,
  getAllQualityInspections,
  getQualityInspectionById,
  updateQualityInspection,
  submitQualityInspection,
  addDefect,
  addCorrectiveAction,
  updateCorrectiveActionStatus,
  uploadQualityImage,
  getQualityStatistics,
  calculateInspectionResult,
} = require('../controllers/qualityController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/statistics', getQualityStatistics);
router.post('/calculate', authorize('管理员', '质检员'), calculateInspectionResult);

router.route('/')
  .get(getAllQualityInspections)
  .post(authorize('管理员', '质检员'), createQualityInspection);

router.route('/:id')
  .get(getQualityInspectionById)
  .put(authorize('管理员', '质检员'), updateQualityInspection);

router.put('/:id/submit', authorize('管理员', '质检员'), submitQualityInspection);
router.post('/:id/defects', authorize('管理员', '质检员'), addDefect);
router.post('/:id/corrective-actions', authorize('管理员', '质检员'), addCorrectiveAction);
router.put('/:id/corrective-actions/status', authorize('管理员', '质检员'), updateCorrectiveActionStatus);
router.post('/:id/images', authorize('管理员', '质检员'), uploadQualityImage);

module.exports = router;