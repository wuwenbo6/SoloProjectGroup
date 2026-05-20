const jwt = require('jsonwebtoken');
const { pool } = require('../database');

const getUserIdFromToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.userId;
};

exports.createScene = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name } = req.body;

    await client.query('BEGIN');

    const sceneResult = await client.query(
      'INSERT INTO scenes (name, owner_id) VALUES ($1, $2) RETURNING id, name, owner_id, created_at',
      [name || 'Untitled Scene', userId]
    );
    
    const sceneId = sceneResult.rows[0].id;

    await client.query(
      'INSERT INTO scene_members (scene_id, user_id) VALUES ($1, $2)',
      [sceneId, userId]
    );

    const branchResult = await client.query(
      `INSERT INTO scene_branches (scene_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [sceneId, 'main', 'Default main branch', userId]
    );

    const branchId = branchResult.rows[0].id;

    const commitResult = await client.query(
      `INSERT INTO scene_commits 
       (scene_id, branch_id, parent_ids, message, snapshot_data, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [sceneId, branchId, [], 'Initial commit', [], userId]
    );

    const commitId = commitResult.rows[0].id;

    await client.query(
      `INSERT INTO scene_branch_head (scene_id, branch_id, commit_id)
       VALUES ($1, $2, $3)`,
      [sceneId, branchId, commitId]
    );

    await client.query('COMMIT');

    res.status(201).json(sceneResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create scene error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

exports.getScenes = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT s.id, s.name, s.owner_id, s.created_at, s.updated_at
       FROM scenes s
       JOIN scene_members sm ON s.id = sm.scene_id
       WHERE sm.user_id = $1
       ORDER BY s.updated_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get scenes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getSceneById = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const memberCheck = await pool.query(
      'SELECT * FROM scene_members WHERE scene_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'SELECT * FROM scenes WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get scene error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.joinScene = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const sceneCheck = await pool.query(
      'SELECT * FROM scenes WHERE id = $1',
      [id]
    );

    if (sceneCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    await pool.query(
      'INSERT INTO scene_members (scene_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, userId]
    );

    res.json({ success: true, scene: sceneCheck.rows[0] });
  } catch (err) {
    console.error('Join scene error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteScene = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const ownerCheck = await pool.query(
      'SELECT * FROM scenes WHERE id = $1 AND owner_id = $2',
      [id, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only owner can delete scene' });
    }

    await pool.query('DELETE FROM scenes WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete scene error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getSnapshots = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sceneId } = req.params;

    const memberCheck = await pool.query(
      'SELECT * FROM scene_members WHERE scene_id = $1 AND user_id = $2',
      [sceneId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT ss.id, ss.version, ss.created_at, u.username as created_by_name
       FROM scene_snapshots ss
       LEFT JOIN users u ON ss.created_by = u.id
       WHERE ss.scene_id = $1
       ORDER BY ss.version DESC`,
      [sceneId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get snapshots error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
