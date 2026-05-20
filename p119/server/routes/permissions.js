const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/map/:mapId', (req, res) => {
  const { mapId } = req.params;
  db.all(
    `SELECT mp.*, u.name as user_name 
     FROM map_permissions mp 
     JOIN users u ON mp.user_id = u.id 
     WHERE mp.map_id = ?`,
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
  const { mapId, userId, permissionLevel, grantedBy } = req.body;
  
  db.run(
    `INSERT OR REPLACE INTO map_permissions (map_id, user_id, permission_level, granted_by) 
     VALUES (?, ?, ?, ?)`,
    [mapId, userId, permissionLevel, grantedBy],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

router.delete('/:mapId/:userId', (req, res) => {
  const { mapId, userId } = req.params;
  
  db.run(
    'DELETE FROM map_permissions WHERE map_id = ? AND user_id = ?',
    [mapId, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

router.get('/user/:userId/map/:mapId', (req, res) => {
  const { userId, mapId } = req.params;
  
  db.get(
    `SELECT m.owner_id, mp.permission_level 
     FROM maps m 
     LEFT JOIN map_permissions mp ON m.id = mp.map_id AND mp.user_id = ?
     WHERE m.id = ?`,
    [userId, mapId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      let permission = 'none';
      if (row) {
        if (row.owner_id === userId) {
          permission = 'owner';
        } else if (row.permission_level) {
          permission = row.permission_level;
        }
      }
      
      res.json({ permission });
    }
  );
});

module.exports = router;
