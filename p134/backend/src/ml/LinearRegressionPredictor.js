const PredictionModel = require('../models/PredictionModel');
const redis = require('../config/redis');

class LinearRegressionPredictor {
  constructor() {
    this.models = new Map();
    this.priceHistory = new Map();
    this.maxHistorySize = 10000;
    this.predictionCache = new Map();
    this.trainingInterval = 300000;
    this.lastTrainingTime = 0;
  }

  addPriceData(exchange, symbol, priceData) {
    const key = `${exchange}:${symbol}`;
    if (!this.priceHistory.has(key)) {
      this.priceHistory.set(key, []);
    }

    const history = this.priceHistory.get(key);
    history.push({
      timestamp: priceData.timestamp || Date.now(),
      bid: priceData.bid,
      ask: priceData.ask,
      mid: (priceData.bid + priceData.ask) / 2,
      spread: ((priceData.ask - priceData.bid) / priceData.bid) * 100,
    });

    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  extractFeatures(prices, horizon = 60) {
    const features = [];
    const windowSize = 20;

    for (let i = windowSize; i < prices.length - horizon; i++) {
      const window = prices.slice(i - windowSize, i);
      const current = prices[i];

      const sma = window.reduce((a, b) => a + b.mid, 0) / window.length;
      const ema = window.reduce((acc, p, idx) => 
        idx === 0 ? p.mid : (2 * p.mid + acc * (windowSize - 1)) / (windowSize + 1)
      , 0);

      const returns = window.map((p, j) => 
        j > 0 ? (p.mid - window[j - 1].mid) / window[j - 1].mid : 0
      );
      const volatility = Math.sqrt(returns.reduce((a, b) => a + b * b, 0) / returns.length);

      const momentum = (current.mid - window[0].mid) / window[0].mid;

      const avgSpread = window.reduce((a, p) => a + p.spread, 0) / window.length;

      features.push({
        features: [
          sma / current.mid - 1,
          ema / current.mid - 1,
          volatility,
          momentum,
          avgSpread,
        ],
        target: (prices[i + horizon].mid - current.mid) / current.mid,
      });
    }

    return features;
  }

  async trainModel(exchange, symbol, horizon = 60) {
    const key = `${exchange}:${symbol}`;
    const prices = this.priceHistory.get(key) || [];

    if (prices.length < 200) {
      console.log(`Not enough data to train ${key}: ${prices.length} points`);
      return null;
    }

    const dataset = this.extractFeatures(prices, horizon);
    if (dataset.length < 100) {
      console.log(`Not enough samples for ${key}: ${dataset.length}`);
      return null;
    }

    const X = dataset.map(d => d.features);
    const y = dataset.map(d => d.target);

    const nFeatures = X[0].length;
    const nSamples = X.length;

    const XtX = Array(nFeatures).fill(null).map(() => Array(nFeatures).fill(0));
    const Xty = Array(nFeatures).fill(0);

    for (let i = 0; i < nSamples; i++) {
      for (let j = 0; j < nFeatures; j++) {
        Xty[j] += X[i][j] * y[i];
        for (let k = 0; k < nFeatures; k++) {
          XtX[j][k] += X[i][j] * X[i][k];
        }
      }
    }

    const coefficients = this.solveLinearSystem(XtX, Xty);
    const intercept = y.reduce((a, b) => a + b, 0) / nSamples - 
      coefficients.reduce((sum, c, i) => 
        sum + c * (X.reduce((a, x) => a + x[i], 0) / nSamples), 0);

    let yPredSum = 0;
    let ssRes = 0;
    let ssTot = 0;
    const yMean = y.reduce((a, b) => a + b, 0) / nSamples;

    for (let i = 0; i < nSamples; i++) {
      const pred = intercept + coefficients.reduce((sum, c, j) => sum + c * X[i][j], 0);
      yPredSum += pred;
      ssRes += Math.pow(y[i] - pred, 2);
      ssTot += Math.pow(y[i] - yMean, 2);
    }

    const rSquared = 1 - (ssRes / ssTot);
    const rmse = Math.sqrt(ssRes / nSamples);

    const modelData = {
      symbol,
      exchange,
      modelType: 'linear_regression',
      coefficients: coefficients.reduce((acc, c, i) => ({ ...acc, [`f${i}`]: c }), {}),
      intercept,
      lastTrainTime: new Date(),
      sampleCount: nSamples,
      rSquared,
      rmse,
      predictionHorizon: horizon,
      features: ['sma', 'ema', 'volatility', 'momentum', 'avg_spread'],
    };

    const [model, created] = await PredictionModel.findOrCreate({
      where: { symbol, exchange, modelType: 'linear_regression' },
      defaults: modelData,
    });

    if (!created) {
      await model.update(modelData);
    }

    this.models.set(key, modelData);
    this.lastTrainingTime = Date.now();

    return {
      model,
      rSquared,
      rmse,
      sampleCount: nSamples,
    };
  }

  solveLinearSystem(A, b) {
    const n = A.length;
    const augmented = A.map((row, i) => [...row, b[i]]);

    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      const pivot = augmented[i][i];
      if (Math.abs(pivot) < 1e-10) continue;

      for (let j = i; j <= n; j++) {
        augmented[i][j] /= pivot;
      }

      for (let k = 0; k < n; k++) {
        if (k !== i && Math.abs(augmented[k][i]) > 1e-10) {
          const factor = augmented[k][i];
          for (let j = i; j <= n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    return augmented.map(row => row[n]);
  }

  predict(exchange, symbol) {
    const key = `${exchange}:${symbol}`;
    const prices = this.priceHistory.get(key);
    const model = this.models.get(key);

    if (!prices || prices.length < 20 || !model) {
      return null;
    }

    const window = prices.slice(-20);
    const current = prices[prices.length - 1];

    const sma = window.reduce((a, b) => a + b.mid, 0) / window.length;
    const ema = window.reduce((acc, p, idx) => 
      idx === 0 ? p.mid : (2 * p.mid + acc * 19) / 21
    , 0);

    const returns = window.map((p, j) => 
      j > 0 ? (p.mid - window[j - 1].mid) / window[j - 1].mid : 0
    );
    const volatility = Math.sqrt(returns.reduce((a, b) => a + b * b, 0) / returns.length);
    const momentum = (current.mid - window[0].mid) / window[0].mid;
    const avgSpread = window.reduce((a, p) => a + p.spread, 0) / window.length;

    const features = [
      sma / current.mid - 1,
      ema / current.mid - 1,
      volatility,
      momentum,
      avgSpread,
    ];

    const coefficients = Object.values(model.coefficients);
    const predictedReturn = model.intercept + 
      features.reduce((sum, f, i) => sum + f * (coefficients[i] || 0), 0);

    const prediction = {
      currentMid: current.mid,
      predictedReturn: predictedReturn * 100,
      predictedPrice: current.mid * (1 + predictedReturn),
      horizon: model.predictionHorizon,
      timestamp: Date.now(),
      rSquared: model.rSquared,
    };

    this.predictionCache.set(key, prediction);
    return prediction;
  }

  async getAllPredictions(exchange, symbols) {
    const predictions = {};

    if (Date.now() - this.lastTrainingTime > this.trainingInterval) {
      for (const symbol of symbols) {
        await this.trainModel(exchange, symbol);
      }
    }

    for (const symbol of symbols) {
      const pred = this.predict(exchange, symbol);
      if (pred) {
        predictions[symbol] = pred;
      }
    }

    return predictions;
  }

  async loadModelsFromDB() {
    const models = await PredictionModel.findAll();
    for (const model of models) {
      const key = `${model.exchange}:${model.symbol}`;
      this.models.set(key, model.toJSON());
    }
    console.log(`Loaded ${models.length} prediction models from DB`);
  }
}

module.exports = LinearRegressionPredictor;
