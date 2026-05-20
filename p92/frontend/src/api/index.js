import axios from 'axios'

const request = axios.create({
  baseURL: 'http://localhost:8080/api',
  timeout: 10000
})

request.interceptors.request.use(
  config => {
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    return Promise.reject(error)
  }
)

export const craftApi = {
  list: (params) => request.get('/crafts', { params }),
  get: (id) => request.get(`/crafts/${id}`),
  create: (data) => request.post('/crafts', data),
  update: (id, data) => request.put(`/crafts/${id}`, data),
  delete: (id) => request.delete(`/crafts/${id}`),
  uploadImage: (formData) => request.post('/crafts/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const userApi = {
  get: (id) => request.get(`/users/${id}`),
  update: (id, data) => request.put(`/users/${id}`, data),
  works: (userId) => request.get(`/users/${userId}/works`)
}

export const interactionApi = {
  comments: (craftId) => request.get(`/interactions/crafts/${craftId}/comments`),
  addComment: (craftId, data) => request.post(`/interactions/crafts/${craftId}/comments`, data),
  like: (craftId) => request.post(`/interactions/crafts/${craftId}/like`),
  share: (craftId) => request.post(`/interactions/crafts/${craftId}/share`)
}

export default request
