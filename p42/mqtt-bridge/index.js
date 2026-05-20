const mqtt = require('mqtt');
const { REGISTER_TYPES } = require('../shared/constants');

class MqttBridge {
  constructor(master, slave) {
    this.master = master;
    this.slave = slave;
    this.client = null;
    this.connected = false;
    this.config = null;
    this.subscribedTopics = new Set();
    this.dataCallbacks = [];
  }

  connect(config) {
    return new Promise((resolve, reject) => {
      this.config = {
        host: config.host || 'localhost',
        port: config.port || 1883,
        username: config.username,
        password: config.password,
        clientId: config.clientId || `modbus-bridge-${Date.now()}`,
        publishTopic: config.publishTopic || 'modbus/data',
        subscribeTopic: config.subscribeTopic || 'modbus/command',
        qos: config.qos || 0,
        retain: config.retain || false
      };

      const connectUrl = `mqtt://${this.config.host}:${this.config.port}`;
      const options = {
        clientId: this.config.clientId,
        username: this.config.username,
        password: this.config.password,
        reconnectPeriod: 5000,
        connectTimeout: 10000
      };

      this.client = mqtt.connect(connectUrl, options);

      this.client.on('connect', () => {
        console.log(`[MQTT] 连接成功: ${connectUrl}`);
        this.connected = true;
        this.subscribeToCommands();
        resolve();
      });

      this.client.on('error', (err) => {
        console.error('[MQTT] 连接错误:', err.message);
        if (!this.connected) {
          reject(err);
        }
      });

      this.client.on('reconnect', () => {
        console.log('[MQTT] 正在重连...');
      });

      this.client.on('close', () => {
        console.log('[MQTT] 连接已关闭');
        this.connected = false;
      });

      this.client.on('message', (topic, message) => {
        this.handleCommand(topic, message.toString());
      });
    });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.connected = false;
      this.subscribedTopics.clear();
    }
  }

  subscribeToCommands() {
    if (!this.client || !this.connected) return;

    const topic = this.config.subscribeTopic;
    if (!this.subscribedTopics.has(topic)) {
      this.client.subscribe(topic, { qos: this.config.qos }, (err) => {
        if (err) {
          console.error('[MQTT] 订阅失败:', err.message);
        } else {
          console.log(`[MQTT] 已订阅主题: ${topic}`);
          this.subscribedTopics.add(topic);
        }
      });
    }
  }

  async handleCommand(topic, message) {
    try {
      const command = JSON.parse(message);
      console.log(`[MQTT] 收到命令:`, command);

      switch (command.action) {
        case 'read':
          await this.handleReadCommand(command);
          break;
        case 'write':
          await this.handleWriteCommand(command);
          break;
        default:
          console.warn(`[MQTT] 未知命令类型: ${command.action}`);
      }
    } catch (error) {
      console.error('[MQTT] 命令处理错误:', error.message);
    }
  }

  async handleReadCommand(command) {
    const { host, port, unitId, registerType, address, quantity = 1 } = command;

    if (!this.master.isConnected(host, port, unitId)) {
      console.warn(`[MQTT] 从站未连接: ${host}:${port}:${unitId}`);
      return;
    }

    try {
      let values;
      switch (registerType) {
        case REGISTER_TYPES.COIL:
          values = await this.master.readCoils(host, port, unitId, address, quantity);
          break;
        case REGISTER_TYPES.DISCRETE_INPUT:
          values = await this.master.readDiscreteInputs(host, port, unitId, address, quantity);
          break;
        case REGISTER_TYPES.HOLDING_REGISTER:
          values = await this.master.readHoldingRegisters(host, port, unitId, address, quantity);
          break;
        case REGISTER_TYPES.INPUT_REGISTER:
          values = await this.master.readInputRegisters(host, port, unitId, address, quantity);
          break;
        default:
          throw new Error(`未知寄存器类型: ${registerType}`);
      }

      this.publishResponse({
        action: 'read_result',
        host,
        port,
        unitId,
        registerType,
        address,
        values,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.publishResponse({
        action: 'error',
        error: error.message,
        command
      });
    }
  }

  async handleWriteCommand(command) {
    const { host, port, unitId, registerType, address, value, values } = command;

    if (!this.master.isConnected(host, port, unitId)) {
      console.warn(`[MQTT] 从站未连接: ${host}:${port}:${unitId}`);
      return;
    }

    try {
      switch (registerType) {
        case REGISTER_TYPES.COIL:
          if (values && Array.isArray(values)) {
            await this.master.client.writeCoils(address, values);
          } else {
            await this.master.writeCoil(host, port, unitId, address, value);
          }
          break;
        case REGISTER_TYPES.HOLDING_REGISTER:
          if (values && Array.isArray(values)) {
            await this.master.client.writeRegisters(address, values);
          } else {
            await this.master.writeRegister(host, port, unitId, address, value);
          }
          break;
        default:
          throw new Error(`寄存器类型不支持写入: ${registerType}`);
      }

      this.publishResponse({
        action: 'write_result',
        host,
        port,
        unitId,
        registerType,
        address,
        value: value || values,
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.publishResponse({
        action: 'error',
        error: error.message,
        command
      });
    }
  }

  publishResponse(data) {
    if (!this.client || !this.connected) return;

    const topic = `${this.config.publishTopic}/response`;
    const message = JSON.stringify(data);

    this.client.publish(topic, message, {
      qos: this.config.qos,
      retain: this.config.retain
    }, (err) => {
      if (err) {
        console.error('[MQTT] 发布失败:', err.message);
      }
    });
  }

  publishRegisterData(data) {
    if (!this.client || !this.connected) return;

    const topic = `${this.config.publishTopic}/${data.registerType}/${data.address}`;
    const message = JSON.stringify({
      value: data.value,
      unitId: data.unitId,
      host: data.host,
      port: data.port,
      timestamp: data.timestamp || new Date().toISOString()
    });

    this.client.publish(topic, message, {
      qos: this.config.qos,
      retain: this.config.retain
    }, (err) => {
      if (err) {
        console.error('[MQTT] 发布数据失败:', err.message);
      }
    });

    this.dataCallbacks.forEach(cb => cb({ topic, data: JSON.parse(message) }));
  }

  publishSlaveRegisterData(data) {
    if (!this.client || !this.connected) return;

    const topic = `${this.config.publishTopic}/slave/${data.registerType}/${data.address}`;
    const message = JSON.stringify({
      value: data.value,
      source: 'slave',
      timestamp: data.timestamp || new Date().toISOString()
    });

    this.client.publish(topic, message, {
      qos: this.config.qos,
      retain: this.config.retain
    });

    this.dataCallbacks.forEach(cb => cb({ topic, data: JSON.parse(message) }));
  }

  publishBatch(dataArray) {
    if (!this.client || !this.connected || dataArray.length === 0) return;

    const topic = `${this.config.publishTopic}/batch`;
    const message = JSON.stringify({
      count: dataArray.length,
      data: dataArray,
      timestamp: new Date().toISOString()
    });

    this.client.publish(topic, message, {
      qos: this.config.qos,
      retain: false
    });
  }

  onData(callback) {
    this.dataCallbacks.push(callback);
  }

  isConnected() {
    return this.connected;
  }

  getConfig() {
    return this.config;
  }
}

module.exports = MqttBridge;
