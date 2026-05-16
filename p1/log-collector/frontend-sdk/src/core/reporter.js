(function(global) {
  'use strict';

  function Reporter(options) {
    this.options = options || {};
    this.endpoint = options.endpoint || '';
    this.batchSize = options.batchSize || 20;
    this.flushInterval = options.flushInterval || 5000;
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 10000;
    this.sampleRate = options.sampleRate || 1.0;
    this.userSampleRules = options.userSampleRules || [];
    this.enableCompression = options.enableCompression || false;
    this.queue = [];
    this.timer = null;
    this.storage = null;
    this.isFlushing = false;
    this.pako = global.pako || null;
  }

  Reporter.prototype.setStorage = function(storage) {
    this.storage = storage;
    this.startFlushTimer();
    this.flushFromStorage();
  };

  Reporter.prototype.setPako = function(pako) {
    this.pako = pako;
  };

  Reporter.prototype.hashUserId = function(userId) {
    if (!userId) return 0;
    var hash = 0;
    for (var i = 0; i < userId.length; i++) {
      var char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 1000 / 1000;
  };

  Reporter.prototype.shouldSample = function(userId, level) {
    if (level === 'ERROR' || level === 'FATAL') {
      return true;
    }

    var userHash = this.hashUserId(userId);
    
    for (var i = 0; i < this.userSampleRules.length; i++) {
      var rule = this.userSampleRules[i];
      if (rule.userIds && rule.userIds.indexOf(userId) !== -1) {
        return Math.random() < rule.sampleRate;
      }
      if (rule.userPrefix && userId && userId.indexOf(rule.userPrefix) === 0) {
        return Math.random() < rule.sampleRate;
      }
    }

    return Math.random() < this.sampleRate;
  };

  Reporter.prototype.addLog = function(log) {
    var self = this;
    
    if (!this.shouldSample(log.user_id, log.level)) {
      return;
    }
    
    if (this.storage) {
      this.storage.add(log, function(err) {
        if (!err) {
          self.tryFlush();
        }
      });
    } else {
      this.queue.push(log);
      this.tryFlush();
    }
  };

  Reporter.prototype.tryFlush = function() {
    var self = this;
    if (this.storage) {
      this.storage.count(function(err, count) {
        if (!err && count >= self.batchSize) {
          self.flush();
        }
      });
    } else {
      if (this.queue.length >= this.batchSize) {
        this.flush();
      }
    }
  };

  Reporter.prototype.startFlushTimer = function() {
    var self = this;
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(function() {
      self.flush();
    }, this.flushInterval);
  };

  Reporter.prototype.flushFromStorage = function() {
    var self = this;
    if (this.storage) {
      setTimeout(function() {
        self.flush();
      }, 1000);
    }
  };

  Reporter.prototype.flush = function() {
    var self = this;
    if (this.isFlushing || !this.endpoint) {
      return;
    }
    
    this.isFlushing = true;
    
    var logsToSend = [];
    var logIds = [];
    
    if (this.storage) {
      this.storage.getBatch(this.batchSize, function(err, logs, ids) {
        if (err) {
          self.isFlushing = false;
          return;
        }
        logsToSend = logs;
        logIds = ids;
        doSend();
      });
    } else {
      logsToSend = this.queue.splice(0, this.batchSize);
      doSend();
    }
    
    function doSend() {
      if (logsToSend.length === 0) {
        self.isFlushing = false;
        return;
      }
      
      self.sendRequest(logsToSend, function(success) {
        if (success && self.storage && logIds.length > 0) {
          self.storage.remove(logIds, function() {
            self.isFlushing = false;
            self.storage.count(function(err, count) {
              if (!err && count > 0) {
                setTimeout(function() {
                  self.flush();
                }, 100);
              }
            });
          });
        } else if (!success && self.storage) {
          self.isFlushing = false;
        } else {
          if (!success) {
            self.queue = logsToSend.concat(self.queue);
          }
          self.isFlushing = false;
        }
      });
    }
  };

  Reporter.prototype.compressData = function(data) {
    if (!this.enableCompression || !this.pako) {
      return null;
    }
    
    try {
      var jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
      var uint8array = this.pako.gzip(jsonStr);
      return uint8array;
    } catch (e) {
      return null;
    }
  };

  Reporter.prototype.sendRequest = function(logs, callback) {
    var self = this;
    var payload = JSON.stringify(logs);
    var compressedPayload = this.compressData(logs);
    var retries = 0;
    
    function attemptSend() {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', self.endpoint, true);
      
      if (compressedPayload) {
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Content-Encoding', 'gzip');
      } else {
        xhr.setRequestHeader('Content-Type', 'application/json');
      }
      
      xhr.timeout = self.timeout;
      
      xhr.onload = function() {
        if (xhr.status === 204) {
          callback(true);
        } else if (xhr.status === 429 && retries < self.maxRetries) {
          retries++;
          setTimeout(attemptSend, 1000 * retries);
        } else {
          callback(false);
        }
      };
      
      xhr.onerror = function() {
        if (retries < self.maxRetries) {
          retries++;
          setTimeout(attemptSend, 1000 * retries);
        } else {
          callback(false);
        }
      };
      
      xhr.ontimeout = function() {
        if (retries < self.maxRetries) {
          retries++;
          setTimeout(attemptSend, 1000 * retries);
        } else {
          callback(false);
        }
      };
      
      try {
        if (compressedPayload) {
          var blob = new Blob([compressedPayload], { type: 'application/octet-stream' });
          xhr.send(blob);
        } else {
          xhr.send(payload);
        }
      } catch (e) {
        try {
          xhr.send(payload);
        } catch (e2) {
          callback(false);
        }
      }
    }
    
    attemptSend();
  };

  Reporter.prototype.destroy = function() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush();
  };

  global.LogReporter = Reporter;

})(typeof window !== 'undefined' ? window : this);
