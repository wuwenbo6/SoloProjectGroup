import axios from 'axios';
import { Gate, Job } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const jobAPI = {
  createJob: async (num_qubits: number, gates: Gate[], shots: number = 1024): Promise<Job> => {
    const response = await api.post('/jobs/', { num_qubits, gates, shots });
    return response.data;
  },

  getJob: async (jobId: string): Promise<Job> => {
    const response = await api.get(`/jobs/${jobId}`);
    return response.data;
  },

  getJobStatus: async (jobId: string): Promise<Job> => {
    const response = await api.get(`/jobs/${jobId}/status`);
    return response.data;
  },

  getJobs: async (skip: number = 0, limit: number = 100): Promise<Job[]> => {
    const response = await api.get('/jobs/', { params: { skip, limit } });
    return response.data;
  },
};

export const circuitAPI = {
  createCircuit: async (name: string, num_qubits: number, gates: Gate[]) => {
    const response = await api.post('/circuits/', { name, num_qubits, gates });
    return response.data;
  },

  getCircuits: async (skip: number = 0, limit: number = 100) => {
    const response = await api.get('/circuits/', { params: { skip, limit } });
    return response.data;
  },

  getCircuit: async (circuitId: string) => {
    const response = await api.get(`/circuits/${circuitId}`);
    return response.data;
  },
};

export default api;
