const express = require('express');
const {
  createCraft,
  getAllCrafts,
  getCraftById,
  updateCraft,
  deleteCraft,
  publishCraft,
} = require('../controllers/craftController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.route('/')
  .get(getAllCrafts)
  .post(authorize('管理员', '工艺师'), createCraft);

router.route('/:id')
  .get(getCraftById)
  .put(authorize('管理员', '工艺师'), updateCraft)
  .delete(authorize('管理员'), deleteCraft);

router.put('/:id/publish', authorize('管理员', '工艺师'), publishCraft);

module.exports = router;