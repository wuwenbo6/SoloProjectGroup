const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { runQuery, getQuery, allQuery } = require('../database/db');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.get('/', async (req, res) => {
  try {
    const videos = await allQuery(`
      SELECT v.*, s.name as stitch_name 
      FROM videos v 
      LEFT JOIN stitches s ON v.stitch_id = s.id 
      ORDER BY v.created_at DESC
    `);
    res.json({ success: true, videos });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取视频列表失败', error: error.message });
  }
});

router.post('/', upload.single('video'), async (req, res) => {
  try {
    const { stitch_id, title, description, duration } = req.body;
    const video_url = '/uploads/' + req.file.filename;
    
    const result = await runQuery(
      'INSERT INTO videos (stitch_id, title, description, video_url, duration) VALUES (?, ?, ?, ?, ?)',
      [stitch_id, title, description, video_url, duration]
    );
    
    res.json({ success: true, id: result.id, video_url, message: '视频上传成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '上传视频失败', error: error.message });
  }
});

router.post('/feedback', async (req, res) => {
  try {
    const { user_id, stitch_id, step_id, content, rating, image_url } = req.body;
    
    const result = await runQuery(
      'INSERT INTO feedback (user_id, stitch_id, step_id, content, rating, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, stitch_id, step_id, content, rating, image_url]
    );
    
    res.json({ success: true, id: result.id, message: '反馈提交成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '提交反馈失败', error: error.message });
  }
});

router.get('/feedback/:stitchId', async (req, res) => {
  try {
    const feedback = await allQuery(`
      SELECT f.*, u.username 
      FROM feedback f 
      JOIN users u ON f.user_id = u.id 
      WHERE f.stitch_id = ? 
      ORDER BY f.created_at DESC
    `, [req.params.stitchId]);
    
    res.json({ success: true, feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取反馈失败', error: error.message });
  }
});

module.exports = router;
