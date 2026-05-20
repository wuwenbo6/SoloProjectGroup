const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { Client } = require('minio');
const { Pool } = require('pg');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const BUCKET_NAME = 'ancient-books';

async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME);
      const policy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
        }],
      };
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
    }
  } catch (err) {
    console.error('Error ensuring bucket:', err);
  }
}
ensureBucket();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use('/api/users', createProxyMiddleware({
  target: process.env.USER_SERVICE_URL || 'http://user-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/users': '' },
}));

app.post('/api/books', async (req, res) => {
  try {
    const { title, author, dynasty, description, userId } = req.body;

    const result = await pool.query(
      'INSERT INTO books (title, author, dynasty, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, author, dynasty, description, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/books', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, u.username as created_by_name,
             COUNT(DISTINCT p.id) as total_pages
      FROM books b
      LEFT JOIN users u ON b.created_by = u.id
      LEFT JOIN book_pages p ON b.id = p.book_id
      GROUP BY b.id, u.username
      ORDER BY b.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT b.*, u.username as created_by_name
      FROM books b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/books/:id/pages/upload', upload.array('images', 100), async (req, res) => {
  try {
    const { id } = req.params;
    const { startPage = 1 } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedPages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const objectName = `original/${uuidv4()}.jpg`;

      await minioClient.putObject(
        BUCKET_NAME,
        objectName,
        file.buffer,
        file.buffer.length,
        { 'Content-Type': file.mimetype }
      );

      const pageNumber = parseInt(startPage) + i;

      const pageResult = await pool.query(
        'INSERT INTO book_pages (book_id, page_number, original_image_url, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, pageNumber, objectName, 'uploaded']
      );

      uploadedPages.push(pageResult.rows[0]);
    }

    await pool.query(
      'UPDATE books SET total_pages = (SELECT COUNT(*) FROM book_pages WHERE book_id = $1) WHERE id = $1',
      [id]
    );

    res.status(201).json({
      message: 'Pages uploaded successfully',
      pages: uploadedPages,
      count: uploadedPages.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/books/:id/pages', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM book_pages WHERE book_id = $1 ORDER BY page_number ASC',
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/pages/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT p.*, b.title as book_title
      FROM book_pages p
      JOIN books b ON p.book_id = b.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/pages/:id/correct', async (req, res) => {
  try {
    const { id } = req.params;

    const pageResult = await pool.query(
      'SELECT * FROM book_pages WHERE id = $1',
      [id]
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const page = pageResult.rows[0];

    const correctionResponse = await fetch(
      `${process.env.CORRECTION_SERVICE_URL || 'http://correction-service:3002'}/correct`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_name: page.original_image_url }),
      }
    );

    const correctionData = await correctionResponse.json();

    if (correctionData.status === 'success') {
      await pool.query(
        'UPDATE book_pages SET corrected_image_url = $1, status = $2, updated_at = NOW() WHERE id = $3',
        [correctionData.corrected_object, 'corrected', id]
      );
    }

    res.json(correctionData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/pages/:id/segment', async (req, res) => {
  try {
    const { id } = req.params;
    const { lang = 'chi_tra' } = req.body;

    const pageResult = await pool.query(
      'SELECT * FROM book_pages WHERE id = $1',
      [id]
    );

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const page = pageResult.rows[0];
    const imageUrl = page.corrected_image_url || page.original_image_url;

    const segmentResponse = await fetch(
      `${process.env.SEGMENTATION_SERVICE_URL || 'http://segmentation-service:3003'}/segment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_name: imageUrl, lang }),
      }
    );

    const segmentData = await segmentResponse.json();

    if (segmentData.status === 'success') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const line of segmentData.lines) {
          const lineResult = await client.query(
            'INSERT INTO text_lines (page_id, line_number, bounding_box, confidence_score) VALUES ($1, $2, $3, $4) RETURNING *',
            [id, line.line_number, JSON.stringify(line.bounding_box), line.confidence_score]
          );

          await client.query(
            'INSERT INTO annotations (line_id, content, punctuation, version, is_latest) VALUES ($1, $2, $3, $4, $5)',
            [lineResult.rows[0].id, line.original_text, line.punctuation, 1, true]
          );
        }

        await client.query(
          'UPDATE book_pages SET status = $1, updated_at = NOW() WHERE id = $2',
          ['segmented', id]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    res.json(segmentData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/pages/:id/lines', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT l.*, a.content, a.punctuation, a.version as annotation_version
      FROM text_lines l
      LEFT JOIN annotations a ON l.id = a.line_id AND a.is_latest = true
      WHERE l.page_id = $1
      ORDER BY l.line_number ASC
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/lines/:lineId/lock', async (req, res) => {
  try {
    const { lineId } = req.params;
    const { userId } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        'SELECT * FROM annotations WHERE line_id = $1 AND is_latest = true FOR UPDATE',
        [lineId]
      );

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        
        if (existing.lock_owner && existing.lock_owner !== userId) {
          const lockTime = new Date(existing.lock_acquired_at);
          const now = new Date();
          const diffMinutes = (now - lockTime) / (1000 * 60);
          
          if (diffMinutes < 5) {
            await client.query('ROLLBACK');
            return res.status(409).json({
              error: 'Line is locked by another user',
              lock_owner: existing.lock_owner,
              lock_acquired_at: existing.lock_acquired_at
            });
          }
        }

        await client.query(
          'UPDATE annotations SET lock_owner = $1, lock_acquired_at = NOW() WHERE id = $2',
          [userId, existing.id]
        );

        await client.query('COMMIT');
        res.json({ locked: true, version: existing.version });
      } else {
        const newAnnotation = await client.query(
          'INSERT INTO annotations (line_id, content, punctuation, version, is_latest, lock_owner, lock_acquired_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
          [lineId, '', '', 1, true, userId]
        );

        await client.query('COMMIT');
        res.json({ locked: true, version: 1 });
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/lines/:lineId/unlock', async (req, res) => {
  try {
    const { lineId } = req.params;
    const { userId } = req.body;

    await pool.query(
      'UPDATE annotations SET lock_owner = NULL, lock_acquired_at = NULL WHERE line_id = $1 AND lock_owner = $2',
      [lineId, userId]
    );

    res.json({ unlocked: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/lines/:lineId/annotate', async (req, res) => {
  try {
    const { lineId } = req.params;
    const { content, punctuation, userId, expectedVersion } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        'SELECT * FROM annotations WHERE line_id = $1 AND is_latest = true FOR UPDATE',
        [lineId]
      );

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];

        if (expectedVersion !== undefined && existing.version !== expectedVersion) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Version conflict - another user has modified this annotation',
            currentVersion: existing.version,
            expectedVersion: expectedVersion
          });
        }

        if (existing.lock_owner && existing.lock_owner !== userId) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Line is locked by another user',
            lock_owner: existing.lock_owner
          });
        }

        const newVersion = existing.version + 1;

        await client.query(
          'UPDATE annotations SET is_latest = false WHERE id = $1',
          [existing.id]
        );

        await client.query(
          'INSERT INTO annotation_versions (annotation_id, content, punctuation, version, created_by) VALUES ($1, $2, $3, $4, $5)',
          [existing.id, existing.content, existing.punctuation, existing.version, userId]
        );

        const newAnnotation = await client.query(
          'INSERT INTO annotations (line_id, content, punctuation, annotated_by, version, is_latest, lock_owner, lock_acquired_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
          [lineId, content, punctuation, userId, newVersion, true, userId]
        );

        await client.query('COMMIT');
        res.json(newAnnotation.rows[0]);
      } else {
        const newAnnotation = await client.query(
          'INSERT INTO annotations (line_id, content, punctuation, annotated_by, version, is_latest, lock_owner, lock_acquired_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
          [lineId, content, punctuation, userId, 1, true, userId]
        );

        await client.query('COMMIT');
        res.json(newAnnotation.rows[0]);
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/annotations/:annotationId/versions', async (req, res) => {
  try {
    const { annotationId } = req.params;

    const result = await pool.query(`
      SELECT v.*, u.username as created_by_name
      FROM annotation_versions v
      LEFT JOIN users u ON v.created_by = u.id
      WHERE v.annotation_id = $1
      ORDER BY v.version DESC
    `, [annotationId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/annotations/:annotationId/rollback', async (req, res) => {
  try {
    const { annotationId } = req.params;
    const { targetVersion, userId, changeNote = '' } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        'SELECT * FROM annotations WHERE id = $1 AND is_latest = true FOR UPDATE',
        [annotationId]
      );

      if (currentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Annotation not found' });
      }

      const current = currentResult.rows[0];

      if (current.lock_owner && current.lock_owner !== userId) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Annotation is locked by another user',
          lock_owner: current.lock_owner
        });
      }

      if (current.version <= targetVersion) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Cannot rollback to a version higher or equal to current',
          currentVersion: current.version,
          targetVersion: targetVersion
        });
      }

      const targetResult = await client.query(
        'SELECT * FROM annotation_versions WHERE annotation_id = $1 AND version = $2',
        [annotationId, targetVersion]
      );

      if (targetResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Target version not found' });
      }

      const target = targetResult.rows[0];
      const newVersion = current.version + 1;

      await client.query(
        'UPDATE annotations SET is_latest = false WHERE id = $1',
        [annotationId]
      );

      await client.query(
        'INSERT INTO annotation_versions (annotation_id, content, punctuation, version, created_by, change_note) VALUES ($1, $2, $3, $4, $5, $6)',
        [annotationId, current.content, current.punctuation, current.version, userId, changeNote]
      );

      const rolledBackAnnotation = await client.query(
        'INSERT INTO annotations (line_id, content, punctuation, annotated_by, version, is_latest, lock_owner, lock_acquired_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
        [current.line_id, target.content, target.punctuation, userId, newVersion, true, userId]
      );

      await client.query('COMMIT');
      res.json({
        success: true,
        message: `Rolled back from version ${current.version} to ${targetVersion} (new version ${newVersion})`,
        annotation: rolledBackAnnotation.rows[0],
        rollback_from: current.version,
        rollback_to: targetVersion,
        new_version: newVersion
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/lines/:lineId/annotate/rollback', async (req, res) => {
  try {
    const { lineId } = req.params;
    const { targetVersion, userId, changeNote } = req.body;

    const annotationResult = await pool.query(
      'SELECT id FROM annotations WHERE line_id = $1 AND is_latest = true',
      [lineId]
    );

    if (annotationResult.rows.length === 0) {
      return res.status(404).json({ error: 'No annotation found for this line' });
    }

    req.params.annotationId = annotationResult.rows[0].id;
    return app.handle(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/books/:id/collaborators', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, permission = 'viewer' } = req.body;

    const result = await pool.query(
      'INSERT INTO collaborations (book_id, user_id, permission_level) VALUES ($1, $2, $3) ON CONFLICT (book_id, user_id) DO UPDATE SET permission_level = $3 RETURNING *',
      [id, userId, permission]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/books/:id/collaborators', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT c.*, u.username, u.email
      FROM collaborations c
      JOIN users u ON c.user_id = u.id
      WHERE c.book_id = $1
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/annotations/export', async (req, res) => {
  try {
    const { bookId, format = 'json', includePunctuation = true } = req.body;

    const pages = await pool.query(
      'SELECT id, page_number FROM book_pages WHERE book_id = $1 ORDER BY page_number',
      [bookId]
    );

    const annotations = [];
    for (const page of pages.rows) {
      const result = await pool.query(`
        SELECT l.line_number, a.content, a.punctuation, a.annotated_at, u.username as annotator
        FROM text_lines l
        LEFT JOIN annotations a ON l.id = a.line_id AND a.is_latest = true
        LEFT JOIN users u ON a.annotated_by = u.id
        WHERE l.page_id = $1
        ORDER BY l.line_number
      `, [page.id]);
      
      annotations.push({
        page_number: page.page_number,
        lines: result.rows
      });
    }

    if (format === 'json') {
      res.json({
        success: true,
        book_id: bookId,
        format: format,
        annotations: annotations
      });
    } else if (format === 'txt') {
      const text = annotations.map(page => {
        return `=== 第 ${page.page_number} 页 ===\n` +
          page.lines.map(line => `第${line.line_number}行: ${line.content || ''}`).join('\n');
      }).join('\n\n');
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(text);
    } else if (format === 'csv') {
      let csv = '页码,行号,内容,标注人,标注时间\n';
      annotations.forEach(page => {
        page.lines.forEach(line => {
          csv += `${page.page_number},${line.line_number},"${(line.content || '').replace(/"/g, '""')}","${line.annotator || ''}","${line.annotated_at || ''}"\n`;
        });
      });
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(csv);
    } else {
      res.status(400).json({ error: 'Unsupported format' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/permissions/:bookId/:userId', async (req, res) => {
  try {
    const { bookId, userId } = req.params;

    const result = await pool.query(
      'SELECT * FROM annotation_permissions WHERE book_id = $1 AND user_id = $2',
      [bookId, userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        permission_level: 'viewer',
        can_view: true,
        can_annotate: false,
        can_review: false,
        can_manage: false
      });
    }

    const perm = result.rows[0];
    const level = perm.permission_level;

    res.json({
      permission_level: level,
      can_view: true,
      can_annotate: ['annotator', 'reviewer', 'editor', 'owner', 'admin'].includes(level),
      can_review: ['reviewer', 'editor', 'owner', 'admin'].includes(level),
      can_manage: ['owner', 'admin'].includes(level),
      granted_by: perm.granted_by,
      granted_at: perm.granted_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/permissions/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { userId, permissionLevel, grantedBy } = req.body;

    const result = await pool.query(
      `INSERT INTO annotation_permissions (book_id, user_id, permission_level, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (book_id, user_id) DO UPDATE SET permission_level = $3
       RETURNING *`,
      [bookId, userId, permissionLevel, grantedBy]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/permissions/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;

    const result = await pool.query(`
      SELECT p.*, u.username, u.email
      FROM annotation_permissions p
      JOIN users u ON p.user_id = u.id
      WHERE p.book_id = $1
    `, [bookId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/variant-chars', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM variant_chars';
    const params = [];

    if (search) {
      query += ' WHERE variant_char LIKE $1 OR standard_char LIKE $1';
      params.push(`%${search}%`);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/variant-chars', async (req, res) => {
  try {
    const { variant_char, standard_char, similarity_score, source, userId } = req.body;

    const result = await pool.query(
      `INSERT INTO variant_chars (variant_char, standard_char, similarity_score, source)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [variant_char, standard_char, similarity_score || 1.0, source]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/punctuation-rules', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM punctuation_rules WHERE is_active = true ORDER BY confidence_score DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/model-feedback', async (req, res) => {
  try {
    const { annotationId, originalContent, correctedContent, feedbackType, userId } = req.body;

    const result = await pool.query(
      `INSERT INTO model_feedback (annotation_id, original_content, corrected_content, feedback_type, submitted_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [annotationId, originalContent, correctedContent, feedbackType, userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/model/performance', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_annotations,
        COUNT(CASE WHEN m.feedback_type = 'correction' THEN 1 END) as corrections,
        COUNT(CASE WHEN m.feedback_type = 'accept' THEN 1 END) as accepts,
        AVG(p.confidence_score) as avg_confidence
      FROM annotations a
      LEFT JOIN model_feedback m ON a.id = m.annotation_id
      LEFT JOIN punctuation_rules p ON p.is_active = true
      WHERE a.is_latest = true
    `);

    const rules = await pool.query(
      'SELECT rule_pattern, punctuation_type, confidence_score, usage_count, success_count FROM punctuation_rules WHERE is_active = true'
    );

    res.json({
      summary: result.rows[0],
      rules: rules.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
