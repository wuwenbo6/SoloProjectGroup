import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getDashboardSummary = () => api.get('/dashboard/summary');
export const getDevices = () => api.get('/devices');
export const getDevice = (id) => api.get(`/devices/${id}`);
export const createDevice = (data) => api.post('/devices', data);
export const connectDevice = (id) => api.put(`/devices/${id}/connect`);
export const disconnectDevice = (id) => api.put(`/devices/${id}/disconnect`);
export const getDeviceParameters = (id) => api.get(`/devices/${id}/parameters`);
export const createDeviceParameter = (id, data) => api.post(`/devices/${id}/parameters`, data);
export const getSessions = () => api.get('/sessions');
export const getSession = (id) => api.get(`/sessions/${id}`);
export const createSession = (data) => api.post('/sessions', data);
export const updateSession = (id, data) => api.patch(`/sessions/${id}`, data);
export const startTranscription = (sessionId = null) => api.post('/transcription/start', { session_id: sessionId });
export const stopTranscription = (sessionId = null) => api.post('/transcription/stop', { session_id: sessionId });
export const pauseTranscription = (sessionId) => api.post('/transcription/pause', { session_id: sessionId });
export const getAlerts = (isResolved = null) => api.get('/alerts', { params: { is_resolved: isResolved } });
export const createAlert = (data) => api.post('/alerts', data);
export const resolveAlert = (id) => api.put(`/alerts/${id}/resolve`);

export default api;