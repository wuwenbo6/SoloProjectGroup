import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { allQuery, runQuery } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

router.get('/image/:imageId', (req, res) => {
  const versions = allQuery(`
    SELECT * FROM versions 
    WHERE image_id = ? 
    ORDER BY version_number DESC
  `, [req.params.imageId]);

  const formattedVersions = versions.map((v: any) => ({
    ...v,
    versionNumber: v.version_number,
    authorId: v.author_id,
    authorName: v.author_name,
    createdAt: v.created_at,
    data: JSON.parse(v.data),
  }));

  res.json(formattedVersions);
});

router.get('/:id', (req, res) => {
  const versions = allQuery('SELECT * FROM versions WHERE id = ?', [req.params.id]);

  if (versions.length === 0) {
    return res.status(404).json({ error: '版本不存在' });
  }

  const v = versions[0] as any;
  res.json({
    ...v,
    versionNumber: v.version_number,
    authorId: v.author_id,
    authorName: v.author_name,
    createdAt: v.created_at,
    data: JSON.parse(v.data),
  });
});

router.post('/image/:imageId', (req: AuthRequest, res) => {
  const { comment, data } = req.body;
  const imageId = req.params.imageId;

  if (!data) {
    return res.status(400).json({ error: '版本数据不能为空' });
  }

  const maxVersions = allQuery(`
    SELECT MAX(version_number) as maxVersion 
    FROM versions 
    WHERE image_id = ?
  `, [imageId]);

  const versionNumber = ((maxVersions[0] as any)?.maxVersion || 0) + 1;
  const now = new Date().toISOString();
  const versionId = uuidv4();

  runQuery(
    `INSERT INTO versions (id, image_id, version_number, author_id, author_name, comment, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      versionId,
      imageId,
      versionNumber,
      req.user!.id,
      req.user!.username,
      comment || null,
      JSON.stringify(data),
      now
    ]
  );

  const versions = allQuery('SELECT * FROM versions WHERE id = ?', [versionId]);
  const v = versions[0] as any;
  
  res.status(201).json({
    ...v,
    versionNumber: v.version_number,
    authorId: v.author_id,
    authorName: v.author_name,
    createdAt: v.created_at,
    data: JSON.parse(v.data),
  });
});

router.post('/:id/rollback', (req: AuthRequest, res) => {
  try {
    const versions = allQuery('SELECT * FROM versions WHERE id = ?', [req.params.id]);

    if (versions.length === 0) {
      return res.status(404).json({ error: '版本不存在' });
    }

    const version = versions[0] as any;
    let blocks;
    try {
      blocks = JSON.parse(version.data);
    } catch (e) {
      return res.status(400).json({ error: '版本数据格式错误' });
    }
    
    if (!Array.isArray(blocks)) {
      return res.status(400).json({ error: '版本数据格式错误' });
    }

    const now = new Date().toISOString();
    const imageId = version.image_id;

    const currentBlocks = allQuery('SELECT id FROM text_blocks WHERE image_id = ?', [imageId]);
    const existingBlockIds = new Set(currentBlocks.map((b: any) => b.id));

    for (const block of blocks) {
      if (!block.id) continue;

      if (existingBlockIds.has(block.id)) {
        runQuery(
          `UPDATE text_blocks 
           SET corrected_text = ?, status = ?, updated_at = ?
           WHERE id = ?`,
          [block.correctedText || null, block.status || 'confirmed', now, block.id]
        );
      } else {
        runQuery(
          `INSERT INTO text_blocks (id, image_id, x, y, width, height, recognized_text, corrected_text, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            block.id,
            imageId,
            block.x || 0,
            block.y || 0,
            block.width || 0,
            block.height || 0,
            block.recognizedText || '',
            block.correctedText || null,
            block.status || 'confirmed',
            now,
            now
          ]
        );
      }
    }

    const currentBlockIds = new Set(currentBlocks.map((b: any) => b.id));
    const versionBlockIds = new Set(blocks.map((b: any) => b.id));
    
    for (const blockId of currentBlockIds) {
      if (!versionBlockIds.has(blockId)) {
        runQuery('DELETE FROM text_blocks WHERE id = ?', [blockId]);
      }
    }

    const newVersionId = uuidv4();
    const maxVersions = allQuery(`
      SELECT MAX(version_number) as maxVersion 
      FROM versions 
      WHERE image_id = ?
    `, [imageId]);

    const maxVersion = (maxVersions[0] as any)?.maxVersion;
    const newVersionNumber = (Number(maxVersion) || 0) + 1;

    runQuery(
      `INSERT INTO versions (id, image_id, version_number, author_id, author_name, comment, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newVersionId,
        imageId,
        newVersionNumber,
        req.user!.id,
        req.user!.username,
        `回滚到版本 ${version.version_number}`,
        version.data,
        now
      ]
    );

    const newVersions = allQuery('SELECT * FROM versions WHERE id = ?', [newVersionId]);
    if (newVersions.length === 0) {
      return res.status(500).json({ error: '创建新版本失败' });
    }

    const newV = newVersions[0] as any;
    
    res.json({
      ...newV,
      versionNumber: newV.version_number,
      authorId: newV.author_id,
      authorName: newV.author_name,
      createdAt: newV.created_at,
      data: JSON.parse(newV.data),
    });
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: '回滚失败: ' + (error as Error).message });
  }
});

export default router;
