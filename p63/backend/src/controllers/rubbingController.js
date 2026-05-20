const Rubbing = require('../models/Rubbing');
const InterpretationRecord = require('../models/InterpretationRecord');
const { ROLES } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

exports.createRubbing = async (req, res) => {
  try {
    const { title, description, dynasty, location, material, tags } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: '请上传拓片图片' });
    }

    const rubbing = new Rubbing({
      title,
      description,
      dynasty,
      location,
      material,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      originalImage: `/uploads/${req.file.filename}`,
      uploadedBy: req.user._id,
      collaborators: [req.user._id]
    });

    await rubbing.save();
    
    res.status(201).json({
      message: '拓片创建成功',
      rubbing
    });
  } catch (error) {
    res.status(500).json({ message: '创建失败', error: error.message });
  }
};

exports.getRubbings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, all } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (all && req.user.role === ROLES.ADMIN) {
    } else {
      query.collaborators = req.user._id;
    }

    const rubbings = await Rubbing.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('uploadedBy', 'username role');

    const total = await Rubbing.countDocuments(query);

    res.json({
      rubbings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: '获取失败', error: error.message });
  }
};

exports.getRubbingById = async (req, res) => {
  try {
    const rubbing = await Rubbing.findById(req.params.id)
      .populate('uploadedBy', 'username role')
      .populate('collaborators', 'username role');

    if (!rubbing) {
      return res.status(404).json({ message: '拓片不存在' });
    }

    res.json({ rubbing });
  } catch (error) {
    res.status(500).json({ message: '获取失败', error: error.message });
  }
};

exports.updateRubbing = async (req, res) => {
  try {
    const { title, description, dynasty, location, material, tags, status } = req.body;
    
    const rubbing = req.rubbing;

    if (title) rubbing.title = title;
    if (description !== undefined) rubbing.description = description;
    if (dynasty !== undefined) rubbing.dynasty = dynasty;
    if (location !== undefined) rubbing.location = location;
    if (material !== undefined) rubbing.material = material;
    if (tags) rubbing.tags = tags.split(',').map(t => t.trim());
    if (status) {
      if (req.user.role === ROLES.USER && status === 'completed') {
        return res.status(403).json({ message: '普通用户无法标记拓片为已完成' });
      }
      rubbing.status = status;
    }

    await rubbing.save();
    
    res.json({ message: '更新成功', rubbing });
  } catch (error) {
    res.status(500).json({ message: '更新失败', error: error.message });
  }
};

exports.deleteRubbing = async (req, res) => {
  try {
    const rubbing = req.rubbing;
    
    if (rubbing.originalImage) {
      const imagePath = path.join(__dirname, '../..', rubbing.originalImage);
      try {
        fs.unlinkSync(imagePath);
      } catch (e) {}
    }
    
    if (rubbing.processedImage) {
      const processedPath = path.join(__dirname, '../..', rubbing.processedImage);
      try {
        fs.unlinkSync(processedPath);
      } catch (e) {}
    }

    await InterpretationRecord.deleteMany({ rubbing: rubbing._id });
    await Rubbing.findByIdAndDelete(rubbing._id);

    res.json({ message: '拓片删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除失败', error: error.message });
  }
};

exports.updateCharacter = async (req, res) => {
  try {
    const { charId, interpretText, status } = req.body;
    const rubbing = req.rubbing;

    const character = rubbing.characters.find(c => c.charId === charId);
    if (!character) {
      return res.status(404).json({ message: '文字不存在' });
    }

    if (status === 'confirmed' && req.user.role === ROLES.USER) {
      return res.status(403).json({ message: '普通用户无法确认释读' });
    }

    const record = new InterpretationRecord({
      rubbing: rubbing._id,
      characterId: charId,
      user: req.user._id,
      originalText: character.interpretText,
      newText: interpretText || character.interpretText,
      action: interpretText ? 'interpret' : status === 'confirmed' ? 'confirm' : 'revise'
    });
    await record.save();

    if (interpretText !== undefined) character.interpretText = interpretText;
    if (status) character.status = status;
    character.interpreter = req.user._id;

    const confirmedChars = rubbing.characters.filter(c => c.status === 'confirmed').length;
    rubbing.progress = rubbing.characters.length > 0 
      ? Math.round((confirmedChars / rubbing.characters.length) * 100) 
      : 0;

    if (rubbing.progress === 100) {
      rubbing.status = 'completed';
    }

    await rubbing.save();

    res.json({ 
      message: '更新成功', 
      character, 
      progress: rubbing.progress,
      status: rubbing.status
    });
  } catch (error) {
    res.status(500).json({ message: '更新失败', error: error.message });
  }
};

exports.confirmCharacter = async (req, res) => {
  try {
    const { charId } = req.params;
    const rubbing = req.rubbing;

    const character = rubbing.characters.find(c => c.charId === charId);
    if (!character) {
      return res.status(404).json({ message: '文字不存在' });
    }

    if (character.status === 'confirmed') {
      return res.json({ message: '该文字已确认', character });
    }

    const record = new InterpretationRecord({
      rubbing: rubbing._id,
      characterId: charId,
      user: req.user._id,
      originalText: character.interpretText,
      newText: character.interpretText,
      action: 'confirm'
    });
    await record.save();

    character.status = 'confirmed';
    character.interpreter = req.user._id;

    const confirmedChars = rubbing.characters.filter(c => c.status === 'confirmed').length;
    rubbing.progress = rubbing.characters.length > 0 
      ? Math.round((confirmedChars / rubbing.characters.length) * 100) 
      : 0;

    if (rubbing.progress === 100) {
      rubbing.status = 'completed';
    }

    await rubbing.save();

    res.json({ 
      message: '确认成功', 
      character, 
      progress: rubbing.progress,
      status: rubbing.status
    });
  } catch (error) {
    res.status(500).json({ message: '确认失败', error: error.message });
  }
};

exports.addCollaborator = async (req, res) => {
  try {
    const { userId } = req.body;
    const rubbing = req.rubbing;

    if (rubbing.collaborators.some(c => c.toString() === userId)) {
      return res.status(400).json({ message: '该用户已是协作者' });
    }

    rubbing.collaborators.push(userId);
    await rubbing.save();

    await rubbing.populate('collaborators', 'username role');

    res.json({ message: '添加协作者成功', rubbing });
  } catch (error) {
    res.status(500).json({ message: '添加失败', error: error.message });
  }
};

exports.removeCollaborator = async (req, res) => {
  try {
    const { userId } = req.params;
    const rubbing = req.rubbing;

    if (rubbing.uploadedBy.toString() === userId) {
      return res.status(400).json({ message: '不能移除创建者' });
    }

    rubbing.collaborators = rubbing.collaborators.filter(
      c => c.toString() !== userId
    );
    await rubbing.save();

    await rubbing.populate('collaborators', 'username role');

    res.json({ message: '移除协作者成功', rubbing });
  } catch (error) {
    res.status(500).json({ message: '移除失败', error: error.message });
  }
};

exports.getInterpretationHistory = async (req, res) => {
  try {
    const { charId, page = 1, limit = 20 } = req.query;
    const query = { rubbing: req.params.id };
    if (charId) query.characterId = charId;

    const records = await InterpretationRecord.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('user', 'username role');

    const total = await InterpretationRecord.countDocuments(query);

    res.json({ 
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: '获取历史记录失败', error: error.message });
  }
};
