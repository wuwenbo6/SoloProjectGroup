import express from 'express';
import bcrypt from 'bcryptjs';
import { allQuery, runQuery } from '../database';
import { generateToken } from '../middleware/auth';

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const users = allQuery('SELECT * FROM users WHERE username = ?', [username]);
  
  if (users.length === 0) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const user = users[0] as any;
  const isValid = bcrypt.compareSync(password, user.password_hash);
  
  if (!isValid) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = generateToken({ id: user.id, username: user.username, role: user.role });

  const userResponse = {
    id: user.id,
    username: user.username,
    role: user.role,
    avatar: user.avatar,
    createdAt: user.created_at,
  };

  res.json({ token, user: userResponse });
});

router.post('/logout', (req, res) => {
  res.json({ message: '已退出登录' });
});

export default router;
