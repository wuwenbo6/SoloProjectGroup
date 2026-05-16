(function(global) {
  'use strict';

  var DB_NAME = 'LogSDKDB';
  var DB_VERSION = 1;
  var STORE_NAME = 'logs';
  var LOCALSTORAGE_KEY = 'log_sdk_logs';
  var MAX_LOCAL_STORAGE_LOGS = 500;

  function getIndexedDB() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      return window.indexedDB;
    }
    if (global.indexedDB) {
      return global.indexedDB;
    }
    if (typeof require === 'function') {
      try {
        var electron = require('electron');
        if (electron && electron.remote && electron.remote.indexedDB) {
          return electron.remote.indexedDB;
        }
      } catch (e) {}
    }
    return null;
  }

  function Storage() {
    this.db = null;
    this.queue = [];
    this.isOpening = false;
    this.storageType = 'indexeddb';
    this.idx = getIndexedDB();
    this.memoryQueue = [];
  }

  Storage.prototype.supportsIndexedDB = function() {
    return !!this.idx;
  };

  Storage.prototype.supportsLocalStorage = function() {
    try {
      return typeof localStorage !== 'undefined';
    } catch (e) {
      return false;
    }
  };

  Storage.prototype.init = function(callback) {
    var self = this;
    
    if (!this.supportsIndexedDB()) {
      this.storageType = this.supportsLocalStorage() ? 'localstorage' : 'memory';
      callback && callback(null);
      return;
    }
    
    if (this.db) {
      callback && callback(null, this.db);
      return;
    }
    if (this.isOpening) {
      this.queue.push(callback);
      return;
    }
    this.isOpening = true;
    this.queue.push(callback);

    try {
      var request = this.idx.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          var store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = function(e) {
        self.db = e.target.result;
        self.isOpening = false;
        while (self.queue.length) {
          var cb = self.queue.shift();
          cb && cb(null, self.db);
        }
      };

      request.onerror = function(e) {
        self.isOpening = false;
        self.storageType = self.supportsLocalStorage() ? 'localstorage' : 'memory';
        while (self.queue.length) {
          var cb = self.queue.shift();
          cb && cb(null);
        }
      };
    } catch (e) {
      this.isOpening = false;
      this.storageType = this.supportsLocalStorage() ? 'localstorage' : 'memory';
      while (this.queue.length) {
        var cb = this.queue.shift();
        cb && cb(null);
      }
    }
  };

  Storage.prototype.add = function(log, callback) {
    var self = this;
    this.init(function(err) {
      if (self.storageType === 'localstorage') {
        self.addToLocalStorage(log, callback);
      } else if (self.storageType === 'memory') {
        self.addToMemory(log, callback);
      } else {
        self.addToIndexedDB(log, callback);
      }
    });
  };

  Storage.prototype.addToIndexedDB = function(log, callback) {
    var self = this;
    try {
      var tx = self.db.transaction([STORE_NAME], 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      var request = store.add(log);
      request.onsuccess = function() {
        callback && callback(null);
      };
      request.onerror = function(e) {
        self.storageType = self.supportsLocalStorage() ? 'localstorage' : 'memory';
        self.add(log, callback);
      };
    } catch (e) {
      self.storageType = self.supportsLocalStorage() ? 'localstorage' : 'memory';
      self.add(log, callback);
    }
  };

  Storage.prototype.addToLocalStorage = function(log, callback) {
    try {
      var logs = [];
      try {
        var data = localStorage.getItem(LOCALSTORAGE_KEY);
        if (data) {
          logs = JSON.parse(data);
        }
      } catch (e) {}
      
      if (!Array.isArray(logs)) {
        logs = [];
      }
      
      if (logs.length >= MAX_LOCAL_STORAGE_LOGS) {
        logs = logs.slice(Math.floor(logs.length / 2));
      }
      
      logs.push({
        id: Date.now() + Math.random(),
        timestamp: log.timestamp || Date.now(),
        log: log
      });
      
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(logs));
      callback && callback(null);
    } catch (e) {
      this.storageType = 'memory';
      this.addToMemory(log, callback);
    }
  };

  Storage.prototype.addToMemory = function(log, callback) {
    if (this.memoryQueue.length >= MAX_LOCAL_STORAGE_LOGS) {
      this.memoryQueue = this.memoryQueue.slice(Math.floor(this.memoryQueue.length / 2));
    }
    this.memoryQueue.push({
      id: Date.now() + Math.random(),
      timestamp: log.timestamp || Date.now(),
      log: log
    });
    callback && callback(null);
  };

  Storage.prototype.getBatch = function(limit, callback) {
    var self = this;
    this.init(function(err) {
      if (self.storageType === 'localstorage') {
        self.getBatchFromLocalStorage(limit, callback);
      } else if (self.storageType === 'memory') {
        self.getBatchFromMemory(limit, callback);
      } else {
        self.getBatchFromIndexedDB(limit, callback);
      }
    });
  };

  Storage.prototype.getBatchFromIndexedDB = function(limit, callback) {
    var self = this;
    try {
      var tx = self.db.transaction([STORE_NAME], 'readonly');
      var store = tx.objectStore(STORE_NAME);
      var index = store.index('timestamp');
      var request = index.openCursor(null, 'next');
      var logs = [];
      var ids = [];
      
      request.onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor && logs.length < limit) {
          logs.push(cursor.value);
          ids.push(cursor.value.id);
          cursor.continue();
        } else {
          callback && callback(null, logs, ids);
        }
      };
      request.onerror = function(e) {
        callback && callback(null, [], []);
      };
    } catch (e) {
      callback && callback(null, [], []);
    }
  };

  Storage.prototype.getBatchFromLocalStorage = function(limit, callback) {
    try {
      var data = localStorage.getItem(LOCALSTORAGE_KEY);
      var logs = data ? JSON.parse(data) : [];
      if (!Array.isArray(logs)) {
        logs = [];
      }
      logs.sort(function(a, b) { return a.timestamp - b.timestamp; });
      var batch = logs.slice(0, limit);
      var ids = batch.map(function(item) { return item.id; });
      var result = batch.map(function(item) { return item.log; });
      callback && callback(null, result, ids);
    } catch (e) {
      callback && callback(null, [], []);
    }
  };

  Storage.prototype.getBatchFromMemory = function(limit, callback) {
    this.memoryQueue.sort(function(a, b) { return a.timestamp - b.timestamp; });
    var batch = this.memoryQueue.slice(0, limit);
    var ids = batch.map(function(item) { return item.id; });
    var result = batch.map(function(item) { return item.log; });
    callback && callback(null, result, ids);
  };

  Storage.prototype.remove = function(ids, callback) {
    var self = this;
    this.init(function(err) {
      if (self.storageType === 'localstorage') {
        self.removeFromLocalStorage(ids, callback);
      } else if (self.storageType === 'memory') {
        self.removeFromMemory(ids, callback);
      } else {
        self.removeFromIndexedDB(ids, callback);
      }
    });
  };

  Storage.prototype.removeFromIndexedDB = function(ids, callback) {
    var self = this;
    if (!this.db) {
      callback && callback(null);
      return;
    }
    try {
      var tx = self.db.transaction([STORE_NAME], 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      var count = 0;
      ids.forEach(function(id) {
        var request = store.delete(id);
        request.onsuccess = function() {
          count++;
          if (count === ids.length) {
            callback && callback(null);
          }
        };
        request.onerror = function(e) {
            count++;
            if (count === ids.length) {
              callback && callback(null);
            }
          };
      });
    } catch (e) {
      callback && callback(null);
    }
  };

  Storage.prototype.removeFromLocalStorage = function(ids, callback) {
    try {
      var data = localStorage.getItem(LOCALSTORAGE_KEY);
      var logs = data ? JSON.parse(data) : [];
      if (!Array.isArray(logs)) {
        logs = [];
      }
      var idSet = {};
      ids.forEach(function(id) { idSet[id] = true; });
      logs = logs.filter(function(item) { return !idSet[item.id]; });
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(logs));
      callback && callback(null);
    } catch (e) {
      callback && callback(null);
    }
  };

  Storage.prototype.removeFromMemory = function(ids, callback) {
    var idSet = {};
    ids.forEach(function(id) { idSet[id] = true; });
    this.memoryQueue = this.memoryQueue.filter(function(item) { return !idSet[item.id]; });
    callback && callback(null);
  };

  Storage.prototype.count = function(callback) {
    var self = this;
    this.init(function(err) {
      if (self.storageType === 'localstorage') {
        self.countFromLocalStorage(callback);
      } else if (self.storageType === 'memory') {
        self.countFromMemory(callback);
      } else {
        self.countFromIndexedDB(callback);
      }
    });
  };

  Storage.prototype.countFromIndexedDB = function(callback) {
    var self = this;
    if (!this.db) {
      callback && callback(null, 0);
      return;
    }
    try {
      var tx = self.db.transaction([STORE_NAME], 'readonly');
      var store = tx.objectStore(STORE_NAME);
      var request = store.count();
      request.onsuccess = function(e) {
        callback && callback(null, e.target.result);
      };
      request.onerror = function(e) {
        callback && callback(null, 0);
      };
    } catch (e) {
      callback && callback(null, 0);
    }
  };

  Storage.prototype.countFromLocalStorage = function(callback) {
    try {
      var data = localStorage.getItem(LOCALSTORAGE_KEY);
      var logs = data ? JSON.parse(data) : [];
      callback && callback(null, Array.isArray(logs) ? logs.length : 0);
    } catch (e) {
      callback && callback(null, 0);
    }
  };

  Storage.prototype.countFromMemory = function(callback) {
    callback && callback(null, this.memoryQueue.length);
  };

  global.LogStorage = Storage;

})(typeof window !== 'undefined' ? window : this);
