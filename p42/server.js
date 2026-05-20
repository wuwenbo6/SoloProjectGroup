const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const ModbusMaster = require('./master');
const ModbusSlave = require('./slave');
const Database = require('./database');
const dbConfig = require('./database/config');
const ScriptEngine = require('./script-engine');
const MqttBridge = require('./mqtt-bridge');
const FuzzingEngine = require('./fuzzing');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

let master = null;
let slave = null;
let db = null;
let scriptEngine = null;
let mqttBridge = null;
let fuzzing = null;
let currentSlaveConfig = { host: 'localhost', port: 502, unitId: 1 };
let mqttMessageLog = [];

async function init() {
  try {
    db = new Database(dbConfig);
    await db.init();
    console.log('Database connected');
  } catch (error) {
    console.warn('Database connection failed, running without history logging:', error.message);
  }

  slave = new ModbusSlave();
  master = new ModbusMaster();
  scriptEngine = new ScriptEngine(slave);
  mqttBridge = new MqttBridge(master, slave);
  fuzzing = new FuzzingEngine();

  mqttBridge.onData(({ topic, data }) => {
    mqttMessageLog.push({
      direction: 'publish',
      topic,
      payload: data,
      timestamp: new Date().toISOString()
    });
    if (mqttMessageLog.length > 100) mqttMessageLog.shift();
    io.emit('mqttMessage', { direction: 'publish', topic, payload: data });
  });

  slave.onData(async (data) => {
    io.emit('registerUpdate', data);
    if (mqttBridge && mqttBridge.isConnected()) {
      mqttBridge.publishSlaveRegisterData(data);
    }
    if (db) {
      try {
        await db.insertRegisterData(data.registerType, data.address, data.value);
      } catch (e) {
        console.error('Failed to insert data:', e.message);
      }
    }
  });

  master.onData(async (data) => {
    io.emit('registerUpdate', data);
    if (mqttBridge && mqttBridge.isConnected()) {
      mqttBridge.publishRegisterData(data);
    }
    if (db) {
      try {
        await db.insertRegisterData(data.registerType, data.address, data.value);
      } catch (e) {
        console.error('Failed to insert data:', e.message);
      }
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected');

    socket.emit('masterStatus', master.hasAnyConnection());
    socket.emit('slaveStatus', !!slave.server);
    socket.emit('scriptsUpdate', scriptEngine.getScripts());
    socket.emit('scriptLogsUpdate', scriptEngine.getLogs());
    socket.emit('mqttStatus', { connected: mqttBridge.isConnected(), config: mqttBridge.getConfig() });
    socket.emit('mqttLogUpdate', mqttMessageLog);
    socket.emit('fuzzingStatus', { isRunning: fuzzing.isRunning });

    fuzzing.onProgress((progress) => {
      io.emit('fuzzingProgress', progress);
    });

    fuzzing.onResult((result) => {
      io.emit('fuzzingResult', result);
    });

    socket.on('startFuzzing', async (config) => {
      try {
        await fuzzing.start(config);
      } catch (error) {
        socket.emit('fuzzingError', { message: error.message });
      }
    });

    socket.on('stopFuzzing', () => {
      fuzzing.stop();
    });

    socket.on('getFuzzingResults', () => {
      socket.emit('fuzzingResults', fuzzing.getResults());
    });

    socket.on('mqttConnect', async (config) => {
      try {
        await mqttBridge.connect(config);
        io.emit('mqttStatus', { connected: true, config: mqttBridge.getConfig() });
      } catch (error) {
        socket.emit('mqttError', { message: error.message });
      }
    });

    socket.on('mqttDisconnect', () => {
      mqttBridge.disconnect();
      io.emit('mqttStatus', { connected: false, config: null });
    });

    socket.on('mqttPublish', (data) => {
      if (mqttBridge.isConnected()) {
        mqttBridge.client.publish(data.topic, JSON.stringify(data.payload), {
          qos: data.qos || 0,
          retain: data.retain || false
        });
        mqttMessageLog.push({
          direction: 'publish',
          topic: data.topic,
          payload: data.payload,
          timestamp: new Date().toISOString()
        });
        if (mqttMessageLog.length > 100) mqttMessageLog.shift();
        io.emit('mqttLogUpdate', mqttMessageLog);
      }
    });

    socket.on('mqttSendCommand', (command) => {
      if (mqttBridge.isConnected()) {
        mqttBridge.client.publish(
          mqttBridge.getConfig().subscribeTopic,
          JSON.stringify(command),
          { qos: command.qos || 1 }
        );
        mqttMessageLog.push({
          direction: 'command',
          topic: mqttBridge.getConfig().subscribeTopic,
          payload: command,
          timestamp: new Date().toISOString()
        });
        if (mqttMessageLog.length > 100) mqttMessageLog.shift();
        io.emit('mqttLogUpdate', mqttMessageLog);
      }
    });

    socket.on('masterConnect', async ({ host, port, unitId, timeout = 5000 }) => {
      try {
        await master.connect(host, port, unitId, timeout);
        currentSlaveConfig = { host, port, unitId };
        io.emit('masterStatus', master.hasAnyConnection());
        console.log(`Master connected to slave ${unitId} at ${host}:${port}`);
      } catch (error) {
        console.error('Master connection error:', error.message);
      }
    });

    socket.on('masterDisconnect', async ({ host, port, unitId }) => {
      if (host && port && unitId) {
        await master.disconnect(host, port, unitId);
        console.log(`Master disconnected from slave ${unitId} at ${host}:${port}`);
      } else {
        await master.disconnectAll();
        console.log('Master disconnected from all slaves');
      }
      io.emit('masterStatus', master.hasAnyConnection());
    });

    socket.on('startPolling', ({ host, port, unitId, registerType, startAddress, quantity, interval = 1000 }) => {
      const targetHost = host || currentSlaveConfig.host;
      const targetPort = port || currentSlaveConfig.port;
      const targetUnitId = unitId || currentSlaveConfig.unitId;
      
      if (master.isConnected(targetHost, targetPort, targetUnitId)) {
        const taskId = master.startPolling({
          host: targetHost,
          port: targetPort,
          unitId: targetUnitId,
          registerType,
          address: startAddress,
          quantity,
          interval
        });
        console.log(`Started polling slave ${targetUnitId}: ${registerType} @ ${startAddress}`);
        return taskId;
      } else {
        console.warn(`Cannot start polling: Slave ${targetUnitId} not connected`);
      }
    });

    socket.on('stopPolling', (taskId) => {
      master.stopPolling(taskId);
      console.log(`Stopped polling task: ${taskId}`);
    });

    socket.on('stopAllPolling', () => {
      master.stopAllPolling();
      console.log('Stopped all polling tasks');
    });

    socket.on('writeRegister', async ({ host, port, unitId, registerType, address, value }) => {
      const targetHost = host || currentSlaveConfig.host;
      const targetPort = port || currentSlaveConfig.port;
      const targetUnitId = unitId || currentSlaveConfig.unitId;
      
      if (!master.isConnected(targetHost, targetPort, targetUnitId)) {
        console.warn(`Cannot write: Slave ${targetUnitId} not connected`);
        return;
      }
      
      try {
        switch (registerType) {
          case 'coil':
            await master.writeCoil(targetHost, targetPort, targetUnitId, address, value);
            break;
          case 'holding_register':
            await master.writeRegister(targetHost, targetPort, targetUnitId, address, value);
            break;
        }
        console.log(`Write to slave ${targetUnitId}: ${registerType} @ ${address} = ${value}`);
      } catch (error) {
        console.error('Write register error:', error.message);
      }
    });

    socket.on('startSlave', async ({ port }) => {
      try {
        await slave.start(port);
        io.emit('slaveStatus', true);
        console.log('Slave started on port', port);
      } catch (error) {
        console.error('Slave start error:', error.message);
      }
    });

    socket.on('stopSlave', () => {
      slave.stop();
      io.emit('slaveStatus', false);
      console.log('Slave stopped');
    });

    socket.on('setSlaveRegister', ({ registerType, address, value }) => {
      switch (registerType) {
        case 'coil':
          slave.setCoil(address, value);
          break;
        case 'discrete_input':
          slave.setDiscreteInput(address, value);
          break;
        case 'holding_register':
          slave.setHoldingRegister(address, value);
          break;
        case 'input_register':
          slave.setInputRegister(address, value);
          break;
      }
    });

    socket.on('queryHistory', async ({ registerType, address, startTime, endTime }) => {
      if (!db) {
        socket.emit('historyData', []);
        return;
      }
      try {
        const data = await db.getRegisterHistory(registerType, address, startTime, endTime);
        socket.emit('historyData', data);
      } catch (error) {
        console.error('Query history error:', error.message);
        socket.emit('historyData', []);
      }
    });

    socket.on('addScript', ({ id, code, interval }) => {
      try {
        scriptEngine.addScript(id, code, interval);
        io.emit('scriptsUpdate', scriptEngine.getScripts());
      } catch (error) {
        console.error('Add script error:', error.message);
      }
    });

    socket.on('startScript', (id) => {
      try {
        scriptEngine.startScript(id);
        io.emit('scriptsUpdate', scriptEngine.getScripts());
      } catch (error) {
        console.error('Start script error:', error.message);
      }
    });

    socket.on('stopScript', (id) => {
      try {
        scriptEngine.stopScript(id);
        io.emit('scriptsUpdate', scriptEngine.getScripts());
      } catch (error) {
        console.error('Stop script error:', error.message);
      }
    });

    socket.on('removeScript', (id) => {
      try {
        scriptEngine.removeScript(id);
        io.emit('scriptsUpdate', scriptEngine.getScripts());
      } catch (error) {
        console.error('Remove script error:', error.message);
      }
    });

    socket.on('clearScriptLogs', () => {
      scriptEngine.clearLogs();
      io.emit('scriptLogsUpdate', []);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
}

const PORT = process.env.PORT || 3001;

init().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
