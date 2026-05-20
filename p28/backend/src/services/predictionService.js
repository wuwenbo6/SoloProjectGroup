class LSTMPredictor {
  constructor(inputSize = 4, hiddenSize = 16, outputSize = 1) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    this.weights = {
      Wf: this.randomMatrix(hiddenSize, inputSize + hiddenSize),
      Wi: this.randomMatrix(hiddenSize, inputSize + hiddenSize),
      Wc: this.randomMatrix(hiddenSize, inputSize + hiddenSize),
      Wo: this.randomMatrix(hiddenSize, inputSize + hiddenSize),
      Wy: this.randomMatrix(outputSize, hiddenSize),
      bf: this.randomVector(hiddenSize),
      bi: this.randomVector(hiddenSize),
      bc: this.randomVector(hiddenSize),
      bo: this.randomVector(hiddenSize),
      by: this.randomVector(outputSize)
    };
    this.trainOnDummyData();
  }

  randomMatrix(rows, cols) {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() - 0.5) * 0.1)
    );
  }

  randomVector(size) {
    return Array.from({ length: size }, () => (Math.random() - 0.5) * 0.1);
  }

  sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-10, Math.min(10, x))));
  }

  tanh(x) {
    return Math.tanh(x);
  }

  matMulVec(mat, vec) {
    return mat.map(row =>
      row.reduce((sum, val, i) => sum + val * vec[i], 0)
    );
  }

  vecAdd(a, b) {
    return a.map((val, i) => val + b[i]);
  }

  forward(inputSeq, h0 = null, c0 = null) {
    let h = h0 || Array(this.hiddenSize).fill(0);
    let c = c0 || Array(this.hiddenSize).fill(0);
    const outputs = [];

    for (const x of inputSeq) {
      const concat = [...x, ...h];
      const f = this.matMulVec(this.weights.Wf, concat).map((v, i) => this.sigmoid(v + this.weights.bf[i]));
      const iGate = this.matMulVec(this.weights.Wi, concat).map((v, i) => this.sigmoid(v + this.weights.bi[i]));
      const cTilde = this.matMulVec(this.weights.Wc, concat).map((v, i) => this.tanh(v + this.weights.bc[i]));
      const o = this.matMulVec(this.weights.Wo, concat).map((v, i) => this.sigmoid(v + this.weights.bo[i]));
      c = f.map((fv, i) => fv * c[i] + iGate[i] * cTilde[i]);
      h = c.map((cv, i) => o[i] * this.tanh(cv));
      const y = this.matMulVec(this.weights.Wy, h).map((v, i) => v + this.weights.by[i]);
      outputs.push(y[0]);
    }

    return outputs;
  }

  trainOnDummyData() {
    const epochs = 100;
    for (let e = 0; e < epochs; e++) {
      for (let i = 0; i < 10; i++) {
        const seq = Array.from({ length: 10 }, () => [
          30 + Math.random() * 40,
          Math.random() * 2,
          Math.random() * 0.5,
          Math.random()
        ]);
        this.forward(seq);
      }
    }
  }
}

class PredictionService {
  constructor() {
    this.lstm = new LSTMPredictor();
    this.deviceHistory = new Map();
    this.sandboxMode = false;
    this.sandboxOverrides = new Map();
  }

  recordDeviceData(deviceId, data) {
    if (!this.deviceHistory.has(deviceId)) {
      this.deviceHistory.set(deviceId, []);
    }
    const history = this.deviceHistory.get(deviceId);
    history.push({ ...data, timestamp: Date.now() });
    if (history.length > 1000) {
      history.shift();
    }
  }

  extractFeatures(history, params = {}) {
    const features = [];
    for (const point of history) {
      features.push([
        point.temperature || 30,
        point.speed || point.rotationSpeed || 1,
        point.battery !== undefined ? (100 - point.battery) / 100 : 0,
        point.running ? 1 : 0
      ]);
    }
    return features;
  }

  predictFailureProbability(deviceId, futureParams = {}, horizon = 30) {
    const history = this.deviceHistory.get(deviceId) || [];
    if (history.length < 10) {
      return {
        probability: 0.05,
        predictions: Array(horizon).fill(0.05),
        confidence: 0.3,
        warning: '历史数据不足，预测置信度较低'
      };
    }

    const features = this.extractFeatures(history.slice(-20), futureParams);
    
    const baseTemp = history.reduce((sum, h) => sum + (h.temperature || 30), 0) / history.length;
    const tempMultiplier = futureParams.temperature ? futureParams.temperature / baseTemp : 1;
    const speedMultiplier = futureParams.speed ? futureParams.speed / (history[0]?.speed || 1) : 1;
    const stressFactor = (tempMultiplier * 0.6 + speedMultiplier * 0.4);

    const predictions = [];
    let prob = 0.01;
    
    for (let i = 0; i < horizon; i++) {
      const timeDecay = 1 + (i / horizon) * 0.5;
      const tempRisk = Math.max(0, (baseTemp * tempMultiplier - 50) / 30);
      const randomNoise = (Math.random() - 0.5) * 0.02;
      
      prob = Math.min(0.95, Math.max(0, prob + tempRisk * 0.02 * timeDecay + randomNoise));
      prob *= stressFactor;
      predictions.push(Math.min(1, Math.max(0, prob)));
    }

    return {
      probability: predictions[predictions.length - 1],
      predictions,
      confidence: Math.min(0.95, 0.4 + history.length / 500),
      baselineProbability: predictions[predictions.length - 1] / stressFactor,
      impactFactors: {
        temperature: tempMultiplier > 1.1 ? 'high' : tempMultiplier > 1.05 ? 'medium' : 'low',
        speed: speedMultiplier > 1.2 ? 'high' : speedMultiplier > 1.1 ? 'medium' : 'low'
      }
    };
  }

  predict5Minutes(deviceId, params = {}) {
    const result = this.predictFailureProbability(deviceId, params, 30);
    const timestamps = Array.from({ length: 30 }, (_, i) =>
      new Date(Date.now() + (i + 1) * 10000).toISOString()
    );
    
    return {
      deviceId,
      timestamp: Date.now(),
      horizonMinutes: 5,
      failureProbability: result.predictions,
      finalProbability: result.probability,
      confidence: result.confidence,
      baselineProbability: result.baselineProbability,
      impactFactors: result.impactFactors,
      riskLevel: result.probability > 0.6 ? 'high' : result.probability > 0.3 ? 'medium' : 'low',
      recommendation: this.generateRecommendation(result.probability, params),
      timestamps
    };
  }

  generateRecommendation(probability, params) {
    if (probability > 0.7) {
      return {
        level: 'critical',
        title: '立即调整参数',
        suggestions: [
          '降低设备运行速度20%以上',
          '启动冷却系统降低温度',
          '建议停机检修'
        ]
      };
    } else if (probability > 0.4) {
      return {
        level: 'warning',
        title: '参数调整需谨慎',
        suggestions: [
          '可适当降低运行速度',
          '监控温度变化趋势',
          '考虑预防性维护'
        ]
      };
    }
    return {
      level: 'safe',
      title: '参数在安全范围内',
      suggestions: [
        '当前参数配置合理',
        '可持续监控运行状态',
        '定期维护即可'
      ]
    };
  }

  enableSandboxMode() {
    this.sandboxMode = true;
    this.sandboxOverrides.clear();
  }

  disableSandboxMode() {
    this.sandboxMode = false;
    this.sandboxOverrides.clear();
  }

  setSandboxOverride(deviceId, params) {
    this.sandboxOverrides.set(deviceId, params);
  }

  getSandboxOverride(deviceId) {
    return this.sandboxOverrides.get(deviceId) || {};
  }

  applySandboxToStatus(status) {
    if (!this.sandboxMode) return status;
    
    const override = this.sandboxOverrides.get(status.deviceId);
    if (!override) return status;

    return {
      ...status,
      ...override,
      sandboxed: true
    };
  }
}

module.exports = PredictionService;
