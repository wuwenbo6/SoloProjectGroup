const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Position = sequelize.define('Position', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  exchange: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  symbol: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  baseAsset: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quoteAsset: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  avgEntryPrice: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  currentPrice: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  unrealizedPnl: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  realizedPnl: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  totalCost: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  tradeCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  indexes: [
    { fields: ['exchange', 'symbol'] },
    { fields: ['baseAsset'] },
  ],
});

module.exports = Position;
