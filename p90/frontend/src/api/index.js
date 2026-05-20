import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8080/api',
  timeout: 15000
})

api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

api.interceptors.response.use(
  response => response.data,
  error => Promise.reject(error)
)

export const patternApi = {
  list: (params) => api.get('/patterns', { params }),
  listPaged: (page, size, sort) => api.get('/patterns/page', { params: { page, size, sort } }),
  get: (id) => api.get(`/patterns/${id}`),
  create: (data) => api.post('/patterns', data),
  update: (id, data) => api.put(`/patterns/${id}`, data),
  delete: (id) => api.delete(`/patterns/${id}`),
  upload: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/patterns/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

export const userApi = {
  login: (data) => api.post('/users/login', data),
  register: (data) => api.post('/users/register', data),
  profile: () => api.get('/users/profile'),
  update: (data) => api.put('/users/profile', data)
}

export const interactionApi = {
  like: (patternId) => api.post('/interactions/like', { patternId }),
  unlike: (patternId) => api.delete('/interactions/like', { data: { patternId } }),
  comment: (data) => api.post('/interactions/comment', data),
  comments: (patternId) => api.get(`/interactions/comments/${patternId}`),
  share: (patternId) => api.post('/interactions/share', { patternId })
}

export default api
