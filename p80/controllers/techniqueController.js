const RestorationTechnique = require('../models/technique/RestorationTechnique');
const RareBook = require('../models/rareBook/RareBook');
const TraceUtil = require('../utils/traceUtil');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

const uploadDir = 'uploads/techniques';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

exports.upload = multer({ storage });

exports.createTechnique = async (req, res) => {
  try {
    const { bookId, bookCode, techniqueName } = req.body;
    
    const traceId = TraceUtil.generateTraceId();
    
    const technique = await RestorationTechnique.create({
      ...req.body,
      traceId,
      operatorId: req.user?.id,
      operatorName: req.user?.realName,
      operatedAt: new Date()
    });

    TraceUtil.logOperation(traceId, 'create_technique', { bookId, techniqueId: technique.id }, req.user?.id);

    res.status(201).json({
      message: '修复工艺创建成功',
      data: technique
    });
  } catch (error) {
    logger.error('创建修复工艺失败:', error);
    res.status(500).json({ error: '创建修复工艺失败', message: error.message });
  }
};

exports.getTechniqueById = async (req, res) => {
  try {
    const { id } = req.params;
    const technique = await RestorationTechnique.findByPk(id);
    
    if (!technique) {
      return res.status(404).json({ error: '修复工艺不存在' });
    }

    res.json({ data: technique });
  } catch (error) {
    logger.error('获取修复工艺失败:', error);
    res.status(500).json({ error: '获取修复工艺失败', message: error.message });
  }
};

exports.getTechniquesByBookId = async (req, res) => {
  try {
    const { bookId } = req.params;
    const techniques = await RestorationTechnique.findAll({
      where: { bookId },
      order: [['createdAt', 'DESC']]
    });

    res.json({ data: techniques });
  } catch (error) {
    logger.error('获取修复工艺列表失败:', error);
    res.status(500).json({ error: '获取修复工艺列表失败', message: error.message });
  }
};

exports.getAllTechniques = async (req, res) => {
  try {
    const { page = 1, limit = 20, techniqueType, operatorId, bookCode } = req.query;
    
    const where = {};
    if (techniqueType) where.techniqueType = techniqueType;
    if (operatorId) where.operatorId = operatorId;
    if (bookCode) where.bookCode = { [require('sequelize').Op.like]: `%${bookCode}%` };

    const { count, rows } = await RestorationTechnique.findAndCountAll({
      where,
      offset: (page - 1) * limit,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('获取修复工艺列表失败:', error);
    res.status(500).json({ error: '获取修复工艺列表失败', message: error.message });
  }
};

exports.updateTechnique = async (req, res) => {
  try {
    const { id } = req.params;
    const technique = await RestorationTechnique.findByPk(id);
    
    if (!technique) {
      return res.status(404).json({ error: '修复工艺不存在' });
    }

    await technique.update(req.body);

    TraceUtil.logOperation(technique.traceId, 'update_technique', { techniqueId: id }, req.user?.id);

    res.json({
      message: '修复工艺更新成功',
      data: technique
    });
  } catch (error) {
    logger.error('更新修复工艺失败:', error);
    res.status(500).json({ error: '更新修复工艺失败', message: error.message });
  }
};

exports.deleteTechnique = async (req, res) => {
  try {
    const { id } = req.params;
    const technique = await RestorationTechnique.findByPk(id);
    
    if (!technique) {
      return res.status(404).json({ error: '修复工艺不存在' });
    }

    await technique.destroy();

    res.json({ message: '修复工艺删除成功' });
  } catch (error) {
    logger.error('删除修复工艺失败:', error);
    res.status(500).json({ error: '删除修复工艺失败', message: error.message });
  }
};

exports.uploadImages = async (req, res) => {
  try {
    const { id, type } = req.params;
    const technique = await RestorationTechnique.findByPk(id);
    
    if (!technique) {
      return res.status(404).json({ error: '修复工艺不存在' });
    }

    const fileUrls = req.files.map(file => `/${file.path}`);
    const updateField = {};
    
    if (type === 'before') {
      updateField.beforeImages = [...(technique.beforeImages || []), ...fileUrls];
    } else if (type === 'process') {
      updateField.processImages = [...(technique.processImages || []), ...fileUrls];
    } else if (type === 'after') {
      updateField.afterImages = [...(technique.afterImages || []), ...fileUrls];
    }

    await technique.update(updateField);

    res.json({
      message: '图片上传成功',
      data: { urls: fileUrls }
    });
  } catch (error) {
    logger.error('图片上传失败:', error);
    res.status(500).json({ error: '图片上传失败', message: error.message });
  }
};

exports.verifyTechnique = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus } = req.body;
    
    const technique = await RestorationTechnique.findByPk(id);
    if (!technique) {
      return res.status(404).json({ error: '修复工艺不存在' });
    }

    await technique.update({
      verificationStatus,
      verifiedBy: req.user?.id,
      verifiedAt: new Date()
    });

    TraceUtil.logOperation(technique.traceId, 'verify_technique', { techniqueId: id, verificationStatus }, req.user?.id);

    res.json({
      message: '验证完成',
      data: technique
    });
  } catch (error) {
    logger.error('验证失败:', error);
    res.status(500).json({ error: '验证失败', message: error.message });
  }
};

exports.getMyTechniques = async (req, res) => {
  try {
    const { techniqueType } = req.query;
    const where = { operatorId: req.user.id };
    if (techniqueType) where.techniqueType = techniqueType;

    const techniques = await RestorationTechnique.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json({ data: techniques });
  } catch (error) {
    logger.error('获取我的修复工艺失败:', error);
    res.status(500).json({ error: '获取我的修复工艺失败', message: error.message });
  }
};

exports.getRecommendedTechniques = async (req, res) => {
  try {
    const { bookId, material, damageLevel, currentStep } = req.query;
    
    if (!bookId) {
      return res.status(400).json({ error: '缺少善本ID参数' });
    }

    const book = await RareBook.findByPk(bookId);
    if (!book) {
      return res.status(404).json({ error: '善本不存在' });
    }

    const bookMaterial = material || book.material || 'paper';
    const bookCondition = damageLevel || book.condition || 'fair';

    const weightConfig = {
      conditionWeight: 0.35,
      materialWeight: 0.35,
      frequencyWeight: 0.3
    };

    const similarBooks = await RareBook.findAll({
      where: {
        material: { [Op.like]: `%${bookMaterial}%` },
        condition: bookCondition
      },
      attributes: ['id'],
      limit: 50
    });

    const similarBookIds = similarBooks.map(b => b.id);

    const candidateTechniques = await RestorationTechnique.findAll({
      where: {
        bookId: { [Op.in]: similarBookIds },
        verificationStatus: 'verified'
      },
      attributes: [
        'id', 'techniqueName', 'techniqueType', 'description',
        'materials', 'tools', 'duration', 'operatorId'
      ],
      limit: 100
    });

    const techniqueStats = {};
    candidateTechniques.forEach(tech => {
      const key = `${tech.techniqueName}-${tech.techniqueType}`;
      if (!techniqueStats[key]) {
        techniqueStats[key] = {
          technique: tech,
          count: 0,
          totalDuration: 0,
          verifiedCount: 0
        };
      }
      techniqueStats[key].count++;
      techniqueStats[key].totalDuration += tech.duration || 60;
    });

    const scoredRecommendations = Object.values(techniqueStats).map(stat => {
      const { count, totalDuration, technique } = stat;
      const avgDuration = totalDuration / count;
      
      const matchScores = {
        materialMatch: calculateMaterialMatch(technique.materials, bookMaterial),
        conditionMatch: calculateConditionMatch(technique.techniqueType, bookCondition),
        usageFrequency: Math.min(count / 10, 1)
      };

      const finalScore = 
        matchScores.materialMatch * weightConfig.materialWeight +
        matchScores.conditionMatch * weightConfig.conditionWeight +
        matchScores.usageFrequency * weightConfig.frequencyWeight;

      return {
        techniqueId: technique.id,
        techniqueName: technique.techniqueName,
        techniqueType: technique.techniqueType,
        description: technique.description,
        recommendedMaterials: technique.materials,
        recommendedTools: technique.tools,
        estimatedDuration: Math.round(avgDuration),
        matchScores,
        confidenceScore: Math.round(finalScore * 100) / 100,
        usageCount: count,
        priority: calculatePriority(technique.techniqueType, parseInt(currentStep) || 0)
      };
    });

    scoredRecommendations.sort((a, b) => b.confidenceScore - a.confidenceScore);

    const primaryRecommendations = scoredRecommendations.slice(0, 3);
    const alternativeRecommendations = scoredRecommendations.slice(3, 6);

    res.json({
      message: '工艺推荐成功',
      data: {
        bookInfo: {
          bookId: book.id,
          bookCode: book.bookCode,
          material: bookMaterial,
          condition: bookCondition
        },
        weightConfig,
        primaryRecommendations,
        alternativeRecommendations,
        recommendationCount: scoredRecommendations.length
      }
    });
  } catch (error) {
    logger.error('获取推荐工艺失败:', error);
    res.status(500).json({ error: '获取推荐工艺失败', message: error.message });
  }
};

function calculateMaterialMatch(techniqueMaterials, bookMaterial) {
  if (!techniqueMaterials || !bookMaterial) return 0.5;
  
  const materialKeywords = {
    'paper': ['宣纸', '纸张', '纸', '棉纸', '皮纸'],
    'silk': ['丝绸', '绢', '绫', '罗'],
    'bamboo': ['竹', '竹简'],
    'parchment': ['羊皮', '兽皮', '皮纸']
  };

  const techMaterialStr = Array.isArray(techniqueMaterials) 
    ? techniqueMaterials.join(' ') 
    : String(techniqueMaterials);

  for (const [materialType, keywords] of Object.entries(materialKeywords)) {
    if (bookMaterial.toLowerCase().includes(materialType)) {
      const matchCount = keywords.filter(kw => 
        techMaterialStr.includes(kw)
      ).length;
      return Math.min(matchCount / keywords.length + 0.3, 1);
    }
  }

  return 0.5;
}

function calculateConditionMatch(techniqueType, condition) {
  const conditionWeights = {
    'poor': { 'repair': 0.95, 'reinforcement': 0.9, 'cleaning': 0.7 },
    'fair': { 'repair': 0.7, 'reinforcement': 0.85, 'cleaning': 0.95 },
    'good': { 'repair': 0.4, 'reinforcement': 0.6, 'cleaning': 0.9 },
    'excellent': { 'repair': 0.2, 'reinforcement': 0.3, 'cleaning': 0.7 }
  };

  const conditionMap = conditionWeights[condition] || conditionWeights['fair'];
  return conditionMap[techniqueType] || 0.5;
}

function calculatePriority(techniqueType, currentStep) {
  const stepPriority = {
    0: ['cleaning', 'inspection'],
    1: ['cleaning', 'reinforcement'],
    2: ['repair', 'reinforcement'],
    3: ['mounting', 'repair'],
    4: ['sealing', 'mounting']
  };

  const currentStepPriority = stepPriority[Math.min(currentStep, 4)] || [];
  return currentStepPriority.includes(techniqueType) ? 'high' : 
         currentStepPriority.some(t => techniqueType.includes(t)) ? 'medium' : 'normal';
}
