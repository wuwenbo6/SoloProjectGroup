import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  register: (data: { username: string; email: string; password: string; role: string }) =>
    api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
  refreshToken: () => api.post('/auth/refresh'),
};

export const materialAPI = {
  getAll: (params?: any) => api.get('/materials', { params }),
  getById: (id: string) => api.get(`/materials/${id}`),
  create: (data: any) => api.post('/materials', data),
  update: (id: string, data: any) => api.put(`/materials/${id}`, data),
  delete: (id: string) => api.delete(`/materials/${id}`),
  getCategories: () => api.get('/materials/categories'),
};

export const collectionAPI = {
  getAll: (params?: any) => api.get('/collection', { params }),
  getById: (id: string) => api.get(`/collection/${id}`),
  create: (data: any) => api.post('/collection', data),
  update: (id: string, data: any) => api.put(`/collection/${id}`, data),
  sync: (ids: string[]) => api.post('/collection/sync', { ids }),
  getStatistics: () => api.get('/collection/statistics'),
};

export const inspectionAPI = {
  getAll: (params?: any) => api.get('/inspection/inspections', { params }),
  getById: (id: string) => api.get(`/inspection/inspections/${id}`),
  create: (data: any) => api.post('/inspection/inspections', data),
  update: (id: string, data: any) => api.put(`/inspection/inspections/${id}`, data),
  getStatistics: () => api.get('/inspection/inspections/statistics'),
  getAgencies: () => api.get('/inspection/agencies'),
  createAgency: (data: any) => api.post('/inspection/agencies', data),
  updateAgency: (id: string, data: any) => api.put(`/inspection/agencies/${id}`, data),
};

export const batchAPI = {
  getAll: (params?: any) => api.get('/batches', { params }),
  getById: (id: string) => api.get(`/batches/${id}`),
  create: (data: any) => api.post('/batches', data),
  update: (id: string, data: any) => api.put(`/batches/${id}`, data),
  getTrace: (batchNo: string) => api.get(`/batches/trace/${batchNo}`),
  getStatistics: () => api.get('/batches/statistics'),
};

export default api;
