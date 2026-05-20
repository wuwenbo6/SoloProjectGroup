const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ArbitrageOpportunity = sequelize.define('ArbitrageOpportunity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  exchange: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  triangle: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
  },
  profitPercentage: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  prices: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  indexes: [
    {
      fields: ['exchange', 'timestamp'],
    },
    {
      fields: ['profitPercentage'],
    },
  ],
});

module.exports = ArbitrageOpportunity;
