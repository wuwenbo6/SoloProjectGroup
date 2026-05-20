const ROLES = {
  ADMIN: 'admin',
  QUALITY_INSPECTOR: 'quality_inspector',
  TESTING_INSTITUTION: 'testing_institution',
  REGULATOR: 'regulator',
  CONSUMER: 'consumer'
};

const PERMISSIONS = {
  MATERIAL_CREATE: 'material:create',
  MATERIAL_READ: 'material:read',
  MATERIAL_UPDATE: 'material:update',
  MATERIAL_DELETE: 'material:delete',
  BATCH_CREATE: 'batch:create',
  BATCH_READ: 'batch:read',
  BATCH_UPDATE: 'batch:update',
  TRACE_CREATE: 'trace:create',
  TRACE_READ: 'trace:read',
  QUALITY_EVALUATE: 'quality:evaluate',
  QUALITY_READ: 'quality:read',
  TESTING_SYNC: 'testing:sync',
  TESTING_READ: 'testing:read',
  USER_MANAGE: 'user:manage'
};

const BATCH_STATUS = {
  CREATED: 'created',
  IN_PRODUCTION: 'in_production',
  QUALITY_CHECKING: 'quality_checking',
  QUALIFIED: 'qualified',
  UNQUALIFIED: 'unqualified',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  EXPIRED: 'expired',
  USED_UP: 'used_up'
};

const QUALITY_GRADES = ['A', 'B', 'C', 'D'];

const TRACE_STAGES = {
  RAW_MATERIAL: 'raw_material',
  PRODUCTION: 'production',
  QUALITY_CHECK: 'quality_check',
  WAREHOUSE: 'warehouse',
  TRANSPORTATION: 'transportation',
  RETAIL: 'retail'
};

module.exports = {
  ROLES,
  PERMISSIONS,
  BATCH_STATUS,
  QUALITY_GRADES,
  TRACE_STAGES
};
