import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000
})

request.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const detectionApi = {
  getLatestResult: () => request.get('/detection/latest'),
  getHistory: (params) => request.get('/detection/history', { params }),
  getDefectList: (params) => request.get('/defect/list', { params }),
  getStatistics: () => request.get('/detection/statistics'),
  startDetection: () => request.post('/detection/start'),
  stopDetection: () => request.post('/detection/stop')
}

export const processApi = {
  getParams: () => request.get('/process/params'),
  updateParams: (data) => request.put('/process/params', data),
  getHistoryParams: () => request.get('/process/history')
}

export const cameraApi = {
  getStatus: () => request.get('/camera/status'),
  getSnapshot: () => request.get('/camera/snapshot')
}

export const alertApi = {
  getStatistics: () => request.get('/alert/statistics'),
  getAlerts: () => request.get('/alert/list'),
  handleAlert: (alertId, data) => request.put(`/alert/handle/${alertId}`, data),
  getThresholds: (paramType) => request.get(`/alert/thresholds/${paramType}`),
  updateThresholds: (paramType, data) => request.put(`/alert/thresholds/${paramType}`, data)
}

export const exportApi = {
  exportDefects: (params) => request.get('/export/defects', { params, responseType: 'blob' }),
  exportDetections: (params) => request.get('/export/detections', { params, responseType: 'blob' }),
  getExportStatistics: () => request.get('/export/statistics')
}

export default request
