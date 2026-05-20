const WoodcarvingCraft = require('../models/craft/WoodcarvingCraft');

const generateCraftCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `CRAFT-${timestamp}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
};

exports.createCraft = async (req, res) => {
  try {
    const craftCode = generateCraftCode();
    
    const craft = await WoodcarvingCraft.create({
      ...req.body,
      craftCode,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: craft,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建工艺失败',
      error: error.message,
    });
  }
};

exports.getAllCrafts = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, status, keyword } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (keyword) {
      query.$or = [
        { craftName: { $regex: keyword, $options: 'i' } },
        { craftCode: { $regex: keyword, $options: 'i' } },
      ];
    }

    const crafts = await WoodcarvingCraft.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await WoodcarvingCraft.countDocuments(query);

    res.status(200).json({
      success: true,
      data: crafts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取工艺列表失败',
      error: error.message,
    });
  }
};

exports.getCraftById = async (req, res) => {
  try {
    const craft = await WoodcarvingCraft.findById(req.params.id);

    if (!craft) {
      return res.status(404).json({
        success: false,
        message: '工艺不存在',
      });
    }

    res.status(200).json({
      success: true,
 data: craft,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取工艺详情失败',
      error: error.message,
    });
  }
};

exports.updateCraft = async (req, res) => {
  try {
    const craft = await WoodcarvingCraft.findById(req.params.id);

    if (!craft) {
      return res.status(404).json({
        success: false,
        message: '工艺不存在',
      });
    }

    const updatedCraft = await WoodcarvingCraft.findByIdAndUpdate(
      req.params.id,
      { ...req.body, version: craft.version + 1 },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: updatedCraft,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新工艺失败',
      error: error.message,
    });
  }
};

exports.deleteCraft = async (req, res) => {
  try {
    const craft = await WoodcarvingCraft.findById(req.params.id);

    if (!craft) {
      return res.status(404).json({
        success: false,
        message: '工艺不存在',
      });
    }

    await WoodcarvingCraft.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: '工艺删除成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除工艺失败',
      error: error.message,
    });
  }
};

exports.publishCraft = async (req, res) => {
  try {
    const craft = await WoodcarvingCraft.findByIdAndUpdate(
      req.params.id,
      { status: '已发布' },
      { new: true }
    );

    if (!craft) {
      return res.status(404).json({
        success: false,
        message: '工艺不存在',
      });
    }

    res.status(200).json({
      success: true,
      data: craft,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '发布工艺失败',
      error: error.message,
    });
  }
};