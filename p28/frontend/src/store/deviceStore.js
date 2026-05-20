import { create } from 'zustand';
import { decode, encode } from '@msgpack/msgpack';

const useDeviceStore = create((set, get) => ({
  devices: new Map(),
  selectedDevice: null,
  historyData: {},
  ws: null,
  stats: {
    messagesReceived: 0,
    bytesSaved: 0,
    lastMessageTime: null
  },
  sandbox: {
    enabled: false,
    overrides: {},
    currentPrediction: null,
    isPredicting: false,
    modelReady: false,
    modelLoading: false,
    error: null
  },
  vr: {
    supported: false,
    active: false,
    controllerConnected: false,
    position: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 }
  },

  connectWebSocket: () => {
    const ws = new WebSocket('ws://localhost:3001');
    ws.binaryType = 'arraybuffer';
    
    ws.onopen = () => {
      console.log('WebSocket connected (MessagePack enabled)');
      fetch('http://localhost:3001/api/devices')
        .then(res => res.json())
        .then(devices => {
          const deviceMap = new Map();
          devices.forEach(d => deviceMap.set(d.id, d));
          set({ devices: deviceMap });
        });
    };

    ws.onmessage = async (event) => {
      let message;
      const isBinary = event.data instanceof ArrayBuffer;
      
      if (isBinary) {
        message = decode(new Uint8Array(event.data));
        const originalSize = JSON.stringify(message).length;
        const compressedSize = event.data.byteLength;
        set((state) => ({
          stats: {
            ...state.stats,
            messagesReceived: state.stats.messagesReceived + 1,
            bytesSaved: state.stats.bytesSaved + (originalSize - compressedSize),
            lastMessageTime: Date.now()
          }
        }));
      } else {
        message = JSON.parse(event.data);
      }

      if (message.type === 'status') {
        set((state) => {
          const newDevices = new Map(state.devices);
          const existing = newDevices.get(message.data.deviceId) || {};
          newDevices.set(message.data.deviceId, {
            ...existing,
            ...message.data
          });
          return { devices: newDevices };
        });
      } else if (message.type === 'full_state') {
        set((state) => {
          const newDevices = new Map(state.devices);
          message.data.forEach(deviceData => {
            const existing = newDevices.get(deviceData.deviceId) || {};
            newDevices.set(deviceData.deviceId, {
              ...existing,
              ...deviceData
            });
          });
          return { devices: newDevices };
        });
      } else if (message.type === 'delta') {
        set((state) => {
          const newDevices = new Map(state.devices);
          message.data.forEach(delta => {
            const existing = newDevices.get(delta.deviceId) || {};
            newDevices.set(delta.deviceId, {
              ...existing,
              ...delta
            });
          });
          return { devices: newDevices };
        });
      } else if (message.type === 'history') {
        set((state) => ({
          historyData: {
            ...state.historyData,
            [message.deviceId]: message.data
          }
        }));
      } else if (message.type === 'sandbox_status') {
        set((state) => ({
          sandbox: {
            ...state.sandbox,
            enabled: message.enabled
          }
        }));
      } else if (message.type === 'sandbox_override') {
        set((state) => ({
          sandbox: {
            ...state.sandbox,
            overrides: {
              ...state.sandbox.overrides,
              [message.deviceId]: message.params
            }
          }
        }));
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...');
      setTimeout(() => get().connectWebSocket(), 3000);
    };

    set({ ws });
  },

  selectDevice: (deviceId) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = encode({ type: 'history', deviceId, range: '1h' });
      ws.send(message);
    }
    set({ selectedDevice: deviceId });
  },

  sendControlCommand: (deviceId, action) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = encode({ type: 'control', deviceId, action });
      ws.send(message);
    }
  },

  enableSandbox: async () => {
    const res = await fetch('http://localhost:3001/api/sandbox/enable', { method: 'POST' });
    return res.json();
  },

  disableSandbox: async () => {
    const res = await fetch('http://localhost:3001/api/sandbox/disable', { method: 'POST' });
    return res.json();
  },

  setSandboxOverride: async (deviceId, params) => {
    const res = await fetch(`http://localhost:3001/api/sandbox/set/${deviceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return res.json();
  },

  checkModelReady: async () => {
    try {
      const res = await fetch('http://localhost:3001/api/prediction/health');
      const data = await res.json();
      set((state) => ({
        sandbox: {
          ...state.sandbox,
          modelReady: data.status === 'ready',
          modelLoading: data.status === 'loading'
        }
      }));
      return data.status === 'ready';
    } catch (e) {
      set((state) => ({ sandbox: { ...state.sandbox, modelReady: false } }));
      return false;
    }
  },

  predictFailure: async (deviceId, params) => {
    const { checkModelReady } = get();

    set((state) => ({
      sandbox: { ...state.sandbox, isPredicting: true, error: null }
    }));

    try {
      const isReady = await checkModelReady();

      const res = await fetch(`http://localhost:3001/api/predict/${deviceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (res.status === 503) {
        const data = await res.json();
        throw new Error(data.code === 'MODEL_LOADING'
          ? '⏳ LSTM模型正在预热中，请稍后重试...'
          : '预测服务暂时不可用');
      }

      if (!res.ok) {
        throw new Error('预测请求失败');
      }

      const data = await res.json();
      set((state) => ({
        sandbox: {
          ...state.sandbox,
          isPredicting: false,
          currentPrediction: data,
          error: null
        }
      }));
      return data;

    } catch (error) {
      set((state) => ({
        sandbox: {
          ...state.sandbox,
          isPredicting: false,
          error: error.message
        }
      }));
      throw error;
    }
  }
}));

export { useDeviceStore };
