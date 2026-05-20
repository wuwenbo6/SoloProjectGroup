const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/annotation/:annotationId', (req, res) => {
  const { annotationId } = req.params;
  db.all(
    'SELECT * FROM name_relations WHERE annotation_id = ? ORDER BY created_at DESC',
    [annotationId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

router.get('/map/:mapId', (req, res) => {
  const { mapId } = req.params;
  db.all(
    `SELECT nr.*, a.name as annotation_name, a.type as annotation_type
     FROM name_relations nr
     JOIN annotations a ON nr.annotation_id = a.id
     WHERE a.map_id = ? AND a.is_deleted = 0`,
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
  const { annotationId, ancientName, modernName, relationType, confidence, source, notes, createdBy } = req.body;
  
  db.run(
    `INSERT INTO name_relations (annotation_id, ancient_name, modern_name, relation_type, confidence, source, notes, created_by) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [annotationId, ancientName, modernName, relationType || 'same', confidence || 1.0, source, notes, createdBy],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        annotationId,
        ancientName,
        modernName,
        relationType: relationType || 'same',
        confidence: confidence || 1.0
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { ancientName, modernName, relationType, confidence, source, notes } = req.body;
  
  const updates = [];
  const values = [];
  
  if (ancientName !== undefined) {
    updates.push('ancient_name = ?');
    values.push(ancientName);
  }
  if (modernName !== undefined) {
    updates.push('modern_name = ?');
    values.push(modernName);
  }
  if (relationType !== undefined) {
    updates.push('relation_type = ?');
    values.push(relationType);
  }
  if (confidence !== undefined) {
    updates.push('confidence = ?');
    values.push(confidence);
  }
  if (source !== undefined) {
    updates.push('source = ?');
    values.push(source);
  }
  if (notes !== undefined) {
    updates.push('notes = ?');
    values.push(notes);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有提供更新字段' });
  }
  
  values.push(id);
  
  db.run(
    `UPDATE name_relations SET ${updates.join(', ')} WHERE id = ?`,
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
  
  db.run('DELETE FROM name_relations WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

module.exports = router;
