import axios from 'axios'
import { useAuthStore } from '@/store/auth'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me')
}

export const rubbingAPI = {
  create: (data) => api.post('/rubbings', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  list: (params) => api.get('/rubbings', { params }),
  get: (id) => api.get(`/rubbings/${id}`),
  update: (id, data) => api.put(`/rubbings/${id}`, data),
  delete: (id) => api.delete(`/rubbings/${id}`),
  addCollaborator: (id, userId) => api.post(`/rubbings/${id}/collaborators`, { userId }),
  removeCollaborator: (id, userId) => api.delete(`/rubbings/${id}/collaborators/${userId}`),
  updateCharacter: (id, data) => api.put(`/rubbings/${id}/characters`, data),
  confirmCharacter: (id, charId) => api.put(`/rubbings/${id}/characters/${charId}/confirm`),
  autoPreprocess: (id) => api.post(`/rubbings/${id}/auto-preprocess`),
  processImage: (id, operations) => api.post(`/rubbings/${id}/process`, { operations }),
  recognizeCharacters: (id) => api.post(`/rubbings/${id}/recognize`),
  getCharacterImage: (id, charId) => api.get(`/rubbings/${id}/characters/${charId}/image`),
  getQualityAnalysis: (id) => api.get(`/rubbings/${id}/quality`),
  repairImage: (id, options) => api.post(`/rubbings/${id}/repair`, options),
  exportRubbing: (id, format, options) => api.post(`/rubbings/${id}/export`, { format, options }),
  getExportFormats: () => api.get('/rubbings/export/formats'),
  lookupCharacter: (char) => api.get(`/rubbings/dictionary/lookup/${char}`),
  searchDictionary: (keyword) => api.get('/rubbings/dictionary/search', { params: { keyword } }),
  getDictionaryStats: () => api.get('/rubbings/dictionary/stats'),
  getHistory: (id, charId) => api.get(`/rubbings/${id}/history`, { params: { charId } })
}

export const userAPI = {
  getCurrentUser: () => api.get('/users/me'),
  getPermissions: () => api.get('/users/permissions'),
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
  delete: (id) => api.delete(`/users/${id}`)
}

export default api
