const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/map/:mapId', (req, res) => {
  const { mapId } = req.params;
  db.all(
    'SELECT * FROM layers WHERE map_id = ? ORDER BY sort_order ASC, id ASC',
    [mapId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

router.post('/', (req, res) => {
  const { mapId, name, type, color } = req.body;
  
  db.get('SELECT MAX(sort_order) as max_order FROM layers WHERE map_id = ?', [mapId], (err, result) => {
    const sortOrder = (result?.max_order || 0) + 1;
    
    db.run(
      'INSERT INTO layers (map_id, name, type, color, sort_order) VALUES (?, ?, ?, ?, ?)',
      [mapId, name, type || 'annotation', color || '#3498db', sortOrder],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          id: this.lastID,
          mapId,
          name,
          type: type || 'annotation',
          color: color || '#3498db',
          visible: 1,
          sort_order: sortOrder
        });
      }
    );
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, color, visible, sort_order } = req.body;
  
  const updates = [];
  const values = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (color !== undefined) {
    updates.push('color = ?');
    values.push(color);
  }
  if (visible !== undefined) {
    updates.push('visible = ?');
    values.push(visible);
  }
  if (sort_order !== undefined) {
    updates.push('sort_order = ?');
    values.push(sort_order);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有提供更新字段' });
  }
  
  values.push(id);
  
  db.run(
    `UPDATE layers SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('UPDATE annotations SET layer_id = NULL WHERE layer_id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.run('DELETE FROM layers WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) {
        return res.status(500).json({ error: deleteErr.message });
      }
      res.json({ success: true });
    });
  });
});

module.exports = router;
