import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const synthesisApi = {
  createTask: (data) => api.post('/synthesis/create', data),
  executeTask: (taskId) => api.post(`/synthesis/execute/${taskId}`),
  getStatus: (taskId) => api.get(`/synthesis/status/${taskId}`),
  getTasks: (params) => api.get('/synthesis/tasks', { params })
}

export const audioApi = {
  upload: (formData) => api.post('/audio/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  extractFeatures: (corpusId) => api.post(`/audio/extract-features/${corpusId}`),
  getCorpora: (params) => api.get('/audio/corpora', { params })
}

export const knowledgeApi = {
  getDialects: (params) => api.get('/knowledge/dialects', { params }),
  getDialect: (id) => api.get(`/knowledge/dialects/${id}`),
  createDialect: (data) => api.post('/knowledge/dialects', data),
  updateDialect: (id, data) => api.put(`/knowledge/dialects/${id}`, data),
  getBranches: () => api.get('/knowledge/branches'),
  initSampleData: () => api.post('/knowledge/initialize-sample-data'),
  getIntonationPatterns: (dialectId) => api.get(`/knowledge/intonation-patterns/${dialectId}`),
  createIntonationPattern: (data) => api.post('/knowledge/intonation-patterns', data)
}

export const repairApi = {
  repairAudio: (data) => api.post('/repair/repair-audio', data),
  uploadAndRepair: (formData) => api.post('/repair/upload-and-repair', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getRepairRecords: (params) => api.get('/repair/repair-records', { params }),
  assessQuality: (taskId) => api.get(`/repair/quality-assessment/${taskId}`)
}

export default api
