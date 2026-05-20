const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { runQuery, getQuery, allQuery } = require('../database/db');

const JWT_SECRET = 'embroidery-teaching-secret-key';

router.post('/register', async (req, res) => {
  try {
    const { username, password, role = 'student' } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = await runQuery(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );
    
    const token = jwt.sign({ userId: result.id, username, role }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      token,
      user: { id: result.id, username, role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '注册失败', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await getQuery('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    
    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '登录失败', error: error.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await allQuery('SELECT id, username, role, avatar, created_at FROM users');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取用户列表失败', error: error.message });
  }
});

module.exports = router;
