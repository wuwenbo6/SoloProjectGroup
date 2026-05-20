const express = require('express');
const router = express.Router();
const craftController = require('../controllers/craftController');

router.get('/', craftController.getCrafts);
router.get('/:id', craftController.getCraftById);
router.post('/', craftController.createCraft);
router.put('/:id', craftController.updateCraft);
router.delete('/:id', craftController.deleteCraft);
router.post('/:id/like', craftController.likeCraft);

module.exports = router;
