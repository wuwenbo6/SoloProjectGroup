const { CommentModel } = require('../models/database');

exports.getCommentsByCraftId = (req, res) => {
  try {
    const comments = CommentModel.findByCraftId(req.params.craftId);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createComment = async (req, res) => {
  try {
    const comment = await CommentModel.create(req.body);
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const success = await CommentModel.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
