import axios from 'axios'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', new URLSearchParams({
    username: data.email,
    password: data.password
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
}

export const stitchAPI = {
  getAll: (params) => api.get('/stitches', { params }),
  getMy: () => api.get('/stitches/my'),
  getById: (id) => api.get(`/stitches/${id}`),
  create: (data) => api.post('/stitches', data),
  update: (id, data, changeNote = '') => api.put(`/stitches/${id}`, {
    ...data,
    change_note: changeNote
  }),
  delete: (id) => api.delete(`/stitches/${id}`),
  getSteps: (stitchId) => api.get(`/stitches/${stitchId}/steps`),
  saveSteps: (stitchId, steps) => api.post(`/stitches/${stitchId}/steps`, steps),
  updateStep: (stitchId, stepId, data) => api.put(`/stitches/${stitchId}/steps/${stepId}`, data),
  deleteStep: (stitchId, stepId) => api.delete(`/stitches/${stitchId}/steps/${stepId}`),
  getHistory: (stitchId) => api.get(`/stitches/${stitchId}/history`),
  getHistoryVersion: (stitchId, version) => api.get(`/stitches/${stitchId}/history/${version}`),
  restoreVersion: (stitchId, version) => api.post(`/stitches/${stitchId}/history/${version}/restore`),
  compareVersions: (stitchId, v1, v2) => api.get(`/stitches/${stitchId}/history/compare/${v1}/${v2}`),
  getSimilar: (stitchId, params) => api.get(`/stitches/similarity/${stitchId}`, { params }),
  searchSimilar: (params) => api.post('/stitches/similarity/search', null, { params })
}

export const workAPI = {
  getAll: (params) => api.get('/works', { params }),
  getMy: (params) => api.get('/works/my', { params }),
  getById: (id) => api.get(`/works/${id}`),
  create: (data) => api.post('/works', data),
  update: (id, data) => api.put(`/works/${id}`, data),
  delete: (id) => api.delete(`/works/${id}`),
  like: (id) => api.post(`/works/${id}/like`),
  share: (id) => api.post(`/works/${id}/share`)
}

export const commentAPI = {
  getByWork: (workId) => api.get(`/comments/work/${workId}`),
  create: (data) => api.post('/comments', data),
  delete: (id) => api.delete(`/comments/${id}`)
}

export const uploadAPI = {
  uploadImage: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

export default api
