const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-email');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('collectedPatterns', 'name imageUrl category')
      .populate('editedPatterns', 'name imageUrl category');
    
    if (!user) {
      return res.status(404).json({ error: '用户未找到' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, email, avatar } = req.body;

    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });

    if (existingUser) {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }

    const user = new User({
      username,
      email,
      avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`
    });

    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/collect/:patternId', async (req, res) => {
  try {
    const { id, patternId } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: '用户未找到' });
    }

    if (!user.collectedPatterns.includes(patternId)) {
      user.collectedPatterns.push(patternId);
      await user.save();
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/collect/:patternId', async (req, res) => {
  try {
    const { id, patternId } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: '用户未找到' });
    }

    user.collectedPatterns = user.collectedPatterns.filter(
      p => p.toString() !== patternId
    );
    await user.save();

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
