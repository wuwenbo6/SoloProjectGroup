import axios from 'axios';
import type { Order, Requirement, Artisan, ApiResponse } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const orderApi = {
  getUserOrders: async (userId: number, page = 1, size = 10) => {
    const response = await api.get<ApiResponse<{ records: Order[]; total: number }>>(
      `/order/order/user/${userId}?page=${page}&size=${size}`
    );
    return response.data;
  },

  getOrderById: async (orderId: number) => {
    const response = await api.get<ApiResponse<Order>>(`/order/order/${orderId}`);
    return response.data;
  },

  createOrder: async (order: Partial<Order>) => {
    const response = await api.post<ApiResponse<Order>>('/order/order', order);
    return response.data;
  },

  updateProgress: async (orderId: number, progress: number) => {
    const response = await api.put<ApiResponse<void>>(
      `/order/order/${orderId}/progress?progress=${progress}`
    );
    return response.data;
  },

  updateStatus: async (orderId: number, status: number) => {
    const response = await api.put<ApiResponse<void>>(
      `/order/order/${orderId}/status?status=${status}`
    );
    return response.data;
  },
};

export const requirementApi = {
  getList: async (page = 1, size = 10) => {
    const response = await api.get<ApiResponse<{ records: Requirement[]; total: number }>>(
      `/requirement/requirement?page=${page}&size=${size}`
    );
    return response.data;
  },

  create: async (requirement: Partial<Requirement>) => {
    const response = await api.post<ApiResponse<Requirement>>(
      '/requirement/requirement',
      requirement
    );
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get<ApiResponse<Requirement>>(`/requirement/requirement/${id}`);
    return response.data;
  },
};

export const artisanApi = {
  getPendingList: async () => {
    const response = await api.get<ApiResponse<Artisan[]>>('/artisan/artisan/pending');
    return response.data;
  },

  getVerifiedList: async () => {
    const response = await api.get<ApiResponse<Artisan[]>>('/artisan/artisan/verified');
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get<ApiResponse<Artisan>>(`/artisan/artisan/${id}`);
    return response.data;
  },

  verify: async (artisanId: number, status: number, reason?: string) => {
    const response = await api.post<ApiResponse<void>>('/artisan/artisan/verify', {
      artisanId,
      status,
      reason,
    });
    return response.data;
  },
};

export const paymentApi = {
  processPayment: async (orderId: number, paymentMethod: string) => {
    const response = await api.post<ApiResponse<{ paymentId: string; status: string }>>(
      '/payment/payment/process',
      { orderId, paymentMethod }
    );
    return response.data;
  },
};

export default api;
