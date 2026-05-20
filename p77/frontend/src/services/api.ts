import axios from 'axios';
import type {
  DetectionRecord,
  DeviceInfo,
  MaterialParam,
  AlertRecord,
  DetectionStats,
  ApiResponse,
  AgingPrediction,
  DeviceDiagnostic,
} from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const detectionApi = {
  create: (data: Partial<DetectionRecord>) =>
    api.post<any, ApiResponse<DetectionRecord>>('/detections', data),

  getList: (params?: {
    page?: number;
    pageSize?: number;
    deviceID?: string;
    materialType?: string;
    startDate?: string;
    endDate?: string;
  }) =>
    api.get<any, ApiResponse<{ list: DetectionRecord[]; total: number }>>('/detections', { params }),

  getLatest: (limit = 10) =>
    api.get<any, ApiResponse<DetectionRecord[]>>('/detections/latest', { params: { limit } }),

  getStats: (days = 7) =>
    api.get<any, ApiResponse<DetectionStats[]>>('/detections/stats', { params: { days } }),
};

export const deviceApi = {
  getAll: () => api.get<any, ApiResponse<DeviceInfo[]>>('/devices'),

  updateStatus: (deviceId: string, status: string) =>
    api.put(`/devices/${deviceId}/status`, { status }),
};

export const materialApi = {
  getAll: () => api.get<any, ApiResponse<MaterialParam[]>>('/materials'),

  update: (data: MaterialParam) => api.put('/materials', data),
};

export const alertApi = {
  getList: (params?: {
    page?: number;
    pageSize?: number;
    alertLevel?: string;
    isHandled?: boolean;
  }) =>
    api.get<any, ApiResponse<{ list: AlertRecord[]; total: number }>>('/alerts', { params }),

  getUnhandledCount: () =>
    api.get<any, ApiResponse<{ count: number }>>('/alerts/unhandled-count'),

  getLatest: (limit = 10) =>
    api.get<any, ApiResponse<AlertRecord[]>>('/alerts/latest', { params: { limit } }),

  handle: (id: number, handledBy: string) =>
    api.put(`/alerts/${id}/handle`, { handledBy }),
};

export const predictionApi = {
  getAll: (days = 30) =>
    api.get<any, ApiResponse<AgingPrediction[]>>('/predictions', { params: { days } }),

  getByMaterial: (materialType: string, days = 30) =>
    api.get<any, ApiResponse<AgingPrediction>>('/predictions/aging', { 
      params: { materialType, days } 
    }),
};

export const exportApi = {
  exportDetections: (params?: {
    deviceID?: string;
    materialType?: string;
    startDate?: string;
    endDate?: string;
  }) =>
    api.post('/export/detections', params, {
      responseType: 'blob',
    }),

  exportAlerts: (params?: {
    alertLevel?: string;
    isHandled?: boolean;
  }) =>
    api.post('/export/alerts', params, {
      responseType: 'blob',
    }),

  exportStatistics: (params?: { days?: number }) =>
    api.post('/export/statistics', params, {
      responseType: 'blob',
    }),
};

export const diagnosticApi = {
  getAll: () => api.get<any, ApiResponse<DeviceDiagnostic[]>>('/diagnostics'),

  getByDevice: (deviceId: string) =>
    api.get<any, ApiResponse<DeviceDiagnostic>>(`/diagnostics/${deviceId}`),
};
