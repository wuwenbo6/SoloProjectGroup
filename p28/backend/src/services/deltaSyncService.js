const { deepStrictEqual } = require('assert');

class DeltaSyncService {
  constructor(options = {}) {
    this.previousStates = new Map();
    this.pendingUpdates = new Map();
    this.throttleMs = options.throttleMs || 100;
    this.batchInterval = null;
    this.changeThreshold = options.changeThreshold || 0.01;
    this.listeners = [];
  }

  start() {
    if (this.batchInterval) return;
    this.batchInterval = setInterval(() => this.flushBatch(), this.throttleMs);
  }

  stop() {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }

  onDelta(callback) {
    this.listeners.push(callback);
  }

  processState(deviceId, newState) {
    const previousState = this.previousStates.get(deviceId);
    
    if (!previousState) {
      this.previousStates.set(deviceId, this.cloneState(newState));
      this.addToBatch(deviceId, newState);
      return;
    }

    const delta = this.computeDelta(previousState, newState);
    
    if (Object.keys(delta).length > 0) {
      this.previousStates.set(deviceId, this.cloneState(newState));
      this.addToBatch(deviceId, { deviceId, ...delta });
    }
  }

  computeDelta(prev, current) {
    const delta = {};

    for (const key of Object.keys(current)) {
      if (key === 'deviceId' || key === 'type' || key === 'name') continue;
      
      const prevValue = prev[key];
      const currValue = current[key];

      if (prevValue === undefined) {
        delta[key] = currValue;
        continue;
      }

      if (typeof currValue === 'number' && typeof prevValue === 'number') {
        if (Math.abs(currValue - prevValue) >= this.changeThreshold) {
          delta[key] = currValue;
        }
      } else if (typeof currValue === 'boolean') {
        if (currValue !== prevValue) {
          delta[key] = currValue;
        }
      } else if (currValue && typeof currValue === 'object') {
        if (!this.isDeepEqual(prevValue, currValue)) {
          delta[key] = currValue;
        }
      } else {
        if (currValue !== prevValue) {
          delta[key] = currValue;
        }
      }
    }

    return delta;
  }

  isDeepEqual(a, b) {
    try {
      deepStrictEqual(a, b);
      return true;
    } catch {
      return false;
    }
  }

  cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  addToBatch(deviceId, delta) {
    this.pendingUpdates.set(deviceId, {
      ...this.pendingUpdates.get(deviceId),
      ...delta,
      deviceId
    });
  }

  flushBatch() {
    if (this.pendingUpdates.size === 0) return;

    const batch = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    if (batch.length > 0) {
      this.listeners.forEach((listener) => listener(batch));
    }
  }

  getFullState(deviceId) {
    return this.previousStates.get(deviceId);
  }

  getAllStates() {
    return Object.fromEntries(this.previousStates);
  }
}

module.exports = DeltaSyncService;
