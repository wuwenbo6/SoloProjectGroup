const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

module.exports = (upload, io) => {
  router.post('/upload', upload.single('map'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const mapId = uuidv4();
    const { name } = req.body;
    
    db.run(
      'INSERT INTO maps (id, name, filename) VALUES (?, ?, ?)',
      [mapId, name || req.file.originalname, req.file.filename],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          id: mapId,
          name: name || req.file.originalname,
          filename: req.file.filename,
          url: `http://localhost:5000/uploads/${req.file.filename}`
        });
      }
    );
  });

  router.get('/', (req, res) => {
    db.all('SELECT * FROM maps ORDER BY upload_date DESC', [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const maps = rows.map(row => ({
        ...row,
        url: `http://localhost:5000/uploads/${row.filename}`
      }));
      res.json(maps);
    });
  });

  router.get('/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM maps WHERE id = ?', [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: '地图不存在' });
      }
      res.json({
        ...row,
        url: `http://localhost:5000/uploads/${row.filename}`
      });
    });
  });

  router.post('/:id/control-points', (req, res) => {
    const { id } = req.params;
    const { x, y, lon, lat } = req.body;
    
    db.run(
      'INSERT INTO control_points (map_id, x, y, lon, lat) VALUES (?, ?, ?, ?, ?)',
      [id, x, y, lon, lat],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        const point = { id: this.lastID, mapId: id, x, y, lon, lat };
        io.emit('control-point-added', point);
        res.json(point);
      }
    );
  });

  router.get('/:id/control-points', (req, res) => {
    const { id } = req.params;
    db.all('SELECT * FROM control_points WHERE map_id = ? ORDER BY created_at DESC', [id], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  router.delete('/:mapId/control-points/:pointId', (req, res) => {
    const { mapId, pointId } = req.params;
    db.run('DELETE FROM control_points WHERE id = ? AND map_id = ?', [pointId, mapId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '控制点不存在' });
      }
      res.json({ success: true });
    });
  });

  router.put('/:id/dimensions', (req, res) => {
    const { id } = req.params;
    const { width, height } = req.body;
    
    db.run(
      'UPDATE maps SET width = ?, height = ?, status = ? WHERE id = ?',
      [width, height, 'ready', id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
      }
    );
  });

  return router;
};
