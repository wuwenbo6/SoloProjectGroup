import axios from 'axios';
import { SensorData, Alert, ProcessConfig, ProcessType, DiagnosticResult, AdjustmentRecord } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const sensorDataAPI = {
  getRecent: (processType?: ProcessType, limit: number = 50) =>
    api.get<{ data: SensorData[] }>('/sensor-data', {
      params: { process_type: processType, limit },
    }),

  getHistorical: (start: string, end: string, processType?: ProcessType) =>
    api.get<{ data: SensorData[] }>('/historical-data', {
      params: { start, end, process_type: processType },
    }),
};

export const alertAPI = {
  getActive: (limit: number = 20) =>
    api.get<{ alerts: Alert[] }>('/alerts', { params: { limit } }),

  acknowledge: (id: number) =>
    api.put(`/alerts/${id}/acknowledge`),
};

export const configAPI = {
  getAll: () =>
    api.get<{ configs: ProcessConfig[] }>('/configs'),

  update: (processType: ProcessType, config: Partial<ProcessConfig>) =>
    api.put(`/configs/${processType}`, config),
};

export const diagnosticAPI = {
  getLatest: () =>
    api.get<{ diagnostics: DiagnosticResult[] }>('/diagnostics'),

  getHistory: (deviceId: string, limit: number = 10) =>
    api.get<{ history: DiagnosticResult[] }>('/diagnostics/history', {
      params: { device_id: deviceId, limit },
    }),
};

export const autoAdjustAPI = {
  getStatus: () =>
    api.get<{ enabled: boolean }>('/auto-adjust'),

  setStatus: (enabled: boolean) =>
    api.put<{ enabled: boolean; message: string }>('/auto-adjust', { enabled }),

  getHistory: (processType?: ProcessType, limit: number = 20) =>
    api.get<{ adjustments: AdjustmentRecord[] }>('/adjustments', {
      params: { process_type: processType, limit },
    }),
};
