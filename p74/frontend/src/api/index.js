import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getUsers: () => api.get('/auth/users')
}

export const stitchAPI = {
  getStitches: () => api.get('/stitches'),
  getStitch: (id) => api.get(`/stitches/${id}`),
  createStitch: (data) => api.post('/stitches', data),
  addStep: (id, data) => api.post(`/stitches/${id}/steps`, data),
  deleteStitch: (id) => api.delete(`/stitches/${id}`)
}

export const progressAPI = {
  getProgress: (userId) => api.get(`/progress/${userId}`),
  updateProgress: (data) => api.post('/progress', data),
  getStats: (userId) => api.get(`/progress/stats/${userId}`)
}

export const qaAPI = {
  getQuestions: () => api.get('/qa'),
  getQuestion: (id) => api.get(`/qa/${id}`),
  createQuestion: (data) => api.post('/qa', data),
  addAnswer: (id, data) => api.post(`/qa/${id}/answers`, data)
}

export const videoAPI = {
  getVideos: () => api.get('/videos'),
  uploadVideo: (formData) => api.post('/videos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  submitFeedback: (data) => api.post('/videos/feedback', data),
  getFeedback: (stitchId) => api.get(`/videos/feedback/${stitchId}`)
}

export default api
