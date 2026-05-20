const { Op } = require('sequelize');
const Supplier = require('../models/Supplier');
const Material = require('../models/Material');
const ApiResponse = require('../../../../shared/utils/response');
const { catchAsync, AppError } = require('../../../../shared/utils/errorHandler');
const { ROLES } = require('../../../../shared/constants');

const getAllSuppliers = catchAsync(async (req, res, next) => {
  const { page = 1, size = 20, search, status, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

  const where = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { contact_person: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } }
    ];
  }
  if (status) {
    where.status = status;
  }

  const { count, rows } = await Supplier.findAndCountAll({
    where,
    limit: parseInt(size),
    offset: (parseInt(page) - 1) * parseInt(size),
    order: [[sortBy, sortOrder]]
  });

  ApiResponse.paginated(res, rows, page, size, count);
});

const getSupplierById = catchAsync(async (req, res, next) => {
  const supplier = await Supplier.findByPk(req.params.id, {
    include: [{ model: Material, as: 'materials' }]
  });

  if (!supplier) {
    return next(new AppError('供应商不存在', 404));
  }

  ApiResponse.success(res, supplier);
});

const createSupplier = catchAsync(async (req, res, next) => {
  const { name, contact_person, phone, email, address, certification } = req.body;

  const supplier = await Supplier.create({
    name,
    contact_person,
    phone,
    email,
    address,
    certification
  });

  ApiResponse.created(res, supplier, '供应商创建成功');
});

const updateSupplier = catchAsync(async (req, res, next) => {
  const supplier = await Supplier.findByPk(req.params.id);

  if (!supplier) {
    return next(new AppError('供应商不存在', 404));
  }

  const { name, contact_person, phone, email, address, certification, status, rating } = req.body;

  await supplier.update({
    name,
    contact_person,
    phone,
    email,
    address,
    certification,
    status,
    rating
  });

  ApiResponse.success(res, supplier, '供应商更新成功');
});

const deleteSupplier = catchAsync(async (req, res, next) => {
  const supplier = await Supplier.findByPk(req.params.id);

  if (!supplier) {
    return next(new AppError('供应商不存在', 404));
  }

  const materialCount = await Material.count({ where: { supplier_id: req.params.id } });
  if (materialCount > 0) {
    return next(new AppError('该供应商下还有关联的原料，无法删除', 400));
  }

  await supplier.destroy();
  ApiResponse.success(res, null, '供应商删除成功');
});

module.exports = {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier
};
