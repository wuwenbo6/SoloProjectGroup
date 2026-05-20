const express = require('express');
const auth = require('../middleware/auth');
const { Comment, Favorite, Like } = require('../models/Interaction');
const Process = require('../models/Process');
const User = require('../models/User');

const router = express.Router();

router.post('/comment/:processId', auth, async (req, res) => {
  try {
    const { processId } = req.params;
    const { content } = req.body;

    const process = await Process.findById(processId);
    if (!process) {
      return res.status(404).json({ message: '工艺记录不存在' });
    }

    const comment = new Comment({
      processId,
      userId: req.user._id,
      content
    });

    await comment.save();

    process.commentCount += 1;
    await process.save();

    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'username avatar');

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/comments/:processId', async (req, res) => {
  try {
    const { processId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const comments = await Comment.find({ processId })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('userId', 'username avatar');
    
    const total = await Comment.countDocuments({ processId });
    
    res.json({
      data: comments,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum
    });
  } catch (error) {
    console.error('获取评论失败:', error);
    res.status(500).json({ message: '获取评论失败' });
  }
});

router.delete('/comment/:commentId', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: '评论不存在' });
    }

    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: '无权限删除' });
    }

    const process = await Process.findById(comment.processId);
    if (process) {
      process.commentCount = Math.max(0, process.commentCount - 1);
      await process.save();
    }

    await Comment.findByIdAndDelete(commentId);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/favorite/:processId', auth, async (req, res) => {
  try {
    const { processId } = req.params;

    const process = await Process.findById(processId);
    if (!process) {
      return res.status(404).json({ message: '工艺记录不存在' });
    }

    const existingFavorite = await Favorite.findOne({
      userId: req.user._id,
      processId
    });

    if (existingFavorite) {
      return res.status(400).json({ message: '已收藏' });
    }

    const favorite = new Favorite({
      userId: req.user._id,
      processId
    });

    await favorite.save();

    const user = await User.findById(req.user._id);
    if (user) {
      user.favorites.push(processId);
      await user.save();
    }

    res.status(201).json({ message: '收藏成功', favorite });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/favorite/:processId', auth, async (req, res) => {
  try {
    const { processId } = req.params;

    const favorite = await Favorite.findOneAndDelete({
      userId: req.user._id,
      processId
    });

    if (!favorite) {
      return res.status(404).json({ message: '未收藏' });
    }

    const user = await User.findById(req.user._id);
    if (user) {
      user.favorites = user.favorites.filter(
        f => f.toString() !== processId
      );
      await user.save();
    }

    res.json({ message: '取消收藏成功' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/favorites/my', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const favorites = await Favorite.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate({
        path: 'processId',
        select: 'title type images viewCount likeCount commentCount createdAt',
        populate: { path: 'userId', select: 'username avatar' }
      });
    
    const total = await Favorite.countDocuments({ userId: req.user._id });
    
    res.json({
      data: favorites,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum
    });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.status(500).json({ message: '获取收藏列表失败' });
  }
});

router.get('/favorites/check/:processId', auth, async (req, res) => {
  try {
    const { processId } = req.params;
    const favorite = await Favorite.findOne({
      userId: req.user._id,
      processId
    });
    
    res.json({ isFavorited: !!favorite });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/like/:processId', auth, async (req, res) => {
  try {
    const { processId } = req.params;

    const process = await Process.findById(processId);
    if (!process) {
      return res.status(404).json({ message: '工艺记录不存在' });
    }

    const existingLike = await Like.findOne({
      userId: req.user._id,
      processId
    });

    if (existingLike) {
      return res.status(400).json({ message: '已点赞' });
    }

    const like = new Like({
      userId: req.user._id,
      processId
    });

    await like.save();

    process.likeCount += 1;
    await process.save();

    res.status(201).json({ message: '点赞成功', like });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/like/:processId', auth, async (req, res) => {
  try {
    const { processId } = req.params;

    const like = await Like.findOneAndDelete({
      userId: req.user._id,
      processId
    });

    if (!like) {
      return res.status(404).json({ message: '未点赞' });
    }

    const process = await Process.findById(processId);
    if (process) {
      process.likeCount = Math.max(0, process.likeCount - 1);
      await process.save();
    }

    res.json({ message: '取消点赞成功' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/likes/check/:processId', auth, async (req, res) => {
  try {
    const { processId } = req.params;
    const like = await Like.findOne({
      userId: req.user._id,
      processId
    });
    
    res.json({ isLiked: !!like });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
