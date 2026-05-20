const net = require('net');
const Modbus = require('modbus-serial');

class FuzzingEngine {
  constructor() {
    this.testCases = [];
    this.results = [];
    this.isRunning = false;
    this.currentConfig = null;
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      errors: 0
    };
    this.onProgressCallback = null;
    this.onResultCallback = null;
  }

  random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  randomBuffer(length) {
    const buffer = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
      buffer[i] = this.random(0, 255);
    }
    return buffer;
  }

  buildModbusTCPHeader(transactionId, length, unitId) {
    const header = Buffer.alloc(7);
    header.writeUInt16BE(transactionId, 0);
    header.writeUInt16BE(0, 2);
    header.writeUInt16BE(length, 4);
    header.writeUInt8(unitId, 6);
    return header;
  }

  generateNormalTestCases(config) {
    const cases = [];
    const { minAddress, maxAddress, minValue, maxValue } = config;

    for (let i = 0; i < config.normalCount || 10; i++) {
      const address = this.random(minAddress, maxAddress);
      const quantity = this.random(1, 100);

      cases.push({
        type: 'normal',
        name: `读取线圈 0x${address.toString(16)}`,
        functionCode: 1,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, 6, uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(1, 0);
          body.writeUInt16BE(address, 1);
          body.writeUInt16BE(quantity, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'response'
      });

      cases.push({
        type: 'normal',
        name: `读取离散输入 0x${address.toString(16)}`,
        functionCode: 2,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, 6, uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(2, 0);
          body.writeUInt16BE(address, 1);
          body.writeUInt16BE(quantity, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'response'
      });

      cases.push({
        type: 'normal',
        name: `读取保持寄存器 0x${address.toString(16)}`,
        functionCode: 3,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, 6, uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(3, 0);
          body.writeUInt16BE(address, 1);
          body.writeUInt16BE(quantity, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'response'
      });

      cases.push({
        type: 'normal',
        name: `读取输入寄存器 0x${address.toString(16)}`,
        functionCode: 4,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, 6, uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(4, 0);
          body.writeUInt16BE(address, 1);
          body.writeUInt16BE(quantity, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'response'
      });

      const writeValue = this.random(minValue, maxValue);
      cases.push({
        type: 'normal',
        name: `写入单线圈 0x${address.toString(16)} = ${writeValue}`,
        functionCode: 5,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, 6, uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(5, 0);
          body.writeUInt16BE(address, 1);
          body.writeUInt16BE(writeValue > 0 ? 0xFF00 : 0x0000, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'response'
      });

      cases.push({
        type: 'normal',
        name: `写入单寄存器 0x${address.toString(16)} = ${writeValue}`,
        functionCode: 6,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, 6, uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(6, 0);
          body.writeUInt16BE(address, 1);
          body.writeUInt16BE(writeValue, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'response'
      });
    }

    return cases;
  }

  generateMalformedTestCases(config) {
    const cases = [];

    for (let i = 0; i < config.malformedCount || 20; i++) {
      cases.push({
        type: 'malformed',
        name: '报文长度过短',
        functionCode: -1,
        build: (tid, uid) => {
          const length = this.random(1, 5);
          return this.randomBuffer(length);
        },
        expect: 'timeout_or_error'
      });

      cases.push({
        type: 'malformed',
        name: '报文长度过长',
        functionCode: -1,
        build: (tid, uid) => {
          const length = this.random(300, 1000);
          return this.randomBuffer(length);
        },
        expect: 'timeout_or_error'
      });

      cases.push({
        type: 'malformed',
        name: 'MBAP长度字段错误',
        functionCode: -1,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, this.random(100, 500), uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(3, 0);
          body.writeUInt16BE(0, 1);
          body.writeUInt16BE(10, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'timeout_or_error'
      });

      cases.push({
        type: 'malformed',
        name: '协议标识符错误',
        functionCode: -1,
        build: (tid, uid) => {
          const header = Buffer.alloc(7);
          header.writeUInt16BE(tid, 0);
          header.writeUInt16BE(this.random(1, 100), 2);
          header.writeUInt16BE(6, 4);
          header.writeUInt8(uid, 6);
          const body = Buffer.alloc(4);
          body.writeUInt8(3, 0);
          body.writeUInt16BE(0, 1);
          body.writeUInt16BE(10, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'timeout_or_error'
      });
    }

    return cases;
  }

  generateInvalidFunctionTestCases(config) {
    const cases = [];

    const invalidFunctionCodes = [
      0, 7, 8, 9, 10, 11, 12, 13, 14,
      18, 19, 20, 21, 127, 128, 200, 255
    ];

    for (const fc of invalidFunctionCodes) {
      cases.push({
        type: 'invalid_function',
        name: `不支持功能码 0x${fc.toString(16)}`,
        functionCode: fc,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, 6, uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(fc, 0);
          body.writeUInt16BE(0, 1);
          body.writeUInt16BE(10, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'exception_0x01'
      });
    }

    for (let i = 0; i < (config.invalidFunctionCount || 10); i++) {
      const fc = this.random(100, 250);
      cases.push({
        type: 'invalid_function',
        name: `随机功能码 0x${fc.toString(16)}`,
        functionCode: fc,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, 6, uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(fc, 0);
          body.writeUInt16BE(0, 1);
          body.writeUInt16BE(10, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'exception'
      });
    }

    return cases;
  }

  generateBoundaryTestCases(config) {
    const cases = [];
    const { minAddress, maxAddress } = config;

    const boundaryValues = [
      minAddress - 100,
      minAddress - 1,
      maxAddress + 1,
      maxAddress + 100,
      0xFFFF,
      0x0000
    ];

    for (const addr of boundaryValues) {
      cases.push({
        type: 'boundary',
        name: `边界地址 0x${addr.toString(16)}`,
        functionCode: 3,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, 6, uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(3, 0);
          body.writeUInt16BE(addr, 1);
          body.writeUInt16BE(10, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'exception_or_response'
      });
    }

    const quantities = [0, 126, 127, 200, 1000, 0xFFFF];

    for (const qty of quantities) {
      cases.push({
        type: 'boundary',
        name: `边界数量 ${qty}`,
        functionCode: 3,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, 6, uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(3, 0);
          body.writeUInt16BE(0, 1);
          body.writeUInt16BE(qty, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'exception_or_response'
      });
    }

    return cases;
  }

  generateRandomValueTestCases(config) {
    const cases = [];
    const address = this.random(0, 100);

    const edgeValues = [
      0x0000, 0x0001, 0x7FFF, 0x8000, 0xFFFF, 0xAAAA, 0x5555];

    for (const value of edgeValues) {
      cases.push({
        type: 'edge_value',
        name: `边界值写入 0x${value.toString(16)}`,
        functionCode: 6,
        build: (tid, uid) => {
          const header = this.buildModbusTCPHeader(tid, 6, uid);
          const body = Buffer.alloc(4);
          body.writeUInt8(6, 0);
          body.writeUInt16BE(address, 1);
          body.writeUInt16BE(value, 3);
          return Buffer.concat([header, body]);
        },
        expect: 'response'
      });
    }

    return cases;
  }

  async checkSlaveHealth(host, port, timeout = 2000) {
    return new Promise((resolve) => {
      const client = new Modbus();
      let timer = setTimeout(() => {
        client.close(() => {});
        resolve(false);
      }, timeout);

      client.connectTCP(host, { port }, (err) => {
        if (err) {
          clearTimeout(timer);
          resolve(false);
        } else {
          client.readHoldingRegisters(0, 1, (readErr) => {
            clearTimeout(timer);
            client.close(() => {});
            resolve(!readErr);
          });
        }
      });
    });
  }

  async sendTestCase(host, port, unitId, testCase, timeout) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const transactionId = this.random(1, 65535);
      const buffer = testCase.build(transactionId, unitId);

      let responded = false;
      let responseBuffer = Buffer.alloc(0);

      const timer = setTimeout(() => {
        if (!responded) {
          socket.destroy();
          resolve({
            success: false,
            error: 'timeout',
            response: null
          });
        }
      }, timeout);

      socket.on('connect', () => {
        socket.write(buffer);
      });

      socket.on('data', (data) => {
        responseBuffer = Buffer.concat([responseBuffer, data]);
        responded = true;
        clearTimeout(timer);
        socket.destroy();

        const isException = responseBuffer.length >= 9 && 
                          (responseBuffer[7] & 0x80) !== 0;

        resolve({
          success: true,
          error: null,
          exception: isException,
          exceptionCode: isException ? responseBuffer[8] : null,
          responseLength: responseBuffer.length,
          response: responseBuffer
        });
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        responded = true;
        socket.destroy();
        resolve({
          success: false,
          error: err.message,
          response: null
        });
      });

      socket.connect(port, host);
    });
  }

  async runTestCase(host, port, unitId, testCase, index, total) {
    const startTime = Date.now();
    const result = await this.sendTestCase(host, port, unitId, testCase, 2000);
    const duration = Date.now() - startTime;

    const testResult = {
      index,
      total,
      name: testCase.name,
      type: testCase.type,
      functionCode: testCase.functionCode,
      expect: testCase.expect,
      actual: result,
      duration,
      timestamp: new Date().toISOString()
    };

    if (!result.success && result.error === 'timeout') {
      testResult.status = 'warning';
      testResult.message = '请求超时';
    } else if (result.exception) {
      testResult.status = 'normal';
      testResult.message = `返回异常码 0x${result.exceptionCode.toString(16)}`;
    } else if (result.success) {
      testResult.status = 'success';
      testResult.message = '正常响应';
    } else {
      testResult.status = 'error';
      testResult.message = `连接错误: ' + result.error;
    }

    return testResult;
  }

  async start(config) {
    this.isRunning = true;
    this.currentConfig = config;
    this.results = [];
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      errors: 0,
      warnings: 0
    };

    const host = config.host || 'localhost';
    const port = config.port || 502;
    const unitId = config.unitId || 1;

    this.testCases = [];

    if (config.includeNormal) {
      this.testCases.push(...this.generateNormalTestCases(config));
    }
    if (config.includeMalformed) {
      this.testCases.push(...this.generateMalformedTestCases(config));
    }
    if (config.includeInvalidFunction) {
      this.testCases.push(...this.generateInvalidFunctionTestCases(config));
    }
    if (config.includeBoundary) {
      this.testCases.push(...this.generateBoundaryTestCases(config));
    }
    if (config.includeEdgeValues) {
      this.testCases.push(...this.generateRandomValueTestCases(config));
    }

    if (config.randomOrder) {
      for (let i = this.testCases.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.testCases[i], this.testCases[j]] = [this.testCases[j], this.testCases[i]];
      }
    }

    this.stats.total = this.testCases.length;

    for (let i = 0; i < this.testCases.length && this.isRunning; i++) {
      const isHealthy = await this.checkSlaveHealth(host, port, 1000);
      
      if (!isHealthy) {
        const crashResult = {
          index: i,
          total: this.testCases.length,
          name: '从站健康检查',
          type: 'health_check',
          status: 'crash',
          message: '从站无响应，可能已崩溃',
          timestamp: new Date().toISOString()
        };
        this.results.push(crashResult);
        this.stats.errors++;
        
        if (this.onResultCallback) {
          this.onResultCallback(crashResult);
        }
        break;
      }

      const result = await this.runTestCase(
        host, port, unitId,
        this.testCases[i],
        i + 1,
        this.testCases.length
      );

      this.results.push(result);

      if (result.status === 'success') this.stats.success++;
      else if (result.status === 'error') this.stats.errors++;
      else if (result.status === 'warning') this.stats.warnings++;
      else this.stats.failed++;

      if (this.onResultCallback) {
        this.onResultCallback(result);
      }

      if (this.onProgressCallback) {
        this.onProgressCallback({
          current: i + 1,
          total: this.testCases.length,
          percent: Math.round(((i + 1) / this.testCases.length) * 100),
          stats: this.stats
        });
      }

      await new Promise(resolve => setTimeout(resolve, config.delay || 100));
    }

    this.isRunning = false;

    return {
      results: this.results,
      stats: this.stats
    };
  }

  stop() {
    this.isRunning = false;
  }

  getResults() {
    return {
      results: this.results,
      stats: this.stats,
      config: this.currentConfig
    };
  }

  onProgress(callback) {
    this.onProgressCallback = callback;
  }

  onResult(callback) {
    this.onResultCallback = callback;
  }
}

module.exports = FuzzingEngine;
