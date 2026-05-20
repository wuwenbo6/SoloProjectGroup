const Role = require('../models/Role');
const User = require('../models/User');
const ApiResponse = require('../../../../shared/utils/response');
const { catchAsync, AppError } = require('../../../../shared/utils/errorHandler');
const { ROLES, PERMISSIONS } = require('../../../../shared/constants');

const getAllRoles = catchAsync(async (req, res, next) => {
  const roles = await Role.findAll({
    include: [{ model: User, attributes: ['id', 'username'] }]
  });

  ApiResponse.success(res, roles);
});

const getRoleById = catchAsync(async (req, res, next) => {
  const role = await Role.findByPk(req.params.id);

  if (!role) {
    return next(new AppError('角色不存在', 404));
  }

  ApiResponse.success(res, role);
});

const createRole = catchAsync(async (req, res, next) => {
  const { name, permissions, description } = req.body;

  if (!Object.values(ROLES).includes(name)) {
    return next(new AppError('无效的角色名称', 400));
  }

  const existingRole = await Role.findOne({ where: { name } });
  if (existingRole) {
    return next(new AppError('角色已存在', 409));
  }

  const validPermissions = permissions.filter(p =>
    Object.values(PERMISSIONS).includes(p)
  );

  const role = await Role.create({
    name,
    permissions: validPermissions,
    description
  });

  ApiResponse.created(res, role);
});

const updateRole = catchAsync(async (req, res, next) => {
  const { permissions, description } = req.body;

  const role = await Role.findByPk(req.params.id);
  if (!role) {
    return next(new AppError('角色不存在', 404));
  }

  if (permissions) {
    const validPermissions = permissions.filter(p =>
      Object.values(PERMISSIONS).includes(p)
    );
    role.permissions = validPermissions;
  }

  if (description !== undefined) {
    role.description = description;
  }

  await role.save();
  ApiResponse.success(res, role, '角色更新成功');
});

const deleteRole = catchAsync(async (req, res, next) => {
  const role = await Role.findByPk(req.params.id);
  if (!role) {
    return next(new AppError('角色不存在', 404));
  }

  const userCount = await User.count({ where: { role_id: req.params.id } });
  if (userCount > 0) {
    return next(new AppError('该角色下还有用户，无法删除', 400));
  }

  await role.destroy();
  ApiResponse.success(res, null, '角色删除成功');
});

const initializeRoles = catchAsync(async (req, res, next) => {
  const defaultRoles = [
    {
      name: ROLES.ADMIN,
      permissions: Object.values(PERMISSIONS),
      description: '系统管理员，拥有全部权限'
    },
    {
      name: ROLES.QUALITY_INSPECTOR,
      permissions: [
        PERMISSIONS.MATERIAL_READ,
        PERMISSIONS.BATCH_READ,
        PERMISSIONS.TRACE_READ,
        PERMISSIONS.QUALITY_EVALUATE,
        PERMISSIONS.QUALITY_READ
      ],
      description: '质检人员，负责品质检测与分级'
    },
    {
      name: ROLES.TESTING_INSTITUTION,
      permissions: [
        PERMISSIONS.TESTING_SYNC,
        PERMISSIONS.TESTING_READ
      ],
      description: '第三方检测机构，负责检测数据同步'
    },
    {
      name: ROLES.REGULATOR,
      permissions: [
        PERMISSIONS.MATERIAL_READ,
        PERMISSIONS.BATCH_READ,
        PERMISSIONS.TRACE_READ,
        PERMISSIONS.QUALITY_READ,
        PERMISSIONS.TESTING_READ
      ],
      description: '监管人员，负责数据审计与监督'
    },
    {
      name: ROLES.CONSUMER,
      permissions: [
        PERMISSIONS.TRACE_READ
      ],
      description: '消费者，可查询溯源信息'
    }
  ];

  const createdRoles = [];
  for (const roleData of defaultRoles) {
    const [role, created] = await Role.findOrCreate({
      where: { name: roleData.name },
      defaults: roleData
    });
    createdRoles.push({ role: role.name, created });
  }

  ApiResponse.success(res, createdRoles, '角色初始化完成');
});

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  initializeRoles
};
