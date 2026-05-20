const API_BASE = '/api';

const request = async (url, options = {}) => {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  return response.json();
};

export const userAPI = {
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  getById: (id) => request(`/users/${id}`),
  update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const craftAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/crafts${query ? `?${query}` : ''}`);
  },
  getById: (id) => request(`/crafts/${id}`),
  create: (data) => request('/crafts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/crafts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/crafts/${id}`, { method: 'DELETE' }),
  like: (id) => request(`/crafts/${id}/like`, { method: 'POST' }),
};

export const commentAPI = {
  getByCraftId: (craftId) => request(`/comments/craft/${craftId}`),
  create: (data) => request('/comments', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(`/comments/${id}`, { method: 'DELETE' }),
};

export const favoriteAPI = {
  getByUserId: (userId) => request(`/favorites/user/${userId}`),
  check: (userId, craftId) => request(`/favorites/check/${userId}/${craftId}`),
  toggle: (data) => request('/favorites/toggle', { method: 'POST', body: JSON.stringify(data) }),
};

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '上传失败');
  }
  return response.json();
};

export const qaAPI = {
  getByCraftId: (craftId) => request(`/qa/craft/${craftId}`),
  getByStep: (craftId, stepIndex) => request(`/qa/craft/${craftId}/step/${stepIndex}`),
  create: (data) => request('/qa', { method: 'POST', body: JSON.stringify(data) }),
  addAnswer: (qaId, data) => request(`/qa/${qaId}/answer`, { method: 'POST', body: JSON.stringify(data) }),
};

export const exportAPI = {
  exportJSON: (userId) => {
    window.open(`${API_BASE}/export/json/${userId}`, '_blank');
  },
  exportCSV: (userId) => {
    window.open(`${API_BASE}/export/csv/${userId}`, '_blank');
  },
  getSimilarCrafts: (id) => request(`/crafts/${id}/similar`),
};
