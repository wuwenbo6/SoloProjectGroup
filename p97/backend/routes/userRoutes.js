const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { userDb } = require('../config/database');

router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  const id = uuidv4();
  const hashedPassword = bcrypt.hashSync(password, 10);

  userDb.run(
    'INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)',
    [id, username, email, hashedPassword],
    (err) => {
      if (err) {
        return res.status(400).json({ error: '用户名或邮箱已存在' });
      }
      res.status(201).json({ id, username, email, message: '注册成功' });
    }
  );
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  userDb.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    if (!user) return res.status(401).json({ error: '用户不存在' });

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '密码错误' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, message: '登录成功' });
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  userDb.get('SELECT id, username, email, avatar, bio, created_at FROM users WHERE id = ?', [id], (err, user) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json(user);
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { username, bio, avatar } = req.body;
  
  userDb.run(
    'UPDATE users SET username = ?, bio = ?, avatar = ? WHERE id = ?',
    [username, bio, avatar, id],
    function(err) {
      if (err) return res.status(500).json({ error: '更新失败' });
      if (this.changes === 0) return res.status(404).json({ error: '用户不存在' });
      res.json({ message: '更新成功' });
    }
  );
});

module.exports = router;
