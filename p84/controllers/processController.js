const ProcessTemplate = require('../models/process/ProcessTemplate');
const { retryOperation } = require('../config/databases');
const { 
  processTemplateCache, 
  invalidateProcessTemplateCache 
} = require('../config/cache');
const logger = require('../config/logger');

const createTemplate = async (req, res) => {
  try {
    const { templateName, propType, propName, description, steps, materials } = req.body;

    const existingTemplate = await ProcessTemplate.findOne({ templateName });
    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: '工艺模板名称已存在'
      });
    }

    const template = new ProcessTemplate({
      templateName,
      propType,
      propName,
      description,
      steps,
      materials,
      createdBy: req.user.id
    });

    await retryOperation(() => template.save(), 3, 500);
    
    invalidateProcessTemplateCache(template._id);

    res.status(201).json({
      success: true,
      message: '工艺模板创建成功',
      data: { template }
    });
  } catch (error) {
    logger.error('创建工艺模板失败:', error);
    res.status(500).json({
      success: false,
      message: '创建工艺模板失败',
      error: error.message
    });
  }
};

const getTemplates = async (req, res) => {
  try {
    const { propType, isActive, page = 1, limit = 10 } = req.query;
    const cacheKey = `templates:${propType || 'all'}:${isActive || 'all'}:${page}:${limit}`;

    const cachedResult = processTemplateCache.get(cacheKey);
    if (cachedResult) {
      return res.json({
        success: true,
        data: cachedResult,
        fromCache: true
      });
    }

    const query = {};
    if (propType) query.propType = propType;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const templates = await ProcessTemplate.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ProcessTemplate.countDocuments(query);

    const result = {
      templates,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    };

    processTemplateCache.set(cacheKey, result);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('获取工艺模板列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取工艺模板列表失败',
      error: error.message
    });
  }
};

const getTemplateById = async (req, res) => {
  try {
    const cacheKey = `template:${req.params.id}`;
    const cachedTemplate = processTemplateCache.get(cacheKey);
    
    if (cachedTemplate) {
      return res.json({
        success: true,
        data: { template: cachedTemplate },
        fromCache: true
      });
    }

    const template = await ProcessTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: '工艺模板不存在'
      });
    }

    processTemplateCache.set(cacheKey, template);

    res.json({
      success: true,
      data: { template }
    });
  } catch (error) {
    logger.error('获取工艺模板详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取工艺模板详情失败',
      error: error.message
    });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { templateName, propType, propName, description, steps, materials, version, isActive } = req.body;

    const template = await ProcessTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: '工艺模板不存在'
      });
    }

    if (templateName && templateName !== template.templateName) {
      const existingTemplate = await ProcessTemplate.findOne({ templateName });
      if (existingTemplate) {
        return res.status(400).json({
          success: false,
          message: '工艺模板名称已存在'
        });
      }
    }

    const updateOperation = async () => {
      return await ProcessTemplate.findByIdAndUpdate(
        req.params.id,
        {
          templateName,
          propType,
          propName,
          description,
          steps,
          materials,
          version,
          isActive
        },
        { new: true }
      );
    };

    const updatedTemplate = await retryOperation(updateOperation, 3, 500);
    
    invalidateProcessTemplateCache(req.params.id);

    res.json({
      success: true,
      message: '工艺模板更新成功',
      data: { template: updatedTemplate }
    });
  } catch (error) {
    logger.error('更新工艺模板失败:', error);
    res.status(500).json({
      success: false,
      message: '更新工艺模板失败',
      error: error.message
    });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const template = await ProcessTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: '工艺模板不存在'
      });
    }

    await ProcessTemplate.findByIdAndDelete(req.params.id);
    
    invalidateProcessTemplateCache(req.params.id);

    res.json({
      success: true,
      message: '工艺模板删除成功'
    });
  } catch (error) {
    logger.error('删除工艺模板失败:', error);
    res.status(500).json({
      success: false,
      message: '删除工艺模板失败',
      error: error.message
    });
  }
};

module.exports = {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate
};
