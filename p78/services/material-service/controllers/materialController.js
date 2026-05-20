const Joi = require('joi');
const { successResponse, errorResponse, paginatedResponse } = require('../../../shared/utils/response');
const Material = require('../models/Material');
const MaterialCategory = require('../models/MaterialCategory');

let materialModel, categoryModel;

const initModels = (pool) => {
  materialModel = new Material(pool);
  categoryModel = new MaterialCategory(pool);
};

const materialSchema = Joi.object({
  code: Joi.string().required(),
  name: Joi.string().required(),
  category: Joi.string().required(),
  origin_province: Joi.string(),
  origin_city: Joi.string(),
  origin_address: Joi.string(),
  supplier_name: Joi.string(),
  supplier_contact: Joi.string(),
  unit: Joi.string().required(),
  specifications: Joi.string(),
  description: Joi.string(),
  quality_standard: Joi.string(),
  storage_requirements: Joi.string(),
  shelf_life_days: Joi.number().integer()
});

const createMaterial = async (req, res) => {
  try {
    const { error, value } = materialSchema.validate(req.body);
    if (error) {
      return errorResponse(res, '参数验证失败', 400, error.details);
    }

    const existing = await materialModel.findByCode(value.code);
    if (existing) {
      return errorResponse(res, '原料编码已存在', 409);
    }

    const material = await materialModel.create({
      ...value,
      created_by: req.user.id
    });

    successResponse(res, material, '原料信息录入成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await materialModel.findById(id);
    if (!material) {
      return errorResponse(res, '原料不存在', 404);
    }
    successResponse(res, material, '获取原料信息成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getMaterials = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filters = {
      category: req.query.category,
      name: req.query.name,
      origin_province: req.query.origin_province
    };

    const result = await materialModel.findAll(filters, page, limit);
    paginatedResponse(res, result.materials, page, limit, result.total, '获取原料列表成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = materialSchema.validate(req.body);
    if (error) {
      return errorResponse(res, '参数验证失败', 400, error.details);
    }

    const existing = await materialModel.findById(id);
    if (!existing) {
      return errorResponse(res, '原料不存在', 404);
    }

    const material = await materialModel.update(id, value);
    successResponse(res, material, '原料信息更新成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await materialModel.delete(id);
    if (success) {
      successResponse(res, null, '原料删除成功');
    } else {
      errorResponse(res, '原料不存在', 404);
    }
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const createCategory = async (req, res) => {
  try {
    const category = await categoryModel.create(req.body);
    successResponse(res, category, '分类创建成功', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await categoryModel.findAll();
    successResponse(res, categories, '获取分类列表成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await categoryModel.update(id, req.body);
    successResponse(res, category, '分类更新成功');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await categoryModel.delete(id);
    if (success) {
      successResponse(res, null, '分类删除成功');
    } else {
      errorResponse(res, '分类不存在', 404);
    }
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

module.exports = {
  initModels,
  createMaterial,
  getMaterial,
  getMaterials,
  updateMaterial,
  deleteMaterial,
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory
};
