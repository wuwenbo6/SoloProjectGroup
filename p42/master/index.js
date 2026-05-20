const Modbus = require('modbus-serial');
const { REGISTER_TYPES } = require('../shared/constants');

class SlaveConnection {
  constructor(host, port, unitId, timeout = 5000) {
    this.host = host;
    this.port = port;
    this.unitId = unitId;
    this.timeout = timeout;
    this.client = new Modbus();
    this.connected = false;
    this.requestQueue = [];
    this.isProcessing = false;
    this.retryCount = 3;
    this.retryDelay = 1000;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 10;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for slave ${this.unitId}`));
      }, this.timeout);

      this.client.connectTCP(this.host, { port: this.port }, (err) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          this.client.setID(this.unitId);
          this.client.setTimeout(this.timeout);
          this.connected = true;
          this.consecutiveErrors = 0;
          resolve();
        }
      });
    });
  }

  async disconnect() {
    if (this.connected) {
      try {
        await this.client.close();
      } catch (e) {
        // ignore close errors
      }
      this.connected = false;
    }
  }

  async enqueueRequest(requestFn, operationName) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFn, operationName, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { requestFn, operationName, resolve, reject } = this.requestQueue.shift();

    try {
      const result = await this.executeWithRetry(requestFn, operationName);
      this.consecutiveErrors = 0;
      resolve(result);
    } catch (error) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        console.warn(`Slave ${this.unitId}: Too many consecutive errors, reconnecting...`);
        this.reconnect().catch(e => console.error('Reconnect failed:', e.message));
      }
      reject(error);
    } finally {
      this.isProcessing = false;
      setImmediate(() => this.processQueue());
    }
  }

  async executeWithRetry(requestFn, operationName) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        if (!this.connected) {
          await this.connect();
        }
        
        return await this.withTimeout(requestFn());
      } catch (error) {
        lastError = error;
        console.warn(`Slave ${this.unitId} - ${operationName} attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.retryCount) {
          await this.delay(this.retryDelay);
          // Force reconnect on timeout errors
          if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
            try {
              await this.disconnect();
              await this.connect();
            } catch (e) {
              // ignore
            }
          }
        }
      }
    }
    
    throw lastError;
  }

  async withTimeout(promise) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), this.timeout)
      )
    ]);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async reconnect() {
    await this.disconnect();
    await this.delay(1000);
    await this.connect();
  }

  async readCoils(address, quantity = 1) {
    return this.enqueueRequest(async () => {
      const result = await this.client.readCoils(address, quantity);
      return result.data;
    }, `readCoils ${address}`);
  }

  async readDiscreteInputs(address, quantity = 1) {
    return this.enqueueRequest(async () => {
      const result = await this.client.readDiscreteInputs(address, quantity);
      return result.data;
    }, `readDiscreteInputs ${address}`);
  }

  async readHoldingRegisters(address, quantity = 1) {
    return this.enqueueRequest(async () => {
      const result = await this.client.readHoldingRegisters(address, quantity);
      return result.data;
    }, `readHoldingRegisters ${address}`);
  }

  async readInputRegisters(address, quantity = 1) {
    return this.enqueueRequest(async () => {
      const result = await this.client.readInputRegisters(address, quantity);
      return result.data;
    }, `readInputRegisters ${address}`);
  }

  async writeCoil(address, value) {
    return this.enqueueRequest(async () => {
      await this.client.writeCoil(address, value);
    }, `writeCoil ${address}`);
  }

  async writeRegister(address, value) {
    return this.enqueueRequest(async () => {
      await this.client.writeRegister(address, value);
    }, `writeRegister ${address}`);
  }

  async writeMultipleCoils(address, values) {
    return this.enqueueRequest(async () => {
      await this.client.writeCoils(address, values);
    }, `writeMultipleCoils ${address}`);
  }

  async writeMultipleRegisters(address, values) {
    return this.enqueueRequest(async () => {
      await this.client.writeRegisters(address, values);
    }, `writeMultipleRegisters ${address}`);
  }
}

class ModbusMaster {
  constructor() {
    this.slaves = new Map();
    this.pollingTasks = new Map();
    this.onDataCallback = null;
  }

  getSlaveKey(host, port, unitId) {
    return `${host}:${port}:${unitId}`;
  }

  async connect(host, port = 502, unitId = 1, timeout = 5000) {
    const key = this.getSlaveKey(host, port, unitId);
    
    if (this.slaves.has(key)) {
      const existing = this.slaves.get(key);
      if (existing.connected) {
        return;
      }
      await existing.disconnect();
    }

    const slave = new SlaveConnection(host, port, unitId, timeout);
    await slave.connect();
    this.slaves.set(key, slave);
  }

  async disconnect(host, port = 502, unitId = 1) {
    const key = this.getSlaveKey(host, port, unitId);
    const slave = this.slaves.get(key);
    if (slave) {
      await slave.disconnect();
      this.slaves.delete(key);
    }
  }

  async disconnectAll() {
    this.stopAllPolling();
    for (const slave of this.slaves.values()) {
      await slave.disconnect();
    }
    this.slaves.clear();
  }

  getSlave(host, port = 502, unitId = 1) {
    const key = this.getSlaveKey(host, port, unitId);
    return this.slaves.get(key);
  }

  isConnected(host, port = 502, unitId = 1) {
    const slave = this.getSlave(host, port, unitId);
    return slave && slave.connected;
  }

  hasAnyConnection() {
    return Array.from(this.slaves.values()).some(s => s.connected);
  }

  async readCoils(host, port, unitId, address, quantity = 1) {
    const slave = this.getSlave(host, port, unitId);
    if (!slave) {
      throw new Error(`Slave ${unitId} not connected`);
    }
    return slave.readCoils(address, quantity);
  }

  async readDiscreteInputs(host, port, unitId, address, quantity = 1) {
    const slave = this.getSlave(host, port, unitId);
    if (!slave) {
      throw new Error(`Slave ${unitId} not connected`);
    }
    return slave.readDiscreteInputs(address, quantity);
  }

  async readHoldingRegisters(host, port, unitId, address, quantity = 1) {
    const slave = this.getSlave(host, port, unitId);
    if (!slave) {
      throw new Error(`Slave ${unitId} not connected`);
    }
    return slave.readHoldingRegisters(address, quantity);
  }

  async readInputRegisters(host, port, unitId, address, quantity = 1) {
    const slave = this.getSlave(host, port, unitId);
    if (!slave) {
      throw new Error(`Slave ${unitId} not connected`);
    }
    return slave.readInputRegisters(address, quantity);
  }

  async writeCoil(host, port, unitId, address, value) {
    const slave = this.getSlave(host, port, unitId);
    if (!slave) {
      throw new Error(`Slave ${unitId} not connected`);
    }
    return slave.writeCoil(address, value);
  }

  async writeRegister(host, port, unitId, address, value) {
    const slave = this.getSlave(host, port, unitId);
    if (!slave) {
      throw new Error(`Slave ${unitId} not connected`);
    }
    return slave.writeRegister(address, value);
  }

  startPolling(taskConfig) {
    const { host, port, unitId, registerType, address, quantity, interval = 1000 } = taskConfig;
    const taskId = `${host}:${port}:${unitId}:${registerType}_${address}_${Date.now()}`;
    
    if (this.pollingTasks.has(taskId)) {
      this.stopPolling(taskId);
    }

    let isRunning = false;
    const poll = async () => {
      if (isRunning) return;
      isRunning = true;

      try {
        const slave = this.getSlave(host, port, unitId);
        if (!slave || !slave.connected) {
          console.warn(`Polling skipped: Slave ${unitId} not connected`);
          return;
        }

        let values;
        switch (registerType) {
          case REGISTER_TYPES.COIL:
            values = await slave.readCoils(address, quantity);
            break;
          case REGISTER_TYPES.DISCRETE_INPUT:
            values = await slave.readDiscreteInputs(address, quantity);
            break;
          case REGISTER_TYPES.HOLDING_REGISTER:
            values = await slave.readHoldingRegisters(address, quantity);
            break;
          case REGISTER_TYPES.INPUT_REGISTER:
            values = await slave.readInputRegisters(address, quantity);
            break;
        }
        
        if (this.onDataCallback && values) {
          values.forEach((value, index) => {
            this.onDataCallback({
              registerType,
              address: address + index,
              value,
              unitId,
              host,
              port,
              timestamp: new Date()
            });
          });
        }
      } catch (error) {
        console.error(`Polling error slave ${unitId} ${registerType} @ ${address}:`, error.message);
      } finally {
        isRunning = false;
      }
    };

    poll();
    const intervalId = setInterval(poll, interval);
    this.pollingTasks.set(taskId, { intervalId, config: taskConfig });
    return taskId;
  }

  stopPolling(taskId) {
    const task = this.pollingTasks.get(taskId);
    if (task) {
      clearInterval(task.intervalId);
      this.pollingTasks.delete(taskId);
    }
  }

  stopAllPolling() {
    this.pollingTasks.forEach((task) => {
      clearInterval(task.intervalId);
    });
    this.pollingTasks.clear();
  }

  getPollingTasks() {
    const tasks = [];
    this.pollingTasks.forEach((task, taskId) => {
      tasks.push({ id: taskId, config: task.config });
    });
    return tasks;
  }

  onData(callback) {
    this.onDataCallback = callback;
  }
}

module.exports = ModbusMaster;
