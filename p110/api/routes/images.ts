import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import { allQuery, runQuery } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  },
});

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res) => {
  const { projectId } = req.query;
  
  let sql = `
    SELECT i.*, 
           COUNT(tb.id) as blockCount,
           u.username as uploadedByUsername
    FROM images i
    LEFT JOIN text_blocks tb ON i.id = tb.image_id
    LEFT JOIN users u ON i.uploaded_by = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (projectId) {
    sql += ' AND i.project_id = ?';
    params.push(projectId);
  }

  sql += ' GROUP BY i.id ORDER BY i.created_at DESC';

  const images = allQuery(sql, params);
  res.json(images);
});

router.get('/:id', (req, res) => {
  const images = allQuery(`
    SELECT i.*, u.username as uploadedByUsername
    FROM images i
    LEFT JOIN users u ON i.uploaded_by = u.id
    WHERE i.id = ?
  `, [req.params.id]);

  if (images.length === 0) {
    return res.status(404).json({ error: '图像不存在' });
  }

  res.json(images[0]);
});

router.post('/', upload.single('image'), async (req: AuthRequest, res) => {
  try {
    const { projectId, name } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const metadata = await sharp(file.path).metadata();
    const thumbnailFilename = `thumb_${file.filename}`;
    const thumbnailPath = path.join(uploadDir, thumbnailFilename);
    
    await sharp(file.path)
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .toFile(thumbnailPath);

    const imageId = uuidv4();
    const now = new Date().toISOString();
    const imageName = name || file.originalname;

    runQuery(
      `INSERT INTO images (id, name, original_name, file_path, thumbnail_path, 
                          width, height, file_size, project_id, uploaded_by, 
                          status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        imageId,
        imageName,
        file.originalname,
        file.filename,
        thumbnailFilename,
        metadata.width,
        metadata.height,
        file.size,
        projectId || null,
        req.user!.id,
        'uploaded',
        now,
        now
      ]
    );

    const images = allQuery('SELECT * FROM images WHERE id = ?', [imageId]);
    res.status(201).json(images[0]);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

router.post('/:id/segment', async (req, res) => {
  try {
    const images = allQuery('SELECT * FROM images WHERE id = ?', [req.params.id]);
    if (images.length === 0) {
      return res.status(404).json({ error: '图像不存在' });
    }

    const image = images[0] as any;
    const imagePath = path.join(uploadDir, image.file_path);
    
    const worker = await Tesseract.createWorker('chi_sim+eng');
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });
    
    const { data } = await worker.recognize(imagePath);
    await worker.terminate();

    runQuery('DELETE FROM text_blocks WHERE image_id = ?', [image.id]);

    const blocks: any[] = [];
    const now = new Date().toISOString();

    const lines = data.lines || [];
    for (const line of lines) {
      const lineBbox = line.bbox;
      const lineText = line.text.trim();
      
      if (lineText && lineBbox) {
        const blockId = uuidv4();
        
        runQuery(
          `INSERT INTO text_blocks (id, image_id, x, y, width, height, 
                                   recognized_text, confidence, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            blockId,
            image.id,
            Math.round(lineBbox.x0),
            Math.round(lineBbox.y0),
            Math.round(lineBbox.x1 - lineBbox.x0),
            Math.round(lineBbox.y1 - lineBbox.y0),
            lineText,
            line.confidence || 0,
            'pending',
            now,
            now
          ]
        );

        blocks.push({
          id: blockId,
          imageId: image.id,
          x: Math.round(lineBbox.x0),
          y: Math.round(lineBbox.y0),
          width: Math.round(lineBbox.x1 - lineBbox.x0),
          height: Math.round(lineBbox.y1 - lineBbox.y0),
          recognizedText: lineText,
          confidence: line.confidence || 0,
          status: 'pending',
        });
      }
    }

    if (blocks.length === 0) {
      for (const word of data.words || []) {
        const blockId = uuidv4();
        const { bbox } = word;
        
        if (bbox && word.text) {
          runQuery(
            `INSERT INTO text_blocks (id, image_id, x, y, width, height, 
                                     recognized_text, confidence, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              blockId,
              image.id,
              Math.round(bbox.x0),
              Math.round(bbox.y0),
              Math.round(bbox.x1 - bbox.x0),
              Math.round(bbox.y1 - bbox.y0),
              word.text.trim(),
              word.confidence || 0,
              'pending',
              now,
              now
            ]
          );

          blocks.push({
            id: blockId,
            imageId: image.id,
            x: Math.round(bbox.x0),
            y: Math.round(bbox.y0),
            width: Math.round(bbox.x1 - bbox.x0),
            height: Math.round(bbox.y1 - bbox.y0),
            recognizedText: word.text.trim(),
            confidence: word.confidence || 0,
            status: 'pending',
          });
        }
      }
    }

    runQuery(
      "UPDATE images SET status = 'recognized', updated_at = ? WHERE id = ?",
      [now, image.id]
    );

    res.json(blocks);
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: '文字识别失败: ' + (error as Error).message });
  }
});

router.get('/:id/blocks', (req, res) => {
  const blocks = allQuery(`
    SELECT tb.*, u.username as annotatedByUsername
    FROM text_blocks tb
    LEFT JOIN users u ON tb.annotated_by = u.id
    WHERE tb.image_id = ?
    ORDER BY tb.y, tb.x
  `, [req.params.id]);

  const formattedBlocks = blocks.map((block: any) => ({
    ...block,
    recognizedText: block.recognized_text,
    correctedText: block.corrected_text,
    annotatedBy: block.annotated_by,
    createdAt: block.created_at,
    updatedAt: block.updated_at,
  }));

  res.json(formattedBlocks);
});

router.put('/blocks/:id', (req: AuthRequest, res) => {
  const { correctedText, status, lastUpdatedAt } = req.body;
  const blockId = req.params.id;
  const now = new Date().toISOString();

  const blocks = allQuery('SELECT * FROM text_blocks WHERE id = ?', [blockId]);
  if (blocks.length === 0) {
    return res.status(404).json({ error: '文字块不存在' });
  }

  const currentBlock = blocks[0] as any;
  
  if (lastUpdatedAt && currentBlock.updated_at !== lastUpdatedAt) {
    return res.status(409).json({
      error: '该标注已被其他用户修改，请刷新后重试',
      currentBlock: {
        ...currentBlock,
        recognizedText: currentBlock.recognized_text,
        correctedText: currentBlock.corrected_text,
        createdAt: currentBlock.created_at,
        updatedAt: currentBlock.updated_at,
      }
    });
  }

  runQuery(
    `UPDATE text_blocks 
     SET corrected_text = ?, status = ?, annotated_by = ?, updated_at = ?
     WHERE id = ?`,
    [correctedText || null, status || 'confirmed', req.user!.id, now, blockId]
  );

  const updatedBlocks = allQuery('SELECT * FROM text_blocks WHERE id = ?', [blockId]);
  const updatedBlock = updatedBlocks[0] as any;
  
  res.json({
    ...updatedBlock,
    recognizedText: updatedBlock.recognized_text,
    correctedText: updatedBlock.corrected_text,
    createdAt: updatedBlock.created_at,
    updatedAt: updatedBlock.updated_at,
  });
});

export default router;
