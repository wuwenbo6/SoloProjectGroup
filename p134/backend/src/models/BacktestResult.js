const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BacktestResult = sequelize.define('BacktestResult', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  exchange: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  triangle: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  initialCapital: {
    type: DataTypes.FLOAT,
    defaultValue: 10000,
  },
  finalCapital: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  totalReturn: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  totalTrades: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  profitableTrades: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  winRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  maxDrawdown: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  sharpeRatio: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  profitFactor: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  totalProfit: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  totalLoss: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  avgTradePnl: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  feeRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0.001,
  },
  slippage: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0005,
  },
  status: {
    type: DataTypes.ENUM('RUNNING', 'COMPLETED', 'FAILED'),
    defaultValue: 'RUNNING',
  },
  equityCurve: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  tradeHistory: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
}, {
  indexes: [
    { fields: ['exchange', 'status'] },
    { fields: ['startTime', 'endTime'] },
  ],
});

module.exports = BacktestResult;
