const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');

router.get('/craft/:craftId', commentController.getCommentsByCraftId);
router.post('/', commentController.createComment);
router.delete('/:id', commentController.deleteComment);

module.exports = router;
