import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000
});

export const cameraAPI = {
  listDevices: () => api.get('/api/camera/devices'),
  connect: (deviceId: string) => api.post(`/api/camera/connect?device_id=${deviceId}`),
  disconnect: (deviceId: string) => api.post(`/api/camera/disconnect?device_id=${deviceId}`),
  getStatus: () => api.get('/api/camera/status')
};

export const paramsAPI = {
  listProfiles: () => api.get('/api/params/profiles'),
  getProfile: (id: number) => api.get(`/api/params/profiles/${id}`),
  createProfile: (data: any) => api.post('/api/params/profiles', data),
  updateProfile: (id: number, data: any) => api.put(`/api/params/profiles/${id}`, data),
  deleteProfile: (id: number) => api.delete(`/api/params/profiles/${id}`),
  getPresets: (filmFormat: string) => api.get(`/api/params/presets/${filmFormat}`),
  exportProfiles: () => api.post('/api/params/export'),
  importProfiles: (data: any) => api.post('/api/params/import', data)
};

export const scanningAPI = {
  startScan: (config: any) => api.post('/api/scanning/start', config),
  stopScan: () => api.post('/api/scanning/stop'),
  getStatus: () => api.get('/api/scanning/status'),
  captureSingle: () => api.post('/api/scanning/capture-single'),
  getRecentScans: () => api.get('/api/scanning/recent-scans')
};

export const restorationAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/restoration/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  process: (imageBase64: string, params: any) => 
    api.post('/api/restoration/process', { imageBase64, params }),
  quickRestore: (imageBase64: string) => 
    api.post('/api/restoration/quick-restore', { imageBase64 }),
  removeScratches: (imageBase64: string, radius: number) => 
    api.post('/api/restoration/remove-scratches', { imageBase64, radius }),
  reduceNoise: (imageBase64: string, strength: number) => 
    api.post('/api/restoration/reduce-noise', { imageBase64, strength }),
  correctFading: (imageBase64: string) => 
    api.post('/api/restoration/correct-fading', { imageBase64 }),
  compare: (original: string, processed: string) => 
    api.post('/api/restoration/compare', { original_base64: original, processed_base64: processed })
};

export const archiveAPI = {
  listPhotos: (params?: any) => api.get('/api/archive/photos', { params }),
  getPhoto: (id: number) => api.get(`/api/archive/photos/${id}`),
  updatePhoto: (id: number, data: any) => api.put(`/api/archive/photos/${id}`, data),
  deletePhoto: (id: number) => api.delete(`/api/archive/photos/${id}`),
  importPhoto: (file: File, metadata?: any) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      Object.entries(metadata).forEach(([k, v]) => {
        if (v) formData.append(k, v as string);
      });
    }
    return api.post('/api/archive/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  downloadPhoto: (id: number, format?: string) => 
    api.get(`/api/archive/photos/${id}/download`, { params: { format }, responseType: 'blob' }),
  getThumbnail: (id: number) => 
    api.get(`/api/archive/photos/${id}/thumbnail`, { responseType: 'blob' }),
  batchExport: (photoIds: number[], format: string) => 
    api.post('/api/archive/batch-export', { photoIds, output_format: format }),
  getStats: () => api.get('/api/archive/stats')
};

export const enhancementAPI = {
  autoCrop: (imageBase64: string, margin: number = 20, threshold: number = 30) => 
    api.post('/api/enhancement/auto-crop', { image_base64: imageBase64, margin, threshold }),
  stitchImages: (imagesBase64: string[], blendStrength: number = 0.5) => 
    api.post('/api/enhancement/stitch', { images_base64: imagesBase64, blend_strength: blendStrength }),
  addTextWatermark: (imageBase64: string, text: string, position: string = 'bottom-right', 
                     opacity: number = 0.3, fontSize: number = 32, color: string = '#ffffff') => 
    api.post('/api/enhancement/watermark/text', { 
      image_base64: imageBase64, text, position, opacity, font_size: fontSize, color 
    }),
  batchAddTextWatermark: (imagesBase64: string[], text: string, position: string = 'bottom-right', 
                          opacity: number = 0.3, fontSize: number = 32, color: string = '#ffffff') => 
    api.post('/api/enhancement/batch-watermark/text', { 
      images_base64: imagesBase64, text, position, opacity, font_size: fontSize, color 
    }),
  recognizeFilmType: (imageBase64: string) => 
    api.post('/api/enhancement/recognize-film-type', { image_base64: imageBase64 })
};

export const restorationHistoryAPI = {
  create: (data: any) => api.post('/api/restoration/history/', data),
  getByPhoto: (photoId: number) => api.get(`/api/restoration/history/photo/${photoId}`),
  getAll: (skip?: number, limit?: number, operationType?: string) => 
    api.get('/api/restoration/history/', { params: { skip, limit, operation_type: operationType } }),
  getDetail: (historyId: number) => api.get(`/api/restoration/history/${historyId}`),
  delete: (historyId: number) => api.delete(`/api/restoration/history/${historyId}`),
  compare: (historyId1: number, historyId2: number) => 
    api.get(`/api/restoration/history/compare/${historyId1}/${historyId2}`),
  export: (historyIds: number[]) => api.post('/api/restoration/history/export', historyIds)
};

export const paramsBackupAPI = {
  create: (data: any) => api.post('/api/params/backup/', data),
  getAll: (skip?: number, limit?: number, backupType?: string) => 
    api.get('/api/params/backup/', { params: { skip, limit, backup_type: backupType } }),
  getDetail: (backupId: number, includeParams?: boolean) => 
    api.get(`/api/params/backup/${backupId}`, { params: { include_params: includeParams } }),
  restore: (backupId: number, restoreName?: string) => 
    api.post('/api/params/backup/restore', { backup_id: backupId, restore_name: restoreName }),
  delete: (backupId: number) => api.delete(`/api/params/backup/${backupId}`),
  export: (backupId: number) => api.get(`/api/params/backup/export/${backupId}`),
  import: (data: any) => api.post('/api/params/backup/import', data),
  sync: (backupId: number) => api.post(`/api/params/backup/sync/${backupId}`),
  autoBackup: (profileId: number, sourceDevice?: string) => 
    api.post(`/api/params/backup/auto-backup/profile/${profileId}`, { source_device: sourceDevice })
};

export const multiScanAPI = {
  start: (config: any) => api.post('/api/scanning/multi/start', config),
  stop: (sessionId: number) => api.post(`/api/scanning/multi/stop/${sessionId}`),
  getActiveSessions: () => api.get('/api/scanning/multi/active'),
  getSession: (sessionId: number) => api.get(`/api/scanning/multi/session/${sessionId}`),
  getSessionPhotos: (sessionId: number) => api.get(`/api/scanning/multi/session/${sessionId}/photos`),
  getDeviceStatus: () => api.get('/api/scanning/multi/devices/status'),
  startBatch: (configs: any[]) => api.post('/api/scanning/multi/batch/start', configs),
  stopAll: () => api.post('/api/scanning/multi/batch/stop'),
  getStatistics: (sessionId: number) => api.get(`/api/scanning/multi/session/${sessionId}/statistics`),
  getHistory: (skip?: number, limit?: number, status?: string) => 
    api.get('/api/scanning/multi/history', { params: { skip, limit, status } })
};

export const tagsAPI = {
  create: (data: any) => api.post('/api/archive/tags/', data),
  getAll: () => api.get('/api/archive/tags/'),
  get: (tagId: number) => api.get(`/api/archive/tags/${tagId}`),
  update: (tagId: number, data: any) => api.put(`/api/archive/tags/${tagId}`, data),
  delete: (tagId: number) => api.delete(`/api/archive/tags/${tagId}`),
  addToPhoto: (photoId: number, tagIds: number[]) => 
    api.post(`/api/archive/tags/photo/${photoId}`, { tag_ids: tagIds }),
  removeFromPhoto: (photoId: number, tagId: number) => 
    api.delete(`/api/archive/tags/photo/${photoId}/${tagId}`),
  getPhotoTags: (photoId: number) => api.get(`/api/archive/tags/photo/${photoId}`),
  getPhotosByTag: (tagId: number, skip?: number, limit?: number) => 
    api.get(`/api/archive/tags/${tagId}/photos`, { params: { skip, limit } }),
  getStats: () => api.get('/api/archive/tags/stats'),
  batchTag: (photoIds: number[], tagIds: number[]) => 
    api.post('/api/archive/tags/batch', { photo_ids: photoIds, tag_ids: tagIds }),
  autoTagByFilmType: () => api.post('/api/archive/tags/auto/film-type'),
  autoTagByCamera: () => api.post('/api/archive/tags/auto/camera')
};

export default api;
