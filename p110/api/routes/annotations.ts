import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, allQuery } from '../database';

const router = express.Router();

router.get('/image/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const { block_id, type } = req.query;
    
    let sql = 'SELECT * FROM annotations WHERE image_id = ?';
    const params: any[] = [imageId];

    if (block_id) {
      sql += ' AND block_id = ?';
      params.push(block_id);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC';
    const annotations = allQuery(sql, params);
    res.json(annotations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { block_id, image_id, type, content, author_id, author_name, position_x, position_y, is_public } = req.body;
    
    if (!image_id || !content) {
      return res.status(400).json({ error: 'Image ID and content are required' });
    }

    const id = uuidv4();
    runQuery(
      'INSERT INTO annotations (id, block_id, image_id, type, content, author_id, author_name, position_x, position_y, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, block_id, image_id, type || 'comment', content, author_id, author_name, position_x, position_y, is_public !== undefined ? is_public : 1]
    );

    const annotation = allQuery('SELECT * FROM annotations WHERE id = ?', [id])[0];
    res.status(201).json(annotation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type, is_public } = req.body;

    runQuery(
      'UPDATE annotations SET content = ?, type = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [content, type, is_public, id]
    );

    const annotation = allQuery('SELECT * FROM annotations WHERE id = ?', [id])[0];
    res.json(annotation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    runQuery('DELETE FROM annotations WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/punctuate', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const rules = allQuery('SELECT * FROM punctuation_rules ORDER BY priority DESC');
    
    let punctuatedText = text;
    
    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.pattern, 'g');
        punctuatedText = punctuatedText.replace(regex, rule.replacement);
      } catch (e) {
        console.error('Invalid regex pattern:', rule.pattern);
      }
    }

    const punctuationMarks = ['。', '，', '！', '？', '；', '：', '、'];
    let suggestions: any[] = [];
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1] || '';
      
      if (punctuationMarks.includes(char)) {
        suggestions.push({
          position: i,
          current: char,
          type: 'existing'
        });
      } else if (punctuationMarks.includes(nextChar) && !punctuationMarks.includes(char)) {
        continue;
      } else if (char.match(/[，。！？；：、\s]/) === null && nextChar.match(/[，。！？；：、\s]/) === null) {
        if (i > 0 && i < text.length - 1) {
          const prevChar = text[i - 1];
          if (['。', '！', '？', '，', '；'].includes(prevChar)) {
            suggestions.push({
              position: i,
              suggest: '，',
              confidence: 0.6,
              type: 'suggested'
            });
          }
        }
      }
    }

    res.json({
      original: text,
      punctuated: punctuatedText,
      suggestions: suggestions.slice(0, 20)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/punctuation-rules', async (req, res) => {
  try {
    const rules = allQuery('SELECT * FROM punctuation_rules ORDER BY priority DESC');
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/export/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const { format = 'json', include_blocks = true, include_annotations = true } = req.body;

    const image = allQuery('SELECT * FROM images WHERE id = ?', [imageId])[0];
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const blocks = include_blocks ? allQuery('SELECT * FROM text_blocks WHERE image_id = ? ORDER BY y, x', [imageId]) : [];
    const annotations = include_annotations ? allQuery('SELECT * FROM annotations WHERE image_id = ? ORDER BY created_at DESC', [imageId]) : [];

    const exportData = {
      image: {
        id: image.id,
        name: image.name,
        original_name: image.original_name,
        width: image.width,
        height: image.height,
        exported_at: new Date().toISOString()
      },
      blocks: blocks.map(block => ({
        id: block.id,
        position: { x: block.x, y: block.y, width: block.width, height: block.height },
        recognized_text: block.recognized_text,
        corrected_text: block.corrected_text,
        status: block.status,
        annotated_by: block.annotated_by,
        annotations: annotations.filter((a: any) => a.block_id === block.id)
      })),
      annotations: annotations.filter((a: any) => !a.block_id),
      statistics: {
        total_blocks: blocks.length,
        confirmed_blocks: blocks.filter((b: any) => b.status === 'confirmed').length,
        total_annotations: annotations.length
      }
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="annotations_${imageId}.json"`);
      res.json(exportData);
    } else if (format === 'csv') {
      let csv = 'ID,Position X,Position Y,Width,Height,Recognized Text,Corrected Text,Status\n';
      blocks.forEach((block: any) => {
        csv += `${block.id},${block.x},${block.y},${block.width},${block.height},"${(block.recognized_text || '').replace(/"/g, '""')}","${(block.corrected_text || '').replace(/"/g, '""')}",${block.status}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="annotations_${imageId}.csv"`);
      res.send('\uFEFF' + csv);
    } else if (format === 'text') {
      let textContent = `# ${image.name}\n\n导出时间: ${new Date().toISOString()}\n\n`;
      textContent += `## 文字内容\n\n`;
      
      const sortedBlocks = [...blocks].sort((a: any, b: any) => {
        if (Math.abs(a.y - b.y) < 20) return a.x - b.x;
        return a.y - b.y;
      });
      
      sortedBlocks.forEach((block: any, idx: number) => {
        textContent += `[${idx + 1}] ${block.corrected_text || block.recognized_text || '(未识别)'}\n`;
        const blockAnnotations = annotations.filter((a: any) => a.block_id === block.id);
        if (blockAnnotations.length > 0) {
          textContent += `    批注:\n`;
          blockAnnotations.forEach((a: any) => {
            textContent += `      - [${a.type}] ${a.author_name || '匿名'}: ${a.content}\n`;
          });
        }
        textContent += '\n';
      });
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="annotations_${imageId}.txt"`);
      res.send(textContent);
    } else {
      res.status(400).json({ error: 'Unsupported format' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;