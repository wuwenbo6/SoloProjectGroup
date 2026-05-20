import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, allQuery } from '../database';

const router = express.Router();

router.get('/queue/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;
    
    let sql = 'SELECT * FROM offline_sync_queue WHERE user_id = ?';
    const params: any[] = [userId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at ASC';
    const queue = allQuery(sql, params);
    res.json(queue);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/queue', async (req, res) => {
  try {
    const { user_id, operation_type, entity_type, entity_id, data } = req.body;
    
    if (!user_id || !operation_type || !entity_type || !entity_id || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4();
    runQuery(
      'INSERT INTO offline_sync_queue (id, user_id, operation_type, entity_type, entity_id, data, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, user_id, operation_type, entity_type, entity_id, JSON.stringify(data), 'pending']
    );

    const item = allQuery('SELECT * FROM offline_sync_queue WHERE id = ?', [id])[0];
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const { user_id, items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const item of items) {
      try {
        const { operation_type, entity_type, entity_id, data } = item;
        let result: any = { entity_id, operation_type, entity_type };

        switch (entity_type) {
          case 'text_block':
            if (operation_type === 'create') {
              runQuery(
                'INSERT OR IGNORE INTO text_blocks (id, image_id, x, y, width, height, recognized_text, corrected_text, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                [entity_id, data.image_id, data.x, data.y, data.width, data.height, data.recognized_text, data.corrected_text, data.status || 'pending']
              );
              result.success = true;
            } else if (operation_type === 'update') {
              runQuery(
                'UPDATE text_blocks SET corrected_text = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [data.corrected_text, data.status, entity_id]
              );
              result.success = true;
            } else if (operation_type === 'delete') {
              runQuery('DELETE FROM text_blocks WHERE id = ?', [entity_id]);
              result.success = true;
            }
            break;

          case 'annotation':
            if (operation_type === 'create') {
              runQuery(
                'INSERT OR IGNORE INTO annotations (id, block_id, image_id, type, content, author_id, author_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                [entity_id, data.block_id, data.image_id, data.type || 'comment', data.content, data.author_id, data.author_name]
              );
              result.success = true;
            } else if (operation_type === 'update') {
              runQuery(
                'UPDATE annotations SET content = ?, type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [data.content, data.type, entity_id]
              );
              result.success = true;
            } else if (operation_type === 'delete') {
              runQuery('DELETE FROM annotations WHERE id = ?', [entity_id]);
              result.success = true;
            }
            break;

          default:
            result.success = false;
            result.error = 'Unknown entity type';
        }

        if (result.success) {
          successCount++;
          runQuery(
            'UPDATE offline_sync_queue SET status = ?, synced_at = CURRENT_TIMESTAMP WHERE entity_id = ? AND user_id = ?',
            ['synced', entity_id, user_id]
          );
        } else {
          errorCount++;
          runQuery(
            'UPDATE offline_sync_queue SET status = ?, error_message = ?, synced_at = CURRENT_TIMESTAMP WHERE entity_id = ? AND user_id = ?',
            ['error', result.error, entity_id, user_id]
          );
        }

        results.push(result);
      } catch (e: any) {
        errorCount++;
        results.push({ entity_id: item.entity_id, success: false, error: e.message });
      }
    }

    res.json({
      success: true,
      summary: { total: items.length, success: successCount, errors: errorCount },
      results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/full-sync-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { last_sync } = req.query;

    const projects = allQuery(`
      SELECT DISTINCT p.* FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ?
    `, [userId]);

    const projectIds = projects.map((p: any) => p.id);
    const placeholders = projectIds.map(() => '?').join(',');

    const images = projectIds.length > 0 ? allQuery(`
      SELECT * FROM images WHERE project_id IN (${placeholders})
    `, projectIds) : [];

    const imageIds = images.map((i: any) => i.id);
    const imagePlaceholders = imageIds.map(() => '?').join(',');

    const textBlocks = imageIds.length > 0 ? allQuery(`
      SELECT * FROM text_blocks WHERE image_id IN (${imagePlaceholders})
    `, imageIds) : [];

    const annotations = imageIds.length > 0 ? allQuery(`
      SELECT * FROM annotations WHERE image_id IN (${imagePlaceholders})
    `, imageIds) : [];

    const versions = imageIds.length > 0 ? allQuery(`
      SELECT * FROM versions WHERE image_id IN (${imagePlaceholders}) ORDER BY version_number DESC
    `, imageIds) : [];

    res.json({
      timestamp: new Date().toISOString(),
      projects,
      images,
      text_blocks: textBlocks,
      annotations,
      versions,
      statistics: {
        projects: projects.length,
        images: images.length,
        text_blocks: textBlocks.length,
        annotations: annotations.length,
        versions: versions.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/queue/:id', async (req, res) => {
  try {
    const { id } = req.params;
    runQuery('DELETE FROM offline_sync_queue WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/queue/clear/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;
    
    let sql = 'DELETE FROM offline_sync_queue WHERE user_id = ?';
    const params: any[] = [userId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    runQuery(sql, params);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;