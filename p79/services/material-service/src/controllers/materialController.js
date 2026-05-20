const { Op } = require('sequelize');
const Material = require('../models/Material');
const Supplier = require('../models/Supplier');
const ApiResponse = require('../../../../shared/utils/response');
const { catchAsync, AppError } = require('../../../../shared/utils/errorHandler');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const getAllMaterials = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    size = 20,
    search,
    category,
    supplierId,
    qualityGrade,
    status,
    originProvince,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = req.query;

  const where = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { category: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } }
    ];
  }
  if (category) where.category = category;
  if (supplierId) where.supplier_id = supplierId;
  if (qualityGrade) where.quality_grade = qualityGrade;
  if (status) where.status = status;
  if (originProvince) {
    where['origin.province'] = originProvince;
  }

  const { count, rows } = await Material.findAndCountAll({
    where,
    include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone'] }],
    limit: parseInt(size),
    offset: (parseInt(page) - 1) * parseInt(size),
    order: [[sortBy, sortOrder]]
  });

  ApiResponse.paginated(res, rows, page, size, count);
});

const getMaterialById = catchAsync(async (req, res, next) => {
  const material = await Material.findByPk(req.params.id, {
    include: [{ model: Supplier, as: 'supplier' }]
  });

  if (!material) {
    return next(new AppError('原料不存在', 404));
  }

  ApiResponse.success(res, material);
});

const createMaterial = catchAsync(async (req, res, next) => {
  const {
    name,
    category,
    origin,
    supplierId,
    description,
    attributes,
    unit,
    pricePerUnit,
    qualityGrade,
    images
  } = req.body;

  if (supplierId) {
    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) {
      return next(new AppError('指定的供应商不存在', 400));
    }
  }

  const material = await Material.create({
    name,
    category,
    origin,
    supplier_id: supplierId,
    description,
    attributes,
    unit,
    price_per_unit: pricePerUnit,
    quality_grade: qualityGrade,
    images
  });

  const result = await Material.findByPk(material.id, {
    include: [{ model: Supplier, as: 'supplier' }]
  });

  ApiResponse.created(res, result, '原料信息录入成功');
});

const updateMaterial = catchAsync(async (req, res, next) => {
  const material = await Material.findByPk(req.params.id);

  if (!material) {
    return next(new AppError('原料不存在', 404));
  }

  const {
    name,
    category,
    origin,
    supplierId,
    description,
    attributes,
    unit,
    pricePerUnit,
    qualityGrade,
    status,
    images
  } = req.body;

  if (supplierId && supplierId !== material.supplier_id) {
    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) {
      return next(new AppError('指定的供应商不存在', 400));
    }
  }

  await material.update({
    name,
    category,
    origin,
    supplier_id: supplierId,
    description,
    attributes,
    unit,
    price_per_unit: pricePerUnit,
    quality_grade: qualityGrade,
    status,
    images
  });

  const result = await Material.findByPk(material.id, {
    include: [{ model: Supplier, as: 'supplier' }]
  });

  ApiResponse.success(res, result, '原料信息更新成功');
});

const deleteMaterial = catchAsync(async (req, res, next) => {
  const material = await Material.findByPk(req.params.id);

  if (!material) {
    return next(new AppError('原料不存在', 404));
  }

  await material.destroy();
  ApiResponse.success(res, null, '原料删除成功');
});

const getCategories = catchAsync(async (req, res, next) => {
  const categories = await Material.findAll({
    attributes: ['category'],
    group: ['category'],
    order: [['category', 'ASC']]
  });

  const categoryList = categories.map(c => c.category);
  ApiResponse.success(res, categoryList);
});

const updateProcessingTechnique = catchAsync(async (req, res, next) => {
  const material = await Material.findByPk(req.params.id);
  if (!material) {
    return next(new AppError('原料不存在', 404));
  }

  const { techniqueName, steps, tools, duration, craftHeritageLevel, masterArtisans, qualityStandards, certifications } = req.body;

  const techniqueData = {
    technique_name: techniqueName,
    steps: steps || [],
    tools: tools || [],
    duration: duration,
    craft_heritage_level: craftHeritageLevel,
    master_artisans: masterArtisans || [],
    quality_standards: qualityStandards || []
  };

  await material.update({
    processing_technique: techniqueData,
    craft_certifications: certifications || material.craft_certifications
  });

  const result = await Material.findByPk(material.id, {
    include: [{ model: Supplier, as: 'supplier' }]
  });

  ApiResponse.success(res, result, '加工工艺信息更新成功');
});

const updateHeritageInfo = catchAsync(async (req, res, next) => {
  const material = await Material.findByPk(req.params.id);
  if (!material) {
    return next(new AppError('原料不存在', 404));
  }

  const { heritageLevel, originStory, traditionalUses, culturalSignificance, intangibleCulturalHeritage, heritageYear, inheritorName } = req.body;

  await material.update({
    heritage_info: {
      heritage_level: heritageLevel,
      origin_story: originStory,
      traditional_uses: traditionalUses || [],
      cultural_significance: culturalSignificance,
      intangible_cultural_heritage: intangibleCulturalHeritage || false,
      heritage_year: heritageYear,
      inheritor_name: inheritorName
    }
  });

  const result = await Material.findByPk(material.id, {
    include: [{ model: Supplier, as: 'supplier' }]
  });

  ApiResponse.success(res, result, '非遗传承信息更新成功');
});

const getOriginTechniqueMapping = catchAsync(async (req, res, next) => {
  const { province, category, heritageLevel } = req.query;

  const where = {};
  if (province) {
    where['origin.province'] = province;
  }
  if (category) {
    where.category = category;
  }
  if (heritageLevel) {
    where['heritage_info.heritage_level'] = heritageLevel;
  }

  const materials = await Material.findAll({
    where,
    include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name', 'address'] }]
  });

  const originMapping = {};

  for (const material of materials) {
    const originKey = material.origin?.province || 'Unknown';
    const cityKey = material.origin?.city || 'Unknown';

    if (!originMapping[originKey]) {
      originMapping[originKey] = {
        province: originKey,
        cities: {},
        materialCount: 0,
        techniques: new Set(),
        heritageLevels: new Set(),
        materials: []
      };
    }

    if (!originMapping[originKey].cities[cityKey]) {
      originMapping[originKey].cities[cityKey] = {
        city: cityKey,
        materialCount: 0,
        techniques: new Set(),
        materials: []
      };
    }

    const techniqueName = material.processing_technique?.technique_name || '传统工艺';
    const heritageLevel = material.heritage_info?.heritage_level || '普通';

    originMapping[originKey].techniques.add(techniqueName);
    originMapping[originKey].heritageLevels.add(heritageLevel);
    originMapping[originKey].materialCount++;
    originMapping[originKey].cities[cityKey].materialCount++;
    originMapping[originKey].cities[cityKey].techniques.add(techniqueName);

    const materialSummary = {
      id: material.id,
      name: material.name,
      category: material.category,
      origin: material.origin,
      techniqueName: material.processing_technique?.technique_name,
      techniqueSteps: material.processing_technique?.steps?.length || 0,
      heritageLevel: material.heritage_info?.heritage_level,
      qualityGrade: material.quality_grade,
      supplier: material.supplier
    };

    originMapping[originKey].materials.push(materialSummary);
    originMapping[originKey].cities[cityKey].materials.push(materialSummary);
  }

  for (const key in originMapping) {
    originMapping[key].techniques = Array.from(originMapping[key].techniques);
    originMapping[key].heritageLevels = Array.from(originMapping[key].heritageLevels);
    
    for (const cityKey in originMapping[key].cities) {
      originMapping[key].cities[cityKey].techniques = Array.from(originMapping[key].cities[cityKey].techniques);
    }
  }

  const result = {
    totalOrigins: Object.keys(originMapping).length,
    totalMaterials: materials.length,
    originMapping: Object.values(originMapping)
  };

  ApiResponse.success(res, result);
});

const getHeritageStatistics = catchAsync(async (req, res, next) => {
  const materials = await Material.findAll();

  const stats = {
    byHeritageLevel: {},
    byOriginProvince: {},
    byCategory: {},
    certifiedMaterials: 0,
    withProcessingTechnique: 0
  };

  for (const material of materials) {
    const heritageLevel = material.heritage_info?.heritage_level || '未分级';
    const province = material.origin?.province || '未知';
    const category = material.category || '未分类';

    stats.byHeritageLevel[heritageLevel] = (stats.byHeritageLevel[heritageLevel] || 0) + 1;
    stats.byOriginProvince[province] = (stats.byOriginProvince[province] || 0) + 1;
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

    if (material.craft_certifications && material.craft_certifications.length > 0) {
      stats.certifiedMaterials++;
    }
    if (material.processing_technique && Object.keys(material.processing_technique).length > 0) {
      stats.withProcessingTechnique++;
    }
  }

  ApiResponse.success(res, {
    totalMaterials: materials.length,
    ...stats,
    certificationRate: materials.length > 0 ? (stats.certifiedMaterials / materials.length * 100).toFixed(2) : 0,
    techniqueRate: materials.length > 0 ? (stats.withProcessingTechnique / materials.length * 100).toFixed(2) : 0
  });
});

const addCraftCertification = catchAsync(async (req, res, next) => {
  const material = await Material.findByPk(req.params.id);
  if (!material) {
    return next(new AppError('原料不存在', 404));
  }

  const { certificationName, certificationBody, certificationDate, expiryDate, certificateNumber } = req.body;

  const certification = {
    id: require('crypto').randomUUID(),
    certification_name: certificationName,
    certification_body: certificationBody,
    certification_date: certificationDate,
    expiry_date: expiryDate,
    certificate_number: certificateNumber,
    created_at: new Date()
  };

  const certifications = [...(material.craft_certifications || []), certification];
  await material.update({ craft_certifications: certifications });

  ApiResponse.success(res, certification, '工艺认证添加成功');
});

module.exports = {
  getAllMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getCategories,
  updateProcessingTechnique,
  updateHeritageInfo,
  getOriginTechniqueMapping,
  getHeritageStatistics,
  addCraftCertification
};
