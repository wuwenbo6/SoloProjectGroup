import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

export const userAPI = {
  register: (data) => axios.post(`${API_BASE}/users/register`, data),
  login: (data) => axios.post(`${API_BASE}/users/login`, data),
  getProfile: (id) => axios.get(`${API_BASE}/users/${id}`),
  updateProfile: (id, data) => axios.put(`${API_BASE}/users/${id}`, data),
};

export const activityAPI = {
  create: (formData) => axios.post(`${API_BASE}/activities`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAll: (params = {}) => axios.get(`${API_BASE}/activities`, { params }),
  getById: (id) => axios.get(`${API_BASE}/activities/${id}`),
  delete: (id) => axios.delete(`${API_BASE}/activities/${id}`),
  getSteps: (activityId) => axios.get(`${API_BASE}/activities/${activityId}/steps`),
  addStep: (activityId, formData) => axios.post(`${API_BASE}/activities/${activityId}/steps`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateStep: (stepId, formData) => axios.put(`${API_BASE}/activities/steps/${stepId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteStep: (stepId) => axios.delete(`${API_BASE}/activities/steps/${stepId}`),
};

export const interactionAPI = {
  addComment: (data) => axios.post(`${API_BASE}/interactions/comments`, data),
  getComments: (activityId) => axios.get(`${API_BASE}/interactions/comments/${activityId}`),
  pollComments: (activityId, since) => axios.get(`${API_BASE}/interactions/notifications/poll/${activityId}`, { params: { since } }),
  addFavorite: (data) => axios.post(`${API_BASE}/interactions/favorites`, data),
  removeFavorite: (data) => axios.delete(`${API_BASE}/interactions/favorites`, { data }),
  getFavorites: (userId) => axios.get(`${API_BASE}/interactions/favorites/${userId}`),
  addStepQA: (stepId, data) => axios.post(`${API_BASE}/activities/steps/${stepId}/qa`, data),
  answerQA: (qaId, data) => axios.post(`${API_BASE}/activities/qa/${qaId}/answer`, data),
  deleteQA: (qaId) => axios.delete(`${API_BASE}/activities/qa/${qaId}`),
};

export const exportAPI = {
  exportActivities: (format, params = {}) => axios.get(`${API_BASE}/export/${format}`, {
    params,
    responseType: 'blob'
  }),
  getRecommendations: (activityId, limit = 5) => axios.get(`${API_BASE}/recommendations/${activityId}`, { params: { limit } }),
  getHomeRecommendations: (limit = 10) => axios.get(`${API_BASE}/home/recommendations`, { params: { limit } }),
};
