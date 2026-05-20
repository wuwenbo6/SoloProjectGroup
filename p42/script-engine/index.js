const ivm = require('isolated-vm');

class ScriptEngine {
  constructor(slave) {
    this.slave = slave;
    this.scripts = new Map();
    this.isolates = new Map();
    this.intervals = new Map();
    this.logs = [];
    this.timeoutCallbacks = new Set();
    
    this.defaultOptions = {
      cpuTimeLimit: 500,
      memoryLimit: 16,
      timeout: 1000
    };
  }

  createSandboxAPI(isolateId) {
    const that = this;
    
    return {
      setCoil: new ivm.Reference(function(address, value) {
        that.slave.setCoil(address, value);
      }),
      getCoil: new ivm.Reference(function(address) {
        return that.slave.getCoil(address);
      }),
      setDiscreteInput: new ivm.Reference(function(address, value) {
        that.slave.setDiscreteInput(address, value);
      }),
      getDiscreteInput: new ivm.Reference(function(address) {
        return that.slave.getDiscreteInput(address);
      }),
      setHoldingRegister: new ivm.Reference(function(address, value) {
        that.slave.setHoldingRegister(address, value);
      }),
      getHoldingRegister: new ivm.Reference(function(address) {
        return that.slave.getHoldingRegister(address);
      }),
      setInputRegister: new ivm.Reference(function(address, value) {
        that.slave.setInputRegister(address, value);
      }),
      getInputRegister: new ivm.Reference(function(address) {
        return that.slave.getInputRegister(address);
      }),
      log: new ivm.Reference(function(message) {
        that.logs.push({
          timestamp: new Date(),
          message: String(message)
        });
        if (that.logs.length > 1000) {
          that.logs.shift();
        }
      }),
      console: {
        log: new ivm.Reference(function(message) {
          that.logs.push({
            timestamp: new Date(),
            message: String(message)
          });
          if (that.logs.length > 1000) {
            that.logs.shift();
          }
        })
      },
      setTimeout: new ivm.Reference(function(callback, delay) {
        const id = setTimeout(() => {
          try {
            callback.apply(undefined, [], { timeout: 100 });
          } catch (e) {}
        }, delay);
        that.timeoutCallbacks.add(id);
        return id;
      }),
      clearTimeout: new ivm.Reference(function(id) {
        clearTimeout(id);
        that.timeoutCallbacks.delete(id);
      }),
      Date: {
        now: new ivm.Reference(function() { return Date.now(); }),
        parse: new ivm.Reference(function(str) { return Date.parse(str); }),
        UTC: new ivm.Reference(function(...args) { return Date.UTC(...args); })
      },
      Math: {
        abs: new ivm.Reference(function(x) { return Math.abs(x); }),
        ceil: new ivm.Reference(function(x) { return Math.ceil(x); }),
        floor: new ivm.Reference(function(x) { return Math.floor(x); }),
        max: new ivm.Reference(function(...args) { return Math.max(...args); }),
        min: new ivm.Reference(function(...args) { return Math.min(...args); }),
        round: new ivm.Reference(function(x) { return Math.round(x); }),
        sqrt: new ivm.Reference(function(x) { return Math.sqrt(x); }),
        random: new ivm.Reference(function() { return Math.random(); })
      },
      Number: {
        parseInt: new ivm.Reference(function(str, radix) { return parseInt(str, radix); }),
        parseFloat: new ivm.Reference(function(str) { return parseFloat(str); }),
        isNaN: new ivm.Reference(function(val) { return isNaN(val); }),
        isFinite: new ivm.Reference(function(val) { return isFinite(val); })
      },
      String: {
        fromCharCode: new ivm.Reference(function(...codes) { return String.fromCharCode(...codes); })
      },
      Boolean: {
        true: true,
        false: false
      },
      JSON: {
        stringify: new ivm.Reference(function(obj, replacer, space) {
          return JSON.stringify(obj, replacer, space);
        }),
        parse: new ivm.Reference(function(str) {
          return JSON.parse(str);
        })
      }
    };
  }

  wrapUserCode(code) {
    return `
      (function() {
        const api = _$api;
        
        const setCoil = (addr, val) => api.setCoil.applySync(undefined, [addr, val]);
        const getCoil = (addr) => api.getCoil.applySync(undefined, [addr]);
        const setDiscreteInput = (addr, val) => api.setDiscreteInput.applySync(undefined, [addr, val]);
        const getDiscreteInput = (addr) => api.getDiscreteInput.applySync(undefined, [addr]);
        const setHoldingRegister = (addr, val) => api.setHoldingRegister.applySync(undefined, [addr, val]);
        const getHoldingRegister = (addr) => api.getHoldingRegister.applySync(undefined, [addr]);
        const setInputRegister = (addr, val) => api.setInputRegister.applySync(undefined, [addr, val]);
        const getInputRegister = (addr) => api.getInputRegister.applySync(undefined, [addr]);
        const log = (msg) => api.log.applySync(undefined, [msg]);
        const console = {
          log: (msg) => api.console.log.applySync(undefined, [msg])
        };
        
        const setTimeout = (cb, delay) => api.setTimeout.applySync(undefined, [new ivm.Reference(cb), delay]);
        const clearTimeout = (id) => api.clearTimeout.applySync(undefined, [id]);
        
        const Date = {
          now: () => api.Date.now.applySync(undefined, []),
          parse: (str) => api.Date.parse.applySync(undefined, [str]),
          UTC: (...args) => api.Date.UTC.applySync(undefined, args)
        };
        
        const Math = {
          abs: (x) => api.Math.abs.applySync(undefined, [x]),
          ceil: (x) => api.Math.ceil.applySync(undefined, [x]),
          floor: (x) => api.Math.floor.applySync(undefined, [x]),
          max: (...args) => api.Math.max.applySync(undefined, args),
          min: (...args) => api.Math.min.applySync(undefined, args),
          round: (x) => api.Math.round.applySync(undefined, [x]),
          sqrt: (x) => api.Math.sqrt.applySync(undefined, [x]),
          random: () => api.Math.random.applySync(undefined, [])
        };
        
        const Number = {
          parseInt: (str, radix) => api.Number.parseInt.applySync(undefined, [str, radix]),
          parseFloat: (str) => api.Number.parseFloat.applySync(undefined, [str]),
          isNaN: (val) => api.Number.isNaN.applySync(undefined, [val]),
          isFinite: (val) => api.Number.isFinite.applySync(undefined, [val])
        };
        
        const JSON = {
          stringify: (obj, replacer, space) => api.JSON.stringify.applySync(undefined, [obj, replacer, space]),
          parse: (str) => api.JSON.parse.applySync(undefined, [str])
        };
        
        ${code}
      })
    `;
  }

  addScript(id, code, interval = 1000, options = {}) {
    if (this.scripts.has(id)) {
      this.removeScript(id);
    }

    const cpuTimeLimit = options.cpuTimeLimit || this.defaultOptions.cpuTimeLimit;
    const memoryLimit = options.memoryLimit || this.defaultOptions.memoryLimit;
    const timeout = options.timeout || this.defaultOptions.timeout;

    const isolate = new ivm.Isolate({
      memoryLimit: memoryLimit,
      extendedInfo: true
    });

    const context = isolate.createContextSync();
    const global = context.global;

    global.setSync('ivm', ivm);
    global.setSync('_$api', this.createSandboxAPI(id));

    const wrappedCode = this.wrapUserCode(code);

    let script;
    try {
      script = isolate.compileScriptSync(wrappedCode);
    } catch (error) {
      isolate.dispose();
      throw new Error(`Script compilation error: ${error.message}`);
    }

    let wrappedFunction;
    try {
      const result = script.runSync(context, {
        timeout: cpuTimeLimit,
        copy: true
      });
      wrappedFunction = result;
    } catch (error) {
      isolate.dispose();
      throw new Error(`Script initialization error: ${error.message}`);
    }

    this.scripts.set(id, {
      code,
      isolate,
      context,
      script,
      wrappedFunction,
      interval,
      cpuTimeLimit,
      timeout
    });

    return id;
  }

  executeScript(id) {
    const script = this.scripts.get(id);
    if (!script) {
      throw new Error(`Script ${id} not found`);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Script ${id} execution timed out after ${script.timeout}ms`));
      }, script.timeout);

      try {
        const result = script.wrappedFunction.applySync(undefined, [], {
          timeout: script.cpuTimeLimit,
          copy: true
        });
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(new Error(`Script execution error: ${error.message}`));
      }
    });
  }

  startScript(id) {
    const script = this.scripts.get(id);
    if (!script) {
      throw new Error(`Script ${id} not found`);
    }

    if (this.intervals.has(id)) {
      this.stopScript(id);
    }

    this.executeScript(id).catch(error => {
      console.error(`Initial script execution error: ${error.message}`);
    });

    const intervalId = setInterval(async () => {
      try {
        await this.executeScript(id);
      } catch (error) {
        console.error(`Script execution error: ${error.message}`);
      }
    }, script.interval);

    this.intervals.set(id, intervalId);
    return true;
  }

  stopScript(id) {
    const intervalId = this.intervals.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(id);
    }
    return true;
  }

  removeScript(id) {
    this.stopScript(id);
    
    const script = this.scripts.get(id);
    if (script) {
      try {
        script.isolate.dispose();
      } catch (e) {}
      this.scripts.delete(id);
    }
    
    return true;
  }

  async executeOnce(code, options = {}) {
    const cpuTimeLimit = options.cpuTimeLimit || this.defaultOptions.cpuTimeLimit;
    const memoryLimit = options.memoryLimit || this.defaultOptions.memoryLimit;
    const timeout = options.timeout || this.defaultOptions.timeout;

    const isolate = new ivm.Isolate({
      memoryLimit: memoryLimit,
      extendedInfo: true
    });

    try {
      const context = isolate.createContextSync();
      const global = context.global;

      global.setSync('ivm', ivm);
      global.setSync('_$api', this.createSandboxAPI('_temp'));

      const wrappedCode = this.wrapUserCode(code);
      const script = isolate.compileScriptSync(wrappedCode);
      
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          isolate.dispose();
          reject(new Error('Script execution timed out'));
        }, timeout);

        try {
          const fn = script.runSync(context, {
            timeout: cpuTimeLimit,
            copy: true
          });
          
          const result = fn.applySync(undefined, [], {
            timeout: cpuTimeLimit,
            copy: true
          });
          
          clearTimeout(timeoutId);
          isolate.dispose();
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          isolate.dispose();
          reject(error);
        }
      });
    } catch (error) {
      isolate.dispose();
      throw error;
    }
  }

  getScripts() {
    const result = [];
    this.scripts.forEach((script, id) => {
      result.push({
        id,
        code: script.code,
        interval: script.interval,
        running: this.intervals.has(id),
        cpuTimeLimit: script.cpuTimeLimit
      });
    });
    return result;
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }

  stopAll() {
    this.intervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.intervals.clear();

    this.timeoutCallbacks.forEach(id => clearTimeout(id));
    this.timeoutCallbacks.clear();

    this.scripts.forEach((script) => {
      try {
        script.isolate.dispose();
      } catch (e) {}
    });
    this.scripts.clear();
  }
}

module.exports = ScriptEngine;
