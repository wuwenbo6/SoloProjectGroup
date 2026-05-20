const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PredictionModel = sequelize.define('PredictionModel', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  symbol: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  exchange: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  modelType: {
    type: DataTypes.STRING,
    defaultValue: 'linear_regression',
  },
  coefficients: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  intercept: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  lastTrainTime: {
    type: DataTypes.DATE,
  },
  sampleCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rSquared: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  rmse: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  predictionHorizon: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
  },
  features: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
}, {
  indexes: [
    { fields: ['symbol', 'exchange', 'modelType'] },
  ],
});

module.exports = PredictionModel;
