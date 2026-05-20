const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

module.exports = (io) => {
  router.get('/map/:mapId', (req, res) => {
    const { mapId } = req.params;
    db.all(
      'SELECT * FROM annotations WHERE map_id = ? AND is_deleted = 0 ORDER BY created_at DESC',
      [mapId],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        const annotations = rows.map(row => ({
          ...row,
          geometry: JSON.parse(row.geometry),
          style: row.style ? JSON.parse(row.style) : null
        }));
        res.json(annotations);
      }
    );
  });

  router.post('/', (req, res) => {
    const { mapId, type, name, geometry, style, createdBy } = req.body;
    const annotationId = uuidv4();
    
    db.run(
      'INSERT INTO annotations (id, map_id, type, name, geometry, style, created_by, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [annotationId, mapId, type, name, JSON.stringify(geometry), style ? JSON.stringify(style) : null, createdBy],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        db.run(
          'INSERT INTO annotation_versions (annotation_id, version, name, geometry, style, created_by) VALUES (?, 1, ?, ?, ?, ?)',
          [annotationId, name, JSON.stringify(geometry), style ? JSON.stringify(style) : null, createdBy],
          (versionErr) => {
            if (versionErr) {
              console.error('保存版本失败:', versionErr);
            }
          }
        );
        
        const annotation = {
          id: annotationId,
          mapId,
          type,
          name,
          geometry,
          style,
          createdBy,
          version: 1
        };
        io.emit('annotation-created', annotation);
        res.json(annotation);
      }
    );
  });

  router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, geometry, style } = req.body;
    
    db.get('SELECT * FROM annotations WHERE id = ?', [id], (err, annotation) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!annotation) {
        return res.status(404).json({ error: '标注不存在' });
      }

      const newVersion = annotation.version + 1;
      
      db.run(
        'INSERT INTO annotation_versions (annotation_id, version, name, geometry, style, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [id, newVersion, name, JSON.stringify(geometry), style ? JSON.stringify(style) : null, annotation.created_by],
        (versionErr) => {
          if (versionErr) {
            console.error('保存版本失败:', versionErr);
          }
        }
      );

      db.run(
        'UPDATE annotations SET name = ?, geometry = ?, style = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, JSON.stringify(geometry), style ? JSON.stringify(style) : null, newVersion, id],
        function(updateErr) {
          if (updateErr) {
            return res.status(500).json({ error: updateErr.message });
          }
          
          const updated = {
            id,
            mapId: annotation.map_id,
            type: annotation.type,
            name,
            geometry,
            style,
            version: newVersion
          };
          io.emit('annotation-updated', updated);
          res.json(updated);
        }
      );
    });
  });

  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM annotations WHERE id = ?', [id], (err, annotation) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!annotation) {
        return res.status(404).json({ error: '标注不存在' });
      }

      db.run(
        'UPDATE annotations SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id],
        function(deleteErr) {
          if (deleteErr) {
            return res.status(500).json({ error: deleteErr.message });
          }
          
          io.emit('annotation-deleted', { id, mapId: annotation.map_id });
          res.json({ success: true });
        }
      );
    });
  });

  router.get('/:id/versions', (req, res) => {
    const { id } = req.params;
    db.all(
      'SELECT * FROM annotation_versions WHERE annotation_id = ? ORDER BY version DESC',
      [id],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        const versions = rows.map(row => ({
          ...row,
          geometry: JSON.parse(row.geometry),
          style: row.style ? JSON.parse(row.style) : null
        }));
        res.json(versions);
      }
    );
  });

  router.post('/:id/restore/:version', (req, res) => {
    const { id, version } = req.params;
    
    db.get(
      'SELECT * FROM annotation_versions WHERE annotation_id = ? AND version = ?',
      [id, version],
      (err, versionData) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (!versionData) {
          return res.status(404).json({ error: '版本不存在' });
        }

        db.get('SELECT * FROM annotations WHERE id = ?', [id], (annotationErr, annotation) => {
          if (annotationErr) {
            return res.status(500).json({ error: annotationErr.message });
          }

          const newVersion = annotation.version + 1;
          const geometry = JSON.parse(versionData.geometry);
          const style = versionData.style ? JSON.parse(versionData.style) : null;

          db.run(
            'INSERT INTO annotation_versions (annotation_id, version, name, geometry, style, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [id, newVersion, versionData.name, versionData.geometry, versionData.style, versionData.created_by],
            (insertErr) => {
              if (insertErr) {
                return res.status(500).json({ error: insertErr.message });
              }

              db.run(
                'UPDATE annotations SET name = ?, geometry = ?, style = ?, version = ?, updated_at = CURRENT_TIMESTAMP, is_deleted = 0 WHERE id = ?',
                [versionData.name, versionData.geometry, versionData.style, newVersion, id],
                (updateErr) => {
                  if (updateErr) {
                    return res.status(500).json({ error: updateErr.message });
                  }

                  const restored = {
                    id,
                    mapId: annotation.map_id,
                    type: annotation.type,
                    name: versionData.name,
                    geometry,
                    style,
                    version: newVersion
                  };
                  io.emit('annotation-updated', restored);
                  res.json(restored);
                }
              );
            }
          );
        });
      }
    );
  });

  return router;
};
