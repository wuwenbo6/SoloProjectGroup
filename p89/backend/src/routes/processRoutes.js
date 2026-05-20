const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Process = require('../models/Process');

const router = express.Router();

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  const videoTypes = /mp4|webm|ogg/;
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype.toLowerCase();
  
  if (imageTypes.test(extname) && imageTypes.test(mimetype)) {
    cb(null, true);
  } else if (videoTypes.test(extname) && videoTypes.test(mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('仅支持图片（jpg, png, gif, webp）和视频（mp4, webm, ogg）格式'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }
});

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: '文件大小不能超过500MB' });
    }
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

const validateProcessData = (req, res, next) => {
  try {
    const { title, description, type, ingredients, steps } = req.body;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: '工艺名称不能为空' });
    }
    if (!description || description.trim().length === 0) {
      return res.status(400).json({ message: '工艺描述不能为空' });
    }
    if (!type) {
      return res.status(400).json({ message: '工艺类型不能为空' });
    }
    
    if (ingredients) {
      const parsedIngredients = JSON.parse(ingredients);
      if (!Array.isArray(parsedIngredients)) {
        return res.status(400).json({ message: '原料数据格式错误' });
      }
    }
    
    if (steps) {
      const parsedSteps = JSON.parse(steps);
      if (!Array.isArray(parsedSteps)) {
        return res.status(400).json({ message: '步骤数据格式错误' });
      }
    }
    
    next();
  } catch (error) {
    res.status(400).json({ message: '数据格式错误' });
  }
};

router.post('/', auth, (req, res, next) => {
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 2 }
  ])(req, res, (err) => {
    handleUploadError(err, req, res, next);
  });
}, validateProcessData, async (req, res) => {
  try {
    const { title, description, type, ingredients, steps, isPublic } = req.body;
    
    const images = req.files?.images ? req.files.images.map(file => `/uploads/${file.filename}`) : [];
    const videos = req.files?.videos ? req.files.videos.map(file => `/uploads/${file.filename}`) : [];
    
    const process = new Process({
      userId: req.user._id,
      title: title.trim(),
      description: description.trim(),
      type,
      ingredients: JSON.parse(ingredients || '[]'),
      steps: JSON.parse(steps || '[]'),
      images,
      videos,
      isPublic: isPublic !== 'false'
    });

    await process.save();
    res.status(201).json(process);
  } catch (error) {
    console.error('保存工艺记录失败:', error);
    res.status(500).json({ message: '保存失败，请重试' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, type, userId } = req.query;
    const query = { isPublic: true };
    
    if (type) query.type = type;
    if (userId) query.userId = userId;

    const processes = await Process.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'username avatar');

    const total = await Process.countDocuments(query);

    res.json({
      data: processes,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const processes = await Process.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json(processes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const process = await Process.findById(req.params.id)
      .populate('userId', 'username avatar');
    
    if (!process) {
      return res.status(404).json({ message: '工艺记录不存在' });
    }

    process.viewCount += 1;
    await process.save();

    res.json(process);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, (req, res, next) => {
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 2 }
  ])(req, res, (err) => {
    handleUploadError(err, req, res, next);
  });
}, validateProcessData, async (req, res) => {
  try {
    const { title, description, type, ingredients, steps, isPublic, existingImages, existingVideos } = req.body;
    
    let process = await Process.findById(req.params.id);
    
    if (!process) {
      return res.status(404).json({ message: '工艺记录不存在' });
    }

    if (process.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: '无权限修改' });
    }

    const newImages = req.files?.images ? req.files.images.map(file => `/uploads/${file.filename}`) : [];
    const newVideos = req.files?.videos ? req.files.videos.map(file => `/uploads/${file.filename}`) : [];
    const allImages = [...(existingImages ? JSON.parse(existingImages) : []), ...newImages];
    const allVideos = [...(existingVideos ? JSON.parse(existingVideos) : []), ...newVideos];

    process.title = title.trim();
    process.description = description.trim();
    process.type = type;
    process.ingredients = JSON.parse(ingredients || '[]');
    process.steps = JSON.parse(steps || '[]');
    process.images = allImages;
    process.videos = allVideos;
    process.isPublic = isPublic !== 'false';
    process.updatedAt = Date.now();

    await process.save();
    res.json(process);
  } catch (error) {
    console.error('更新工艺记录失败:', error);
    res.status(500).json({ message: '更新失败，请重试' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const process = await Process.findById(req.params.id);
    
    if (!process) {
      return res.status(404).json({ message: '工艺记录不存在' });
    }

    if (process.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: '无权限删除' });
    }

    await Process.findByIdAndDelete(req.params.id);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/export', auth, async (req, res) => {
  try {
    const { ids, format = 'json' } = req.body;
    
    let query = { userId: req.user._id };
    if (ids && ids.length > 0) {
      query._id = { $in: ids };
    }

    const processes = await Process.find(query)
      .sort({ createdAt: -1 })
      .populate('userId', 'username');

    if (format === 'json') {
      const exportData = processes.map(p => ({
        title: p.title,
        description: p.description,
        type: p.type,
        ingredients: p.ingredients,
        steps: p.steps,
        author: p.userId.username,
        createdAt: p.createdAt,
        viewCount: p.viewCount,
        likeCount: p.likeCount
      }));

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="brewing-processes-${Date.now()}.json"`);
      res.json(exportData);
    } else if (format === 'markdown') {
      let markdown = '# 酿造工艺记录导出\n\n';
      markdown += `导出时间: ${new Date().toLocaleString()}\n\n`;
      markdown += `共计 ${processes.length} 条记录\n\n---\n\n`;

      processes.forEach((p, index) => {
        markdown += `## ${index + 1}. ${p.title}\n\n`;
        markdown += `**类型:** ${p.type}\n\n`;
        markdown += `**作者:** ${p.userId.username}\n\n`;
        markdown += `**描述:** ${p.description}\n\n`;
        
        if (p.ingredients && p.ingredients.length > 0) {
          markdown += '### 原料清单\n\n';
          p.ingredients.forEach(ing => {
            markdown += `- ${ing.name}: ${ing.quantity} ${ing.unit}\n`;
          });
          markdown += '\n';
        }

        if (p.steps && p.steps.length > 0) {
          markdown += '### 酿造步骤\n\n';
          p.steps.forEach((step, i) => {
            markdown += `${i + 1}. **${step.title}**\n`;
            markdown += `   ${step.description}\n`;
            if (step.duration) markdown += `   - 时长: ${step.duration}\n`;
            if (step.temperature) markdown += `   - 温度: ${step.temperature}\n`;
            markdown += '\n';
          });
        }

        markdown += `---\n\n`;
      });

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="brewing-processes-${Date.now()}.md"`);
      res.send(markdown);
    } else {
      res.status(400).json({ message: '不支持的导出格式' });
    }
  } catch (error) {
    console.error('导出失败:', error);
    res.status(500).json({ message: '导出失败' });
  }
});

const tokenize = (text) => {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
};

const calculateSimilarity = (p1, p2) => {
  let score = 0;
  let total = 0;

  if (p1.type === p2.type) {
    score += 30;
  }
  total += 30;

  const desc1 = tokenize(p1.description);
  const desc2 = tokenize(p2.description);
  const commonDesc = desc1.filter(t => desc2.includes(t)).length;
  const maxDesc = Math.max(desc1.length, desc2.length, 1);
  score += (commonDesc / maxDesc) * 30;
  total += 30;

  const ings1 = p1.ingredients?.map(i => i.name.toLowerCase()) || [];
  const ings2 = p2.ingredients?.map(i => i.name.toLowerCase()) || [];
  const commonIngs = ings1.filter(i => ings2.includes(i)).length;
  const maxIngs = Math.max(ings1.length, ings2.length, 1);
  score += (commonIngs / maxIngs) * 25;
  total += 25;

  const title1 = tokenize(p1.title);
  const title2 = tokenize(p2.title);
  const commonTitle = title1.filter(t => title2.includes(t)).length;
  const maxTitle = Math.max(title1.length, title2.length, 1);
  score += (commonTitle / maxTitle) * 15;
  total += 15;

  return score / total * 100;
};

router.get('/recommend/:processId', async (req, res) => {
  try {
    const { processId } = req.params;
    const { limit = 5 } = req.query;

    const targetProcess = await Process.findById(processId);
    if (!targetProcess) {
      return res.status(404).json({ message: '工艺记录不存在' });
    }

    const allProcesses = await Process.find({
      _id: { $ne: processId },
      isPublic: true
    })
      .limit(100)
      .populate('userId', 'username avatar');

    const scoredProcesses = allProcesses.map(p => ({
      ...p.toObject(),
      similarity: Math.round(calculateSimilarity(targetProcess, p))
    }));

    scoredProcesses.sort((a, b) => b.similarity - a.similarity);

    const recommendations = scoredProcesses.slice(0, parseInt(limit));

    res.json(recommendations);
  } catch (error) {
    console.error('获取推荐失败:', error);
    res.status(500).json({ message: '获取推荐失败' });
  }
});

router.get('/recommend', async (req, res) => {
  try {
    const { type, limit = 10 } = req.query;

    let query = { isPublic: true };
    if (type) {
      query.type = type;
    }

    const processes = await Process.find(query)
      .sort({ viewCount: -1, likeCount: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'username avatar');

    res.json(processes);
  } catch (error) {
    console.error('获取热门推荐失败:', error);
    res.status(500).json({ message: '获取热门推荐失败' });
  }
});

module.exports = router;
