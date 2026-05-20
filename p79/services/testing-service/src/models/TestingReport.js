const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const TestingInstitution = require('./TestingInstitution');

const TestingReport = sequelize.define('TestingReport', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  institution_id: { type: DataTypes.UUID, references: { model: TestingInstitution, key: 'id' } },
  batch_id: { type: DataTypes.UUID, allowNull: false },
  report_no: { type: DataTypes.STRING(100), unique: true, allowNull: false },
  test_items: { type: DataTypes.JSONB, allowNull: false },
  conclusion: { type: DataTypes.TEXT },
  overall_result: { type: DataTypes.ENUM('pass', 'fail', 'conditional') },
  report_file: { type: DataTypes.TEXT },
  attachments: { type: DataTypes.JSONB, defaultValue: [] },
  tested_by: { type: DataTypes.STRING(100) },
  tested_at: { type: DataTypes.DATE, allowNull: false },
  synced_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  verified_by: { type: DataTypes.UUID },
  verified_at: { type: DataTypes.DATE },
  remarks: { type: DataTypes.TEXT }
}, {
  tableName: 'testing_reports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['batch_id'] }, { fields: ['institution_id'] }, { fields: ['report_no'] }]
});

TestingReport.belongsTo(TestingInstitution, { foreignKey: 'institution_id', as: 'institution' });
TestingInstitution.hasMany(TestingReport, { foreignKey: 'institution_id' });

module.exports = TestingReport;