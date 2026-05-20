const express = require('express');
const router = express.Router();
const qaController = require('../controllers/qaController');

router.get('/craft/:craftId', qaController.getQAByCraftId);
router.get('/craft/:craftId/step/:stepIndex', qaController.getQAByStep);
router.post('/', qaController.createQuestion);
router.post('/:qaId/answer', qaController.addAnswer);
router.delete('/:qaId', qaController.deleteQA);

module.exports = router;
