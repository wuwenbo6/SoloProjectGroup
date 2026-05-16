(function(global) {
  'use strict';

  var LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
  };

  function Collector(options) {
    this.options = options || {};
    this.level = LOG_LEVELS[options.level || 'INFO'];
    this.appId = options.appId || '';
    this.userId = options.userId || '';
    this.reporter = null;
    this.listeners = [];
  }

  Collector.prototype.setReporter = function(reporter) {
    this.reporter = reporter;
  };

  Collector.prototype.setUserId = function(userId) {
    this.userId = userId;
  };

  Collector.prototype.setLevel = function(level) {
    this.level = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  };

  Collector.prototype.log = function(level, message, extra) {
    var levelNum = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    if (levelNum < this.level) {
      return;
    }
    
    var logData = {
      app_id: this.appId,
      user_id: this.userId,
      level: level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      timestamp: Date.now(),
      extra: extra || {},
      url: global.location ? global.location.href : '',
      user_agent: global.navigator ? global.navigator.userAgent : ''
    };

    this.emit('log', logData);
    
    if (this.reporter) {
      this.reporter.addLog(logData);
    }
  };

  Collector.prototype.debug = function(message, extra) {
    this.log('DEBUG', message, extra);
  };

  Collector.prototype.info = function(message, extra) {
    this.log('INFO', message, extra);
  };

  Collector.prototype.warn = function(message, extra) {
    this.log('WARN', message, extra);
  };

  Collector.prototype.error = function(message, extra) {
    this.log('ERROR', message, extra);
  };

  Collector.prototype.fatal = function(message, extra) {
    this.log('FATAL', message, extra);
  };

  Collector.prototype.captureGlobalErrors = function() {
    var self = this;
    
    if (global.addEventListener) {
      global.addEventListener('error', function(e) {
        self.error('Global Error', {
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          stack: e.error && e.error.stack
        });
      }, true);

      global.addEventListener('unhandledrejection', function(e) {
        self.error('Unhandled Promise Rejection', {
          reason: e.reason ? (typeof e.reason === 'string' ? e.reason : JSON.stringify(e.reason)) : '',
          stack: e.reason && e.reason.stack
        });
      }, true);
    } else if (global.attachEvent) {
      global.attachEvent('onerror', function(message, filename, lineno, colno, error) {
        self.error('Global Error', {
          message: message,
          filename: filename,
          lineno: lineno,
          colno: colno,
          stack: error && error.stack
        });
        return false;
      });
    }
  };

  Collector.prototype.captureResourceErrors = function() {
    var self = this;
    
    if (global.addEventListener) {
      global.addEventListener('error', function(e) {
        if (e.target !== global) {
          var target = e.target;
          var tagName = target.tagName || '';
          var src = target.src || target.href || '';
          if (tagName && (tagName === 'SCRIPT' || tagName === 'LINK' || tagName === 'IMG')) {
            self.error('Resource Load Error', {
              tag_name: tagName,
              src: src,
              type: 'resource_load'
            });
          }
        }
      }, true);
    }
  };

  Collector.prototype.on = function(event, callback) {
    this.listeners.push({ event: event, callback: callback });
  };

  Collector.prototype.emit = function(event, data) {
    for (var i = 0; i < this.listeners.length; i++) {
      if (this.listeners[i].event === event) {
        try {
          this.listeners[i].callback(data);
        } catch (e) {}
      }
    }
  };

  global.LogCollector = Collector;
  global.LogLevels = LOG_LEVELS;

})(typeof window !== 'undefined' ? window : this);
