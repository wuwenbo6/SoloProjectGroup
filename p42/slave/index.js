const net = require('net');
const { REGISTER_TYPES } = require('../shared/constants');

class ModbusSlave {
  constructor() {
    this.server = null;
    this.clients = new Set();
    this.coils = new Map();
    this.discreteInputs = new Map();
    this.holdingRegisters = new Map();
    this.inputRegisters = new Map();
    this.onDataCallback = null;
  }

  start(port = 502) {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.clients.add(socket);
        
        socket.on('data', (data) => {
          this.handleModbusRequest(socket, data);
        });
        
        socket.on('close', () => {
          this.clients.delete(socket);
        });
        
        socket.on('error', (err) => {
          console.error('Socket error:', err.message);
          this.clients.delete(socket);
        });
      });
      
      this.server.listen(port, () => {
        console.log(`Modbus TCP Slave started on port ${port}`);
        resolve();
      });
      
      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  stop() {
    this.clients.forEach((client) => client.destroy());
    this.clients.clear();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  handleModbusRequest(socket, data) {
    if (data.length < 8) return;
    
    const transactionId = data.readUInt16BE(0);
    const protocolId = data.readUInt16BE(2);
    const length = data.readUInt16BE(4);
    const unitId = data.readUInt8(6);
    const functionCode = data.readUInt8(7);
    
    if (protocolId !== 0) return;
    
    let response = null;
    
    try {
      switch (functionCode) {
        case 1:
          response = this.handleReadCoils(data);
          break;
        case 2:
          response = this.handleReadDiscreteInputs(data);
          break;
        case 3:
          response = this.handleReadHoldingRegisters(data);
          break;
        case 4:
          response = this.handleReadInputRegisters(data);
          break;
        case 5:
          response = this.handleWriteSingleCoil(data);
          break;
        case 6:
          response = this.handleWriteSingleRegister(data);
          break;
        case 15:
          response = this.handleWriteMultipleCoils(data);
          break;
        case 16:
          response = this.handleWriteMultipleRegisters(data);
          break;
        default:
          response = this.buildExceptionResponse(functionCode, 1);
      }
    } catch (error) {
      response = this.buildExceptionResponse(functionCode, 2);
    }
    
    if (response) {
      const header = Buffer.alloc(7);
      header.writeUInt16BE(transactionId, 0);
      header.writeUInt16BE(0, 2);
      header.writeUInt16BE(response.length + 1, 4);
      header.writeUInt8(unitId, 6);
      
      socket.write(Buffer.concat([header, response]));
    }
  }

  handleReadCoils(data) {
    const startAddress = data.readUInt16BE(8);
    const quantity = data.readUInt16BE(10);
    
    const values = [];
    for (let i = 0; i < quantity; i++) {
      values.push(this.coils.get(startAddress + i) || false);
    }
    
    const byteCount = Math.ceil(quantity / 8);
    const response = Buffer.alloc(2 + byteCount);
    response.writeUInt8(1, 0);
    response.writeUInt8(byteCount, 1);
    
    for (let i = 0; i < quantity; i++) {
      if (values[i]) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        response[2 + byteIndex] |= (1 << bitIndex);
      }
    }
    
    return response;
  }

  handleReadDiscreteInputs(data) {
    const startAddress = data.readUInt16BE(8);
    const quantity = data.readUInt16BE(10);
    
    const values = [];
    for (let i = 0; i < quantity; i++) {
      values.push(this.discreteInputs.get(startAddress + i) || false);
    }
    
    const byteCount = Math.ceil(quantity / 8);
    const response = Buffer.alloc(2 + byteCount);
    response.writeUInt8(2, 0);
    response.writeUInt8(byteCount, 1);
    
    for (let i = 0; i < quantity; i++) {
      if (values[i]) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        response[2 + byteIndex] |= (1 << bitIndex);
      }
    }
    
    return response;
  }

  handleReadHoldingRegisters(data) {
    const startAddress = data.readUInt16BE(8);
    const quantity = data.readUInt16BE(10);
    
    const response = Buffer.alloc(2 + quantity * 2);
    response.writeUInt8(3, 0);
    response.writeUInt8(quantity * 2, 1);
    
    for (let i = 0; i < quantity; i++) {
      const value = this.holdingRegisters.get(startAddress + i) || 0;
      response.writeUInt16BE(value, 2 + i * 2);
    }
    
    return response;
  }

  handleReadInputRegisters(data) {
    const startAddress = data.readUInt16BE(8);
    const quantity = data.readUInt16BE(10);
    
    const response = Buffer.alloc(2 + quantity * 2);
    response.writeUInt8(4, 0);
    response.writeUInt8(quantity * 2, 1);
    
    for (let i = 0; i < quantity; i++) {
      const value = this.inputRegisters.get(startAddress + i) || 0;
      response.writeUInt16BE(value, 2 + i * 2);
    }
    
    return response;
  }

  handleWriteSingleCoil(data) {
    const address = data.readUInt16BE(8);
    const value = data.readUInt16BE(10) === 0xFF00;
    
    this.coils.set(address, value);
    this.notifyDataChange(REGISTER_TYPES.COIL, address, value ? 1 : 0);
    
    const response = Buffer.alloc(5);
    response.writeUInt8(5, 0);
    response.writeUInt16BE(address, 1);
    response.writeUInt16BE(value ? 0xFF00 : 0x0000, 3);
    
    return response;
  }

  handleWriteSingleRegister(data) {
    const address = data.readUInt16BE(8);
    const value = data.readUInt16BE(10);
    
    this.holdingRegisters.set(address, value);
    this.notifyDataChange(REGISTER_TYPES.HOLDING_REGISTER, address, value);
    
    const response = Buffer.alloc(5);
    response.writeUInt8(6, 0);
    response.writeUInt16BE(address, 1);
    response.writeUInt16BE(value, 3);
    
    return response;
  }

  handleWriteMultipleCoils(data) {
    const startAddress = data.readUInt16BE(8);
    const quantity = data.readUInt16BE(10);
    const byteCount = data.readUInt8(12);
    
    for (let i = 0; i < quantity; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      const value = (data[13 + byteIndex] & (1 << bitIndex)) !== 0;
      this.coils.set(startAddress + i, value);
      this.notifyDataChange(REGISTER_TYPES.COIL, startAddress + i, value ? 1 : 0);
    }
    
    const response = Buffer.alloc(5);
    response.writeUInt8(15, 0);
    response.writeUInt16BE(startAddress, 1);
    response.writeUInt16BE(quantity, 3);
    
    return response;
  }

  handleWriteMultipleRegisters(data) {
    const startAddress = data.readUInt16BE(8);
    const quantity = data.readUInt16BE(10);
    const byteCount = data.readUInt8(12);
    
    for (let i = 0; i < quantity; i++) {
      const value = data.readUInt16BE(13 + i * 2);
      this.holdingRegisters.set(startAddress + i, value);
      this.notifyDataChange(REGISTER_TYPES.HOLDING_REGISTER, startAddress + i, value);
    }
    
    const response = Buffer.alloc(5);
    response.writeUInt8(16, 0);
    response.writeUInt16BE(startAddress, 1);
    response.writeUInt16BE(quantity, 3);
    
    return response;
  }

  buildExceptionResponse(functionCode, exceptionCode) {
    const response = Buffer.alloc(2);
    response.writeUInt8(functionCode + 0x80, 0);
    response.writeUInt8(exceptionCode, 1);
    return response;
  }

  setCoil(address, value) {
    this.coils.set(address, value);
    this.notifyDataChange(REGISTER_TYPES.COIL, address, value ? 1 : 0);
  }

  setDiscreteInput(address, value) {
    this.discreteInputs.set(address, value);
    this.notifyDataChange(REGISTER_TYPES.DISCRETE_INPUT, address, value ? 1 : 0);
  }

  setHoldingRegister(address, value) {
    this.holdingRegisters.set(address, value);
    this.notifyDataChange(REGISTER_TYPES.HOLDING_REGISTER, address, value);
  }

  setInputRegister(address, value) {
    this.inputRegisters.set(address, value);
    this.notifyDataChange(REGISTER_TYPES.INPUT_REGISTER, address, value);
  }

  getCoil(address) {
    return this.coils.get(address) || false;
  }

  getDiscreteInput(address) {
    return this.discreteInputs.get(address) || false;
  }

  getHoldingRegister(address) {
    return this.holdingRegisters.get(address) || 0;
  }

  getInputRegister(address) {
    return this.inputRegisters.get(address) || 0;
  }

  getAllRegisters() {
    return {
      coils: Object.fromEntries(this.coils),
      discreteInputs: Object.fromEntries(this.discreteInputs),
      holdingRegisters: Object.fromEntries(this.holdingRegisters),
      inputRegisters: Object.fromEntries(this.inputRegisters)
    };
  }

  notifyDataChange(registerType, address, value) {
    if (this.onDataCallback) {
      this.onDataCallback({
        registerType,
        address,
        value,
        timestamp: new Date()
      });
    }
  }

  onData(callback) {
    this.onDataCallback = callback;
  }
}

module.exports = ModbusSlave;
