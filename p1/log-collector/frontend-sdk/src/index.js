(function(global, factory) {
  'use strict';
  
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    global.LogSDK = factory();
  }

})(typeof window !== 'undefined' ? window : this, function() {
  'use strict';

  function LogSDK(options) {
    if (!(this instanceof LogSDK)) {
      return new LogSDK(options);
    }
    
    this.options = options || {};
    this.initialized = false;
    
    this.collector = null;
    this.reporter = null;
    this.storage = null;
  }

  LogSDK.prototype.init = function(options) {
    if (this.initialized) {
      return this;
    }
    
    options = options || this.options;
    
    if (!options.appId) {
      console.warn('LogSDK: appId is required');
      return this;
    }
    
    this.collector = new LogCollector({
      appId: options.appId,
      userId: options.userId,
      level: options.level || 'INFO'
    });
    
    this.reporter = new LogReporter({
      endpoint: options.endpoint || '',
      batchSize: options.batchSize || 20,
      flushInterval: options.flushInterval || 5000,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 10000,
      sampleRate: options.sampleRate || 1.0,
      userSampleRules: options.userSampleRules || [],
      enableCompression: options.enableCompression || false
    });
    
    if (options.pako) {
      this.reporter.setPako(options.pako);
    }
    
    this.collector.setReporter(this.reporter);
    
    if (typeof indexedDB !== 'undefined') {
      this.storage = new LogStorage();
      this.reporter.setStorage(this.storage);
    }
    
    if (options.captureGlobalErrors !== false) {
      this.collector.captureGlobalErrors();
    }
    
    if (options.captureResourceErrors !== false) {
      this.collector.captureResourceErrors();
    }
    
    this.initialized = true;
    
    return this;
  };

  LogSDK.prototype.debug = function(message, extra) {
    if (this.collector) {
      this.collector.debug(message, extra);
    }
  };

  LogSDK.prototype.info = function(message, extra) {
    if (this.collector) {
      this.collector.info(message, extra);
    }
  };

  LogSDK.prototype.warn = function(message, extra) {
    if (this.collector) {
      this.collector.warn(message, extra);
    }
  };

  LogSDK.prototype.error = function(message, extra) {
    if (this.collector) {
      this.collector.error(message, extra);
    }
  };

  LogSDK.prototype.fatal = function(message, extra) {
    if (this.collector) {
      this.collector.fatal(message, extra);
    }
  };

  LogSDK.prototype.log = function(level, message, extra) {
    if (this.collector) {
      this.collector.log(level, message, extra);
    }
  };

  LogSDK.prototype.setUserId = function(userId) {
    if (this.collector) {
      this.collector.setUserId(userId);
    }
  };

  LogSDK.prototype.setLevel = function(level) {
    if (this.collector) {
      this.collector.setLevel(level);
    }
  };

  LogSDK.prototype.flush = function() {
    if (this.reporter) {
      this.reporter.flush();
    }
  };

  LogSDK.prototype.setSampleRate = function(sampleRate) {
    if (this.reporter) {
      this.reporter.sampleRate = sampleRate;
    }
  };

  LogSDK.prototype.setUserSampleRules = function(rules) {
    if (this.reporter) {
      this.reporter.userSampleRules = rules || [];
    }
  };

  LogSDK.prototype.enableCompression = function(pako) {
    if (this.reporter) {
      this.reporter.enableCompression = true;
      if (pako) {
        this.reporter.setPako(pako);
      }
    }
  };

  LogSDK.prototype.destroy = function() {
    if (this.reporter) {
      this.reporter.destroy();
    }
    this.initialized = false;
  };

  var instance = null;
  
  LogSDK.init = function(options) {
    if (!instance) {
      instance = new LogSDK();
    }
    return instance.init(options);
  };

  LogSDK.getInstance = function() {
    return instance;
  };

  LogSDK.Levels = LogLevels;

  return LogSDK;
});
