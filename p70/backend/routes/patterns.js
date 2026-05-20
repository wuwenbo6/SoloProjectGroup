const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Pattern = require('../models/Pattern');
const { extractFeatures, extractColors, calculateSimilarity, calculateColorSimilarity } = require('../services/imageProcessor');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'pattern-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/', async (req, res) => {
  try {
    const { category, tag, page = 1, limit = 20 } = req.query;
    let query = {};
    
    if (category) query.category = category;
    if (tag) query.tags = { $in: [tag] };

    const patterns = await Pattern.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'username avatar');

    const total = await Pattern.countDocuments(query);

    res.json({
      patterns,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pattern = await Pattern.findById(req.params.id)
      .populate('createdBy', 'username avatar')
      .populate('collaborators', 'username avatar');
    
    if (!pattern) {
      return res.status(404).json({ error: '纹样未找到' });
    }

    res.json(pattern);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, description, category, tags, createdBy } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    
    const colors = await extractColors(req.file.path);
    const features = await extractFeatures(req.file.path);

    const pattern = new Pattern({
      name,
      description,
      imageUrl,
      category: category || '未分类',
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      colors,
      features,
      featureVector: features.vector || [],
      createdBy
    });

    await pattern.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('new-pattern', pattern);
    }

    res.status(201).json(pattern);
  } catch (err) {
    console.error('创建纹样错误:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, category, tags, outlineData, colors } = req.body;

    const pattern = await Pattern.findById(req.params.id);
    if (!pattern) {
      return res.status(404).json({ error: '纹样未找到' });
    }

    if (name) pattern.name = name;
    if (description !== undefined) pattern.description = description;
    if (category) pattern.category = category;
    if (tags) pattern.tags = tags;
    if (outlineData) pattern.outlineData = outlineData;
    if (colors) pattern.colors = colors;

    await pattern.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`pattern-${req.params.id}`).emit('pattern-updated', pattern);
      io.emit('pattern-updated-global', pattern);
    }

    res.json(pattern);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pattern = await Pattern.findByIdAndDelete(req.params.id);
    if (!pattern) {
      return res.status(404).json({ error: '纹样未找到' });
    }

    const imagePath = path.join(__dirname, '..', pattern.imageUrl);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function calculateHybridSimilarity(basePattern, targetPattern) {
  let totalScore = 0;
  let totalWeight = 0;
  
  const featureScore = calculateSimilarity(
    basePattern.featureVector,
    targetPattern.featureVector
  );
  totalScore += featureScore * 0.4;
  totalWeight += 0.4;
  
  if (basePattern.colors && targetPattern.colors) {
    const colorScore = calculateColorSimilarity(
      basePattern.colors,
      targetPattern.colors
    );
    totalScore += colorScore * 0.35;
    totalWeight += 0.35;
  }
  
  if (basePattern.category && targetPattern.category) {
    const categoryMatch = basePattern.category === targetPattern.category ? 1.0 : 0.2;
    totalScore += categoryMatch * 0.15;
    totalWeight += 0.15;
  }
  
  if (basePattern.tags && targetPattern.tags) {
    const baseTags = new Set(basePattern.tags || []);
    const targetTags = targetPattern.tags || [];
    let intersection = 0;
    for (const tag of targetTags) {
      if (baseTags.has(tag)) intersection++;
    }
    const union = baseTags.size + targetTags.size - intersection;
    const tagSimilarity = union > 0 ? intersection / union : 0;
    totalScore += tagSimilarity * 0.1;
    totalWeight += 0.1;
  }
  
  return totalWeight > 0 ? totalScore / totalWeight : featureScore;
}

router.post('/:id/similar', async (req, res) => {
  try {
    const { featureVector, colors, category, tags, limit = 10 } = req.body;
    const currentPatternId = req.params.id;

    const currentPattern = await Pattern.findById(currentPatternId)
      .select('colors category tags featureVector');

    const allPatterns = await Pattern.find({
      _id: { $ne: currentPatternId }
    }).select('name imageUrl featureVector category colors tags createdAt');

    const basePattern = {
      featureVector: featureVector || currentPattern?.featureVector || [],
      colors: colors || currentPattern?.colors || [],
      category: category || currentPattern?.category || '',
      tags: tags || []
    };

    const similarPatterns = allPatterns
      .map(p => ({
        pattern: p,
        score: calculateHybridSimilarity(basePattern, p),
        breakdown: {
          feature: calculateSimilarity(basePattern.featureVector, p.featureVector),
          color: calculateColorSimilarity(basePattern.colors, p.colors),
          categoryMatch: p.category === basePattern.category ? 1 : 0
        }
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const threshold = 0.3;
    const results = similarPatterns.filter(p => p.score >= threshold);
    
    res.json({
      similarPatterns: results.length > 0 ? results : similarPatterns.slice(0, 3),
      totalFound: results.length,
      threshold
    });
  } catch (err) {
    console.error('相似度检索错误:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/search/similar', async (req, res) => {
  try {
    const { vector, colors, category, limit = 10 } = req.query;
    const featureVector = JSON.parse(vector || '[]');
    const colorArray = colors ? JSON.parse(colors) : [];

    const basePattern = {
      featureVector,
      colors: colorArray,
      category
    };

    const allPatterns = await Pattern.find()
      .select('name imageUrl featureVector category tags colors createdBy')
      .populate('createdBy', 'username');

    const similarPatterns = allPatterns
      .map(p => ({
        pattern: p,
        score: calculateHybridSimilarity(basePattern, p)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    res.json(similarPatterns);
  } catch (err) {
    console.error('相似度搜索错误:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/search/by-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片' });
    }

    const colors = await extractColors(req.file.path);
    const features = await extractFeatures(req.file.path);
    
    const basePattern = {
      featureVector: features.vector || [],
      colors,
      category: ''
    };

    const allPatterns = await Pattern.find()
      .select('name imageUrl featureVector category colors tags');

    const limit = parseInt(req.query.limit) || 10;
    
    const similarPatterns = allPatterns
      .map(p => ({
        pattern: p,
        score: calculateHybridSimilarity(basePattern, p),
        breakdown: {
          feature: calculateSimilarity(basePattern.featureVector, p.featureVector),
          color: calculateColorSimilarity(colors, p.colors)
        }
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    res.json({
      similarPatterns,
      extractedColors: colors,
      totalFound: similarPatterns.filter(p => p.score > 0.3).length
    });
  } catch (err) {
    console.error('以图搜图错误:', err);
    res.status(500).json({ error: err.message });
  }
});

const HistoryRecord = require('../models/HistoryRecord');
const { generateRecommendations, getUsageGuidance, COLOR_PALETTES } = require('../services/colorRecommendation');

router.get('/colors/palettes', async (req, res) => {
  try {
    const { category } = req.query;
    if (category && COLOR_PALETTES[category]) {
      res.json(COLOR_PALETTES[category]);
    } else {
      res.json(COLOR_PALETTES);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/colors/recommend', async (req, res) => {
  try {
    const { colors, category = 'jing' } = req.body;
    const recommendations = generateRecommendations(colors, category);
    const usageGuidance = recommendations.recommendations 
      ? recommendations.recommendations.map(r => ({
          name: r.name,
          guidance: getUsageGuidance(r.colors, category)
        }))
      : recommendations.palettes.map(p => ({
          name: p.name,
          guidance: getUsageGuidance(p.colors, category)
        }));
    res.json({ ...recommendations, usageGuidance });
  } catch (err) {
    console.error('色彩推荐错误:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await HistoryRecord.getPatternHistory(
      req.params.id,
      parseInt(page),
      parseInt(limit)
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/user/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 20, action } = req.query;
    const filters = action ? { action } : {};
    const result = await HistoryRecord.getUserHistory(
      req.params.userId,
      parseInt(page),
      parseInt(limit),
      filters
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/timeline', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const timeline = await HistoryRecord.getActivityTimeline(parseInt(days));
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/history', async (req, res) => {
  try {
    const { userId, userName, action, snapshot, changes } = req.body;
    const pattern = await Pattern.findById(req.params.id);
    if (!pattern) {
      return res.status(404).json({ error: '纹样未找到' });
    }
    const latestVersion = await HistoryRecord.getLatestVersion(req.params.id);
    const record = await HistoryRecord.createRecord({
      patternId: req.params.id,
      patternName: pattern.name,
      userId,
      userName,
      action,
      actionDescription: req.body.actionDescription,
      snapshot,
      changes,
      version: latestVersion + 1,
      metadata: req.body.metadata
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('创建历史记录错误:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/restore', async (req, res) => {
  try {
    const { historyId, userId, userName } = req.body;
    const historyRecord = await HistoryRecord.findById(historyId);
    if (!historyRecord) {
      return res.status(404).json({ error: '历史记录未找到' });
    }
    const pattern = await Pattern.findById(req.params.id);
    if (!pattern) {
      return res.status(404).json({ error: '纹样未找到' });
    }
    const snapshot = historyRecord.snapshot;
    const changes = [];
    if (snapshot.name && snapshot.name !== pattern.name) {
      changes.push({ field: 'name', oldValue: pattern.name, newValue: snapshot.name });
      pattern.name = snapshot.name;
    }
    if (snapshot.category && snapshot.category !== pattern.category) {
      changes.push({ field: 'category', oldValue: pattern.category, newValue: snapshot.category });
      pattern.category = snapshot.category;
    }
    if (snapshot.tags) {
      changes.push({ field: 'tags', oldValue: pattern.tags, newValue: snapshot.tags });
      pattern.tags = snapshot.tags;
    }
    if (snapshot.colors) {
      changes.push({ field: 'colors', oldValue: pattern.colors, newValue: snapshot.colors });
      pattern.colors = snapshot.colors;
    }
    if (snapshot.outline) {
      changes.push({ field: 'outline', oldValue: pattern.outlineData, newValue: snapshot.outline });
      pattern.outlineData = snapshot.outline;
    }
    await pattern.save();
    const restoreRecord = await HistoryRecord.createRecord({
      patternId: req.params.id,
      patternName: pattern.name,
      userId,
      userName,
      action: 'restore',
      actionDescription: `从版本 ${historyRecord.version} 恢复`,
      changes,
      version: await HistoryRecord.getLatestVersion(req.params.id) + 1
    });
    const io = req.app.get('io');
    if (io) {
      io.to(`pattern-${req.params.id}`).emit('pattern-updated', pattern);
      io.emit('pattern-restored', { pattern, history: restoreRecord });
    }
    res.json({ pattern, restoreRecord });
  } catch (err) {
    console.error('恢复版本错误:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/batch/label', async (req, res) => {
  try {
    const { ids, tags, userId, userName } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供有效的纹样ID列表' });
    }
    const result = await Pattern.updateMany(
      { _id: { $in: ids } },
      { $addToSet: { tags: { $each: tags } } },
      { multi: true }
    );
    const patterns = await Pattern.find({ _id: { $in: ids } });
    for (const pattern of patterns) {
      await HistoryRecord.createRecord({
        patternId: pattern._id,
        patternName: pattern.name,
        userId,
        userName,
        action: 'label',
        actionDescription: `批量添加标签: ${tags.join(', ')}`,
        changes: [{ field: 'tags', newValue: tags }],
        version: await HistoryRecord.getLatestVersion(pattern._id) + 1
      });
    }
    const io = req.app.get('io');
    if (io) {
      io.emit('batch-label-completed', { ids, tags, count: result.nModified });
    }
    res.json({
      matched: result.nMatched,
      modified: result.nModified,
      tags
    });
  } catch (err) {
    console.error('批量标注错误:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/batch/classify', async (req, res) => {
  try {
    const { ids, category, userId, userName } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供有效的纹样ID列表' });
    }
    const result = await Pattern.updateMany(
      { _id: { $in: ids } },
      { category },
      { multi: true }
    );
    const patterns = await Pattern.find({ _id: { $in: ids } });
    for (const pattern of patterns) {
      await HistoryRecord.createRecord({
        patternId: pattern._id,
        patternName: pattern.name,
        userId,
        userName,
        action: 'classify',
        actionDescription: `批量分类到: ${category}`,
        changes: [{ field: 'category', newValue: category }],
        version: await HistoryRecord.getLatestVersion(pattern._id) + 1
      });
    }
    const io = req.app.get('io');
    if (io) {
      io.emit('batch-classify-completed', { ids, category, count: result.nModified });
    }
    res.json({
      matched: result.nMatched,
      modified: result.nModified,
      category
    });
  } catch (err) {
    console.error('批量分类错误:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/batch/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供有效的纹样ID列表' });
    }
    const patterns = await Pattern.find({ _id: { $in: ids } });
    for (const pattern of patterns) {
      const imagePath = path.join(__dirname, '..', pattern.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    const result = await Pattern.deleteMany({ _id: { $in: ids } });
    const io = req.app.get('io');
    if (io) {
      io.emit('batch-delete-completed', { ids, count: result.deletedCount });
    }
    res.json({
      deletedCount: result.deletedCount,
      ids
    });
  } catch (err) {
    console.error('批量删除错误:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [totalPatterns, categoryStats, recentActivity] = await Promise.all([
      Pattern.countDocuments(),
      Pattern.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      HistoryRecord.getActivityTimeline(7)
    ]);
    const allTags = await Pattern.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    res.json({
      totalPatterns,
      categoryStats: categoryStats.map(c => ({ category: c._id, count: c.count })),
      popularTags: allTags.map(t => ({ tag: t._id, count: t.count })),
      recentActivity
    });
  } catch (err) {
    console.error('获取统计数据错误:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
