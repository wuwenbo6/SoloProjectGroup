const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('../database/db');

router.get('/', async (req, res) => {
  try {
    const questions = await allQuery(`
      SELECT q.*, u.username, u.role, s.name as stitch_name 
      FROM questions q 
      JOIN users u ON q.user_id = u.id 
      LEFT JOIN stitches s ON q.stitch_id = s.id 
      ORDER BY q.created_at DESC
    `);
    
    res.json({ success: true, questions });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取问题列表失败', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const question = await getQuery(`
      SELECT q.*, u.username, u.role, s.name as stitch_name 
      FROM questions q 
      JOIN users u ON q.user_id = u.id 
      LEFT JOIN stitches s ON q.stitch_id = s.id 
      WHERE q.id = ?
    `, [req.params.id]);
    
    if (!question) {
      return res.status(404).json({ success: false, message: '问题不存在' });
    }
    
    const answers = await allQuery(`
      SELECT a.*, u.username, u.role 
      FROM answers a 
      JOIN users u ON a.user_id = u.id 
      WHERE a.question_id = ? 
      ORDER BY a.created_at ASC
    `, [req.params.id]);
    
    res.json({ success: true, question: { ...question, answers } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取问题详情失败', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { user_id, stitch_id, title, content } = req.body;
    
    const result = await runQuery(
      'INSERT INTO questions (user_id, stitch_id, title, content) VALUES (?, ?, ?, ?)',
      [user_id, stitch_id, title, content]
    );
    
    res.json({ success: true, id: result.id, message: '问题发布成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '发布问题失败', error: error.message });
  }
});

router.post('/:id/answers', async (req, res) => {
  try {
    const { user_id, content, is_teacher } = req.body;
    
    const result = await runQuery(
      'INSERT INTO answers (question_id, user_id, content, is_teacher) VALUES (?, ?, ?, ?)',
      [req.params.id, user_id, content, is_teacher ? 1 : 0]
    );
    
    res.json({ success: true, id: result.id, message: '回答发布成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '发布回答失败', error: error.message });
  }
});

module.exports = router;
