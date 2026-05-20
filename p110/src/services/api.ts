import { LoginRequest, LoginResponse, User, Image, TextBlock, Project, Version, Annotation, VariantCharacter } from '../../shared/types';

const API_BASE = '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  return response.json();
}

export const authAPI = {
  login: (data: LoginRequest): Promise<LoginResponse> =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  logout: (): Promise<{ message: string }> =>
    request('/auth/logout', { method: 'POST' }),
};

export const projectAPI = {
  getAll: (): Promise<Project[]> => request('/projects'),
  getById: (id: string): Promise<Project> => request(`/projects/${id}`),
  create: (data: { name: string; description?: string }): Promise<Project> =>
    request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMembers: (id: string): Promise<any[]> => request(`/projects/${id}/members`),
};

export const imageAPI = {
  getAll: (projectId?: string): Promise<Image[]> =>
    request(`/images${projectId ? `?projectId=${projectId}` : ''}`),
  getById: (id: string): Promise<Image> => request(`/images/${id}`),
  upload: (formData: FormData): Promise<Image> => {
    const token = localStorage.getItem('token');
    return fetch(`${API_BASE}/images`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then((res) => res.json());
  },
  segment: (id: string): Promise<TextBlock[]> =>
    request(`/images/${id}/segment`, { method: 'POST' }),
  getBlocks: (id: string): Promise<TextBlock[]> => request(`/images/${id}/blocks`),
  updateBlock: (blockId: string, data: { correctedText?: string; status?: string }): Promise<TextBlock> =>
    request(`/images/blocks/${blockId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

export const versionAPI = {
  getByImage: (imageId: string): Promise<Version[]> => request(`/versions/image/${imageId}`),
  getById: (id: string): Promise<Version> => request(`/versions/${id}`),
  create: (imageId: string, data: { comment?: string; data: TextBlock[] }): Promise<Version> =>
    request(`/versions/image/${imageId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  rollback: (id: string): Promise<Version> =>
    request(`/versions/${id}/rollback`, { method: 'POST' }),
};

export const variantAPI = {
  getAll: (standard_char?: string, variant_char?: string): Promise<VariantCharacter[]> =>
    request(`/variants${standard_char || variant_char ? `?${new URLSearchParams({ standard_char: standard_char || '', variant_char: variant_char || '' })}` : ''}`),
  match: (text: string): Promise<any[]> =>
    request('/variants/match', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  create: (data: { standard_char: string; variant_char: string; category?: string; source?: string; description?: string }): Promise<VariantCharacter> =>
    request('/variants', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id: string): Promise<{ success: boolean }> =>
    request(`/variants/${id}`, { method: 'DELETE' }),
};

export const annotationAPI = {
  getByImage: (imageId: string, blockId?: string): Promise<Annotation[]> =>
    request(`/annotations/image/${imageId}${blockId ? `?block_id=${blockId}` : ''}`),
  create: (data: Partial<Annotation>): Promise<Annotation> =>
    request('/annotations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Annotation>): Promise<Annotation> =>
    request(`/annotations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string): Promise<{ success: boolean }> =>
    request(`/annotations/${id}`, { method: 'DELETE' }),
  punctuate: (text: string): Promise<{ original: string; punctuated: string; suggestions: any[] }> =>
    request('/annotations/punctuate', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  getPunctuationRules: (): Promise<any[]> => request('/annotations/punctuation-rules'),
  export: (imageId: string, format: 'json' | 'csv' | 'text'): Promise<Blob> =>
    fetch(`${API_BASE}/annotations/export/${imageId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ format }),
    }).then((res) => res.blob()),
};

export const syncAPI = {
  getQueue: (userId: string, status?: string): Promise<any[]> =>
    request(`/sync/queue/${userId}${status ? `?status=${status}` : ''}`),
  addToQueue: (data: { user_id: string; operation_type: string; entity_type: string; entity_id: string; data: any }): Promise<any> =>
    request('/sync/queue', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sync: (userId: string, items: any[]): Promise<any> =>
    request('/sync/sync', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, items }),
    }),
  getFullSyncData: (userId: string): Promise<any> =>
    request(`/sync/full-sync-data/${userId}`),
  clearQueue: (userId: string, status?: string): Promise<{ success: boolean }> =>
    request(`/sync/queue/clear/${userId}${status ? `?status=${status}` : ''}`, { method: 'DELETE' }),
};
