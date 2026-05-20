const express = require('express');
const auth = require('../middleware/auth');
const Question = require('../models/QnA');

const router = express.Router();

router.post('/:processId/step/:stepId', auth, async (req, res) => {
  try {
    const { processId, stepId } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: '标题和内容不能为空' });
    }

    const question = new Question({
      processId,
      stepId: parseInt(stepId),
      userId: req.user._id,
      title,
      content
    });

    await question.save();
    await question.populate('userId', 'username avatar');

    res.status(201).json(question);
  } catch (error) {
    console.error('创建问题失败:', error);
    res.status(500).json({ message: '创建问题失败' });
  }
});

router.get('/:processId/step/:stepId', async (req, res) => {
  try {
    const { processId, stepId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const questions = await Question.find({ processId, stepId: parseInt(stepId) })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('userId', 'username avatar')
      .populate('answers.userId', 'username avatar');

    const total = await Question.countDocuments({ processId, stepId: parseInt(stepId) });

    res.json({
      data: questions,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum
    });
  } catch (error) {
    console.error('获取问题列表失败:', error);
    res.status(500).json({ message: '获取问题列表失败' });
  }
});

router.get('/:processId', async (req, res) => {
  try {
    const { processId } = req.params;

    const questions = await Question.find({ processId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('userId', 'username avatar');

    const groupedByStep = questions.reduce((acc, q) => {
      const stepId = q.stepId;
      if (!acc[stepId]) acc[stepId] = [];
      acc[stepId].push(q);
      return acc;
    }, {});

    res.json(groupedByStep);
  } catch (error) {
    console.error('获取工艺问题失败:', error);
    res.status(500).json({ message: '获取工艺问题失败' });
  }
});

router.post('/answer/:questionId', auth, async (req, res) => {
  try {
    const { questionId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: '回答内容不能为空' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: '问题不存在' });
    }

    const answer = {
      userId: req.user._id,
      content
    };

    question.answers.push(answer);
    question.answerCount = question.answers.length;

    await question.save();
    await question.populate('answers.userId', 'username avatar');

    res.json(question);
  } catch (error) {
    console.error('提交回答失败:', error);
    res.status(500).json({ message: '提交回答失败' });
  }
});

router.post('/answer/:answerId/upvote', auth, async (req, res) => {
  try {
    const { answerId } = req.params;
    const { questionId } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: '问题不存在' });
    }

    const answer = question.answers.id(answerId);
    if (!answer) {
      return res.status(404).json({ message: '回答不存在' });
    }

    answer.upvotes += 1;
    await question.save();

    res.json({ upvotes: answer.upvotes });
  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ message: '点赞失败' });
  }
});

router.put('/answer/:answerId/accept', auth, async (req, res) => {
  try {
    const { answerId } = req.params;
    const { questionId } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: '问题不存在' });
    }

    const answer = question.answers.id(answerId);
    if (!answer) {
      return res.status(404).json({ message: '回答不存在' });
    }

    question.answers.forEach(a => a.isAccepted = false);
    answer.isAccepted = true;
    question.isResolved = true;

    await question.save();

    res.json({ success: true });
  } catch (error) {
    console.error('采纳回答失败:', error);
    res.status(500).json({ message: '采纳回答失败' });
  }
});

module.exports = router;
