import axios from 'axios';
import type { FontMetadata, TypographyConfig, ApiResponse, ShareLink } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fontApi = {
  async uploadFont(file: File): Promise<ApiResponse<FontMetadata>> {
    const formData = new FormData();
    formData.append('font', file);
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getAllFonts(): Promise<ApiResponse<FontMetadata[]>> {
    const response = await api.get('/fonts');
    return response.data;
  },

  async getFontById(id: string): Promise<ApiResponse<FontMetadata>> {
    const response = await api.get(`/fonts/${id}`);
    return response.data;
  },

  async deleteFont(id: string): Promise<ApiResponse<void>> {
    const response = await api.delete(`/fonts/${id}`);
    return response.data;
  },
};

export const configApi = {
  async saveConfig(config: TypographyConfig): Promise<ApiResponse<TypographyConfig>> {
    const response = await api.post('/configs', config);
    return response.data;
  },

  async getAllConfigs(): Promise<ApiResponse<TypographyConfig[]>> {
    const response = await api.get('/configs');
    return response.data;
  },

  async getConfigById(id: string): Promise<ApiResponse<TypographyConfig>> {
    const response = await api.get(`/configs/${id}`);
    return response.data;
  },

  async deleteConfig(id: string): Promise<ApiResponse<void>> {
    const response = await api.delete(`/configs/${id}`);
    return response.data;
  },

  async exportConfig(id: string): Promise<void> {
    const response = await api.get(`/configs/${id}/export`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `config-${id}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  async shareConfig(configId: string): Promise<ApiResponse<ShareLink>> {
    const response = await api.post(`/configs/${configId}/share`);
    return response.data;
  },

  async getSharedConfig(shareCode: string): Promise<ApiResponse<TypographyConfig>> {
    const response = await api.get(`/share/${shareCode}`);
    return response.data;
  },
};

export const userApi = {
  async getShareLinks(): Promise<ApiResponse<ShareLink[]>> {
    const response = await api.get('/user/share-links');
    return response.data;
  },

  async deleteShareLink(id: string): Promise<ApiResponse<void>> {
    const response = await api.delete(`/user/share-links/${id}`);
    return response.data;
  },

  async getUserFonts(): Promise<ApiResponse<FontMetadata[]>> {
    const response = await api.get('/user/fonts');
    return response.data;
  },

  async getUserConfigs(): Promise<ApiResponse<TypographyConfig[]>> {
    const response = await api.get('/user/configs');
    return response.data;
  },
};
