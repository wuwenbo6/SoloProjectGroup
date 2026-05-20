const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('../database/db');

router.get('/:userId', async (req, res) => {
  try {
    const progress = await allQuery(`
      SELECT sp.*, s.name as stitch_name, s.difficulty, s.image_url 
      FROM student_progress sp 
      JOIN stitches s ON sp.stitch_id = s.id 
      WHERE sp.user_id = ?
      ORDER BY sp.last_studied_at DESC
    `, [req.params.userId]);
    
    res.json({ success: true, progress });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取学习进度失败', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { user_id, stitch_id, progress, completed } = req.body;
    
    const existing = await getQuery(
      'SELECT * FROM student_progress WHERE user_id = ? AND stitch_id = ?',
      [user_id, stitch_id]
    );
    
    if (existing) {
      await runQuery(
        'UPDATE student_progress SET progress = ?, completed = ?, last_studied_at = CURRENT_TIMESTAMP WHERE user_id = ? AND stitch_id = ?',
        [progress, completed ? 1 : 0, user_id, stitch_id]
      );
    } else {
      await runQuery(
        'INSERT INTO student_progress (user_id, stitch_id, progress, completed, last_studied_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [user_id, stitch_id, progress, completed ? 1 : 0]
      );
    }
    
    res.json({ success: true, message: '进度更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新进度失败', error: error.message });
  }
});

router.get('/stats/:userId', async (req, res) => {
  try {
    const stats = await getQuery(`
      SELECT 
        COUNT(*) as total_stitches,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_stitches,
        AVG(progress) as average_progress
      FROM student_progress 
      WHERE user_id = ?
    `, [req.params.userId]);
    
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取统计数据失败', error: error.message });
  }
});

module.exports = router;
