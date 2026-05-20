const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('../database/db');

router.get('/', async (req, res) => {
  try {
    const stitches = await allQuery('SELECT * FROM stitches ORDER BY created_at DESC');
    res.json({ success: true, stitches });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取针法列表失败', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const stitch = await getQuery('SELECT * FROM stitches WHERE id = ?', [req.params.id]);
    if (!stitch) {
      return res.status(404).json({ success: false, message: '针法不存在' });
    }
    
    const steps = await allQuery('SELECT * FROM stitch_steps WHERE stitch_id = ? ORDER BY step_number', [req.params.id]);
    const videos = await allQuery('SELECT * FROM videos WHERE stitch_id = ?', [req.params.id]);
    
    res.json({ success: true, stitch: { ...stitch, steps, videos } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取针法详情失败', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, difficulty, category, image_url } = req.body;
    
    const result = await runQuery(
      'INSERT INTO stitches (name, description, difficulty, category, image_url) VALUES (?, ?, ?, ?, ?)',
      [name, description, difficulty, category, image_url]
    );
    
    res.json({ success: true, id: result.id, message: '针法创建成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建针法失败', error: error.message });
  }
});

router.post('/:id/steps', async (req, res) => {
  try {
    const { step_number, title, description, image_url } = req.body;
    const stitchId = req.params.id;
    
    const result = await runQuery(
      'INSERT INTO stitch_steps (stitch_id, step_number, title, description, image_url) VALUES (?, ?, ?, ?, ?)',
      [stitchId, step_number, title, description, image_url]
    );
    
    res.json({ success: true, id: result.id, message: '步骤添加成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '添加步骤失败', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM stitches WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除失败', error: error.message });
  }
});

module.exports = router;
