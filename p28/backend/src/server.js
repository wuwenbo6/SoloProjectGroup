const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { encode } = require('@msgpack/msgpack');
const MQTTService = require('./services/mqttService');
const InfluxDBService = require('./services/influxdbService');
const DeviceController = require('./controllers/deviceController');
const DeltaSyncService = require('./services/deltaSyncService');
const PythonPredictionClient = require('./services/pythonPredictionClient');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const mqttService = new MQTTService();
const influxDBService = new InfluxDBService();
const deviceController = new DeviceController(mqttService, influxDBService);
const deltaSync = new DeltaSyncService({ throttleMs: 100, changeThreshold: 0.05 });
const predictionClient = new PythonPredictionClient();
const usePythonPrediction = true;

const clients = new Set();
const useMsgPack = true;

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  clients.add(ws);

  const fullStates = deltaSync.getAllStates();
  if (Object.keys(fullStates).length > 0) {
    sendMessage(ws, { type: 'full_state', data: Object.values(fullStates) });
  }

  ws.on('message', async (message) => {
    try {
      let data;
      if (Buffer.isBuffer(message) && useMsgPack) {
        const { decode } = require('@msgpack/msgpack');
        data = decode(message);
      } else {
        data = JSON.parse(message.toString());
      }
      
      if (data.type === 'control') {
        await deviceController.handleControlCommand(data);
        broadcast({ type: 'control_ack', deviceId: data.deviceId, action: data.action });
      } else if (data.type === 'history') {
        const history = await deviceController.getHistoryData(data.deviceId, data.range);
        sendMessage(ws, { type: 'history', deviceId: data.deviceId, data: history });
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

function sendMessage(ws, data) {
  if (ws.readyState !== WebSocket.OPEN) return;
  
  if (useMsgPack) {
    const encoded = encode(data);
    ws.send(encoded, { binary: true });
  } else {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(data) {
  clients.forEach((client) => {
    sendMessage(client, data);
  });
}

deltaSync.onDelta((batch) => {
  broadcast({ type: 'delta', data: batch, timestamp: Date.now() });
});

const deviceHistory = new Map();
const MAX_HISTORY = 100;

mqttService.on('deviceStatus', async (status) => {
  await influxDBService.writePoint(status);

  if (!deviceHistory.has(status.deviceId)) {
    deviceHistory.set(status.deviceId, []);
  }
  const history = deviceHistory.get(status.deviceId);
  history.push(status);
  if (history.length > MAX_HISTORY) history.shift();

  const sandboxed = status;
  deltaSync.processState(sandboxed.deviceId, sandboxed);
});

const sandboxOverrides = new Map();
let sandboxMode = false;

app.post('/api/sandbox/enable', (req, res) => {
  sandboxMode = true;
  broadcast({ type: 'sandbox_status', enabled: true });
  res.json({ success: true, sandboxMode: true });
});

app.post('/api/sandbox/disable', (req, res) => {
  sandboxMode = false;
  sandboxOverrides.clear();
  broadcast({ type: 'sandbox_status', enabled: false });
  res.json({ success: true, sandboxMode: false });
});

app.get('/api/sandbox/status', (req, res) => {
  res.json({
    enabled: sandboxMode,
    overrides: Object.fromEntries(sandboxOverrides)
  });
});

app.post('/api/sandbox/set/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const params = req.body;
  sandboxOverrides.set(deviceId, params);
  broadcast({
    type: 'sandbox_override',
    deviceId,
    params
  });
  res.json({ success: true, deviceId, params });
});

app.get('/api/prediction/health', async (req, res) => {
  try {
    const health = await predictionClient.getHealth();
    res.json({
      ...health,
      usePython: usePythonPrediction,
      queueSize: 0
    });
  } catch (e) {
    res.json({
      status: 'error',
      error: e.message,
      usePython: usePythonPrediction
    });
  }
});

app.post('/api/predict/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  const params = req.body || {};
  const history = deviceHistory.get(deviceId) || [];

  try {
    if (usePythonPrediction && predictionClient.modelReady) {
      const result = await predictionClient.predictAndWait(deviceId, params, history, 30000);
      res.json(result);
    } else {
      const mockPredict = require('./services/predictionService');
      const ps = new mockPredict();
      ps.deviceHistory = deviceHistory;
      res.json(ps.predict5Minutes(deviceId, params));
    }
  } catch (e) {
    console.error('Prediction error:', e);
    if (e.message.includes('MODEL_LOADING')) {
      res.status(503).json({
        error: 'Model still warming up',
        code: 'MODEL_LOADING',
        retryAfter: 10
      });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

app.post('/api/batch-predict', async (req, res) => {
  const { deviceIds, params } = req.body;
  const predictions = [];

  for (const id of deviceIds) {
    try {
      if (usePythonPrediction && predictionClient.modelReady) {
        const result = await predictionClient.predictAndWait(id, params || {}, deviceHistory.get(id) || [], 10000);
        predictions.push({ deviceId: id, ...result });
      } else {
        const mockPredict = require('./services/predictionService');
        const ps = new mockPredict();
        ps.deviceHistory = deviceHistory;
        predictions.push({ deviceId: id, ...ps.predict5Minutes(id, params || {}) });
      }
    } catch (e) {
      predictions.push({ deviceId: id, error: e.message });
    }
  }

  res.json({ predictions });
});

app.get('/api/devices', (req, res) => {
  res.json(deviceController.getAllDevices());
});

app.post('/api/control', async (req, res) => {
  try {
    await deviceController.handleControlCommand(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
  res.json({
    connectedClients: clients.size,
    trackedDevices: deltaSync.previousStates.size,
    pendingUpdates: deltaSync.pendingUpdates.size,
    useMsgPack,
    throttleMs: deltaSync.throttleMs,
    changeThreshold: deltaSync.changeThreshold
  });
});

const PORT = process.env.PORT || 3001;
const START_PYTHON_SERVICE = process.env.ENABLE_PYTHON_PREDICTION !== 'false';

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MessagePack: ${useMsgPack ? 'enabled' : 'disabled'}`);
  console.log(`Delta sync throttle: ${deltaSync.throttleMs}ms`);
  console.log(`Python prediction: ${usePythonPrediction ? 'enabled' : 'disabled'}`);

  if (usePythonPrediction && START_PYTHON_SERVICE) {
    try {
      await predictionClient.startPythonService(true);
      console.log('Python prediction service initialized');
    } catch (e) {
      console.warn('Failed to start Python service, falling back to JS implementation:', e.message);
    }
  }

  mqttService.connect();
  influxDBService.connect();
  deltaSync.start();
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  predictionClient.stop();
  process.exit(0);
});
