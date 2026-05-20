import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const deviceAPI = {
  getAll: () => api.get('/devices'),
  get: (deviceId) => api.get(`/devices/${deviceId}`),
  register: (data) => api.post('/devices', data),
  connect: (deviceId) => api.post(`/devices/${deviceId}/connect`),
  disconnect: (deviceId) => api.post(`/devices/${deviceId}/disconnect`),
  updateConfig: (deviceId, config) => api.put(`/devices/${deviceId}/config`, config),
  heartbeat: (deviceId) => api.post(`/devices/${deviceId}/heartbeat`),
};

export const collectionAPI = {
  start: (deviceId) => api.post('/collect/start', null, { params: { device_id: deviceId } }),
  stop: (deviceId) => api.post('/collect/stop', null, { params: { device_id: deviceId } }),
  collectCharacter: (data) => api.post('/collect/character', data),
};

export const recordsAPI = {
  getAll: (deviceId) => api.get('/records', { params: { device_id: deviceId } }),
  getCharacters: (sessionId) => api.get(`/characters/${sessionId}`),
};

export const alertAPI = {
  send: (data) => api.post('/alerts', data),
};

export const configAPI = {
  getBackups: (deviceId) => api.get('/config/backups', { params: { device_id: deviceId } }),
  createBackup: (deviceId, configName) => api.post('/config/backup', { config_name: configName }, { params: { device_id: deviceId } }),
  restoreBackup: (backupId) => api.post(`/config/restore/${backupId}`),
  deleteBackup: (backupId) => api.delete(`/config/backup/${backupId}`),
};

export const diagnosticAPI = {
  getDeviceDiagnostics: (deviceId) => api.get(`/diagnostics/${deviceId}`),
  restartDevice: (deviceId) => api.post(`/diagnostics/${deviceId}/restart`),
  getOverview: () => api.get('/diagnostics/overview'),
};

export default api;