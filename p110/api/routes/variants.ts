import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, allQuery } from '../database';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { standard_char, variant_char, category } = req.query;
    let sql = 'SELECT * FROM variant_characters WHERE 1=1';
    const params: any[] = [];

    if (standard_char) {
      sql += ' AND standard_char LIKE ?';
      params.push(`%${standard_char}%`);
    }
    if (variant_char) {
      sql += ' AND variant_char LIKE ?';
      params.push(`%${variant_char}%`);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY created_at DESC';
    const variants = allQuery(sql, params);
    res.json(variants);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/match', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const allVariants = allQuery('SELECT * FROM variant_characters');
    const matches: any[] = [];

    for (const char of text) {
      const variant = allVariants.find(
        (v: any) => v.variant_char === char || v.standard_char === char
      );
      if (variant) {
        matches.push({
          character: char,
          standard_char: variant.standard_char,
          variant_char: variant.variant_char,
          is_variant: variant.variant_char === char,
          category: variant.category,
          description: variant.description
        });
      }
    }

    const uniqueMatches = Array.from(new Set(matches.map(m => m.character)))
      .map(char => matches.find(m => m.character === char)!);

    res.json(uniqueMatches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { standard_char, variant_char, category, source, description } = req.body;
    
    if (!standard_char || !variant_char) {
      return res.status(400).json({ error: 'Standard and variant characters are required' });
    }

    const id = uuidv4();
    runQuery(
      'INSERT INTO variant_characters (id, standard_char, variant_char, category, source, description) VALUES (?, ?, ?, ?, ?, ?)',
      [id, standard_char, variant_char, category || 'general', source, description]
    );

    res.status(201).json({ id, standard_char, variant_char, category, source, description });
  } catch (error: any) {
    if (error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Variant character already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    runQuery('DELETE FROM variant_characters WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { variants } = req.body;
    if (!Array.isArray(variants)) {
      return res.status(400).json({ error: 'Variants must be an array' });
    }

    const results = [];
    for (const v of variants) {
      try {
        const id = uuidv4();
        runQuery(
          'INSERT OR IGNORE INTO variant_characters (id, standard_char, variant_char, category, source, description) VALUES (?, ?, ?, ?, ?, ?)',
          [id, v.standard_char, v.variant_char, v.category || 'general', v.source, v.description]
        );
        results.push({ id, ...v, success: true });
      } catch (e: any) {
        results.push({ ...v, success: false, error: e.message });
      }
    }

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;