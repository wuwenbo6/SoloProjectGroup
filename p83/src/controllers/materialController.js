const { v4: uuidv4 } = require('uuid');
const Material = require('../models/material/Material');
const OriginProcessService = require('../services/originProcessService');

const createMaterial = async (req, res) => {
  try {
    const materialId = uuidv4();
    
    const material = new Material({
      materialId,
      ...req.body,
      createdBy: req.user.userId,
      updatedBy: req.user.userId
    });

    await material.save();

    return res.status(201).json({
      success: true,
      message: '材质信息创建成功',
      data: material
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: '材质ID已存在',
        code: 'DUPLICATE_MATERIAL_ID'
      });
    }
    return res.status(500).json({
      success: false,
      message: '创建材质信息失败',
      code: 'CREATE_ERROR',
      error: error.message
    });
  }
};

const getMaterials = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      status,
      country,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    if (country) {
      query['origin.country'] = country;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'supplier.name': { $regex: search, $options: 'i' } },
        { materialId: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [materials, total] = await Promise.all([
      Material.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Material.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: '获取材质列表成功',
      data: {
        materials,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取材质列表失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const getMaterialById = async (req, res) => {
  try {
    const { id } = req.params;

    const material = await Material.findOne({ materialId: id });
    if (!material) {
      return res.status(404).json({
        success: false,
        message: '材质信息不存在',
        code: 'MATERIAL_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '获取材质信息成功',
      data: material
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取材质信息失败',
      code: 'FETCH_ERROR',
      error: error.message
    });
  }
};

const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const material = await Material.findOne({ materialId: id });
    if (!material) {
      return res.status(404).json({
        success: false,
        message: '材质信息不存在',
        code: 'MATERIAL_NOT_FOUND'
      });
    }

    Object.assign(material, req.body, {
      updatedBy: req.user.userId
    });

    await material.save();

    return res.status(200).json({
      success: true,
      message: '材质信息更新成功',
      data: material
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '更新材质信息失败',
      code: 'UPDATE_ERROR',
      error: error.message
    });
  }
};

const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const material = await Material.findOneAndDelete({ materialId: id });
    if (!material) {
      return res.status(404).json({
        success: false,
        message: '材质信息不存在',
        code: 'MATERIAL_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '材质信息删除成功'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '删除材质信息失败',
      code: 'DELETE_ERROR',
      error: error.message
    });
  }
};

const getMaterialStats = async (req, res) => {
  try {
    const stats = await Material.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byType: {
            $push: {
              type: '$type',
              count: { $sum: 1 }
            }
          },
          byStatus: {
            $push: {
              status: '$status',
              count: { $sum: 1 }
            }
          },
          byCountry: {
            $push: {
              country: '$origin.country',
              count: { $sum: 1 }
            }
          }
        }
      }
    ]);

    const typeStats = await Material.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const statusStats = await Material.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const countryStats = await Material.aggregate([
      { $group: { _id: '$origin.country', count: { $sum: 1 } } }
    ]);

    return res.status(200).json({
      success: true,
      message: '获取材质统计信息成功',
      data: {
        total: stats[0]?.total || 0,
        byType: typeStats.map(item => ({ type: item._id, count: item.count })),
        byStatus: statusStats.map(item => ({ status: item._id, count: item.count })),
        byCountry: countryStats.map(item => ({ country: item._id, count: item.count }))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取材质统计信息失败',
      code: 'STATS_ERROR',
      error: error.message
    });
  }
};

const getOriginProcessRules = async (req, res) => {
  try {
    const rules = OriginProcessService.getAllOriginRules();
    
    return res.status(200).json({
      success: true,
      message: '获取产地工艺规则成功',
      data: rules
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取产地工艺规则失败',
      code: 'FETCH_RULES_ERROR',
      error: error.message
    });
  }
};

const getProcessDetails = async (req, res) => {
  try {
    const { processName } = req.params;
    const decodedName = decodeURIComponent(processName);
    const details = OriginProcessService.getProcessDetails(decodedName);
    
    if (!details) {
      return res.status(404).json({
        success: false,
        message: '未找到该工艺详情',
        code: 'PROCESS_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: '获取工艺详情成功',
      data: {
        processName: decodedName,
        ...details
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取工艺详情失败',
      code: 'FETCH_PROCESS_ERROR',
      error: error.message
    });
  }
};

const matchMaterialProcesses = async (req, res) => {
  try {
    const { materialId } = req.params;
    const result = await OriginProcessService.matchMaterialProcesses(materialId);
    
    return res.status(200).json({
      success: true,
      message: '匹配材质加工工艺成功',
      data: result
    });
  } catch (error) {
    if (error.message === '材质不存在') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'MATERIAL_NOT_FOUND'
      });
    }
    return res.status(500).json({
      success: false,
      message: '匹配材质加工工艺失败',
      code: 'MATCH_PROCESS_ERROR',
      error: error.message
    });
  }
};

const bindProcessesToMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { processes } = req.body;
    
    if (!processes || !Array.isArray(processes) || processes.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要绑定的工艺列表',
        code: 'INVALID_PROCESSES'
      });
    }

    const result = await OriginProcessService.bindProcessesToMaterial(
      materialId,
      processes,
      req.user.userId
    );
    
    return res.status(200).json({
      success: true,
      message: '绑定工艺成功',
      data: result
    });
  } catch (error) {
    if (error.message === '材质不存在') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'MATERIAL_NOT_FOUND'
      });
    }
    return res.status(500).json({
      success: false,
      message: '绑定工艺失败',
      code: 'BIND_PROCESS_ERROR',
      error: error.message
    });
  }
};

const getMaterialProcessBindings = async (req, res) => {
  try {
    const { materialId } = req.params;
    const result = await OriginProcessService.getMaterialProcessBindings(materialId);
    
    return res.status(200).json({
      success: true,
      message: '获取材质工艺绑定成功',
      data: result
    });
  } catch (error) {
    if (error.message === '材质不存在') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'MATERIAL_NOT_FOUND'
      });
    }
    return res.status(500).json({
      success: false,
      message: '获取材质工艺绑定失败',
      code: 'FETCH_BINDINGS_ERROR',
      error: error.message
    });
  }
};

const removeProcessFromMaterial = async (req, res) => {
  try {
    const { materialId, processName } = req.params;
    const decodedName = decodeURIComponent(processName);
    
    const result = await OriginProcessService.removeProcessFromMaterial(
      materialId,
      decodedName,
      req.user.userId
    );
    
    return res.status(200).json({
      success: true,
      message: '移除工艺绑定成功',
      data: result
    });
  } catch (error) {
    if (error.message === '材质不存在') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'MATERIAL_NOT_FOUND'
      });
    }
    if (error.message === '该加工工艺未绑定到此材质') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'PROCESS_NOT_BOUND'
      });
    }
    return res.status(500).json({
      success: false,
      message: '移除工艺绑定失败',
      code: 'REMOVE_BINDING_ERROR',
      error: error.message
    });
  }
};

const getOriginProcessStats = async (req, res) => {
  try {
    const stats = await OriginProcessService.getOriginProcessStats();
    
    return res.status(200).json({
      success: true,
      message: '获取产地工艺统计成功',
      data: stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取产地工艺统计失败',
      code: 'STATS_ERROR',
      error: error.message
    });
  }
};

const getOriginMaterials = async (req, res) => {
  try {
    const { originKey } = req.params;
    const decodedKey = decodeURIComponent(originKey);
    const result = await OriginProcessService.getOriginMaterials(decodedKey);
    
    return res.status(200).json({
      success: true,
      message: '获取产地材质列表成功',
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '获取产地材质列表失败',
      code: 'FETCH_MATERIALS_ERROR',
      error: error.message
    });
  }
};

module.exports = {
  createMaterial,
  getMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  getMaterialStats,
  getOriginProcessRules,
  getProcessDetails,
  matchMaterialProcesses,
  bindProcessesToMaterial,
  getMaterialProcessBindings,
  removeProcessFromMaterial,
  getOriginProcessStats,
  getOriginMaterials
};
