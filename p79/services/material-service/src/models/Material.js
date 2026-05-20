const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Supplier = require('./Supplier');

const Material = sequelize.define('Material', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  origin: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  supplier_id: {
    type: DataTypes.UUID,
    references: {
      model: Supplier,
      key: 'id'
    }
  },
  description: {
    type: DataTypes.TEXT
  },
  attributes: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  unit: {
    type: DataTypes.STRING(50),
    defaultValue: 'kg'
  },
  price_per_unit: {
    type: DataTypes.DECIMAL(10, 2)
  },
  quality_grade: {
    type: DataTypes.ENUM('A', 'B', 'C', 'D')
  },
  status: {
    type: DataTypes.ENUM('available', 'low_stock', 'out_of_stock', 'discontinued'),
    defaultValue: 'available'
  },
  images: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  processing_technique: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  craft_certifications: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  heritage_info: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'materials',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['category'] },
    { fields: ['supplier_id'] },
    { fields: ['status'] }
  ]
});

Material.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
Supplier.hasMany(Material, { foreignKey: 'supplier_id' });

module.exports = Material;
