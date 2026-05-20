import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.request.use(
  config => config,
  error => Promise.reject(error)
)

api.interceptors.response.use(
  response => response.data,
  error => Promise.reject(error)
)

export const imageApi = {
  upload: (formData) => api.post('/image/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  analyzeDamage: (imagePath) => api.post('/image/damage/analyze', { imagePath }),
  extractText: (imagePath) => api.post('/image/text/extract', { imagePath })
}

export const textApi = {
  segment: (text) => api.post('/text/segment', { text }),
  punctuate: (text) => api.post('/text/punctuate', { text }),
  convertVariant: (text) => api.post('/text/variant/convert', { text }),
  align: (text) => api.post('/text/align', { text })
}

export const semanticApi = {
  interpret: (ancientText) => api.post('/semantic/interpret', { ancientText }),
  match: (text) => api.post('/semantic/match', { text }),
  getDictionary: (word) => api.get(`/semantic/dictionary/${word}`)
}

export const databaseApi = {
  getPage: (id) => api.get(`/database/page/${id}`),
  getPageList: (params) => api.get('/database/page/list', { params }),
  savePage: (data) => api.post('/database/page', data),
  updatePage: (data) => api.put('/database/page', data),
  updatePageStatus: (id, status) => api.put(`/database/page/${id}/status`, { status }),
  saveDamageAreas: (id, damageAreas) => api.put(`/database/page/${id}/damage`, { damageAreas }),
  
  getDraft: (id) => api.get(`/database/draft/${id}`),
  getDraftsByPage: (pageId) => api.get(`/database/draft/page/${pageId}`),
  saveDraft: (data) => api.post('/database/draft', data),
  updateDraft: (data) => api.put('/database/draft', data),
  
  getInterpretation: (id) => api.get(`/database/interpretation/${id}`),
  searchInterpretation: (ancientText) => api.get('/database/interpretation/search', { params: { ancientText } }),
  getInterpretationList: (params) => api.get('/database/interpretation/list', { params }),
  saveInterpretation: (data) => api.post('/database/interpretation', data)
}

export default api
