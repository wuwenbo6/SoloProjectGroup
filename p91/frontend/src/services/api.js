import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
};

export const photosAPI = {
  upload: (formData) => api.post('/photos/upload', formData),
  getAll: () => api.get('/photos'),
  getById: (id) => api.get(`/photos/${id}`),
  update: (id, data) => api.put(`/photos/${id}`, data),
  delete: (id) => api.delete(`/photos/${id}`),
  startRepair: (id, repairType, parameters) => 
    api.post(`/photos/${id}/repair?repair_type=${repairType}&parameters=${JSON.stringify(parameters)}`),
  getRepairStatus: (repairId) => api.get(`/photos/repair/${repairId}`),
  share: (id) => api.post(`/photos/${id}/share`),
  getShared: (token) => api.get(`/photos/share/${token}`),
  getFilmStyles: () => api.get('/photos/film-styles'),
  applyFilmStyle: (id, styleData) => api.post(`/photos/${id}/film-style`, null, { params: styleData }),
  getRepairRecords: () => api.get('/photos/repair-records'),
  exportRepairRecords: (format) => api.get('/photos/repair-records/export', { 
    params: { format }, 
    responseType: 'blob' 
  }),
  getSimilarPhotos: (id, topK) => api.get(`/photos/similar-photos/${id}`, { params: { top_k: topK } }),
};

export default api;
