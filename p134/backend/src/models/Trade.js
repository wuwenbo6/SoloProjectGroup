const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Trade = sequelize.define('Trade', {
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
  side: {
    type: DataTypes.ENUM('BUY', 'SELL'),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('MARKET', 'LIMIT'),
    defaultValue: 'MARKET',
  },
  quantity: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  fee: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  feeCurrency: {
    type: DataTypes.STRING,
    defaultValue: 'USDT',
  },
  status: {
    type: DataTypes.ENUM('OPEN', 'FILLED', 'CANCELLED', 'REJECTED'),
    defaultValue: 'FILLED',
  },
  isSimulation: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  arbitrageId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  note: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  indexes: [
    { fields: ['exchange', 'createdAt'] },
    { fields: ['symbol', 'side'] },
    { fields: ['isSimulation'] },
  ],
});

module.exports = Trade;
