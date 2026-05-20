const API_BASE = '/api/v1'

function getHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

async function request(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers
      }
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '请求失败' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }
    
    return response.json()
  } catch (error) {
    console.error('API 请求错误:', error)
    throw error
  }
}

export const auth = {
  login: (username, password) => 
    request('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  
  register: (userData) =>
    request('/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
  
  getCurrentUser: () => request('/users/me'),
  
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }
}

export const audio = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/audio?${query}`)
  },
  
  get: (id) => request(`/audio/${id}`),
  
  checkUpload: (fileId) => request(`/audio/check-upload?fileId=${fileId}`),
  
  uploadChunk: async (formData) => {
    const token = localStorage.getItem('token')
    const response = await fetch(`${API_BASE}/audio/upload-chunk`, {
      method: 'POST',
      body: formData,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '上传失败' }))
      throw new Error(error.detail || 'Chunk upload failed')
    }
    return response.json()
  },
  
  completeUpload: (data) => request('/audio/complete-upload', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  upload: async (file, metadata = {}) => {
    const formData = new FormData()
    formData.append('file', file)
    Object.entries(metadata).forEach(([key, value]) => {
      if (value) formData.append(key, value)
    })
    
    const token = localStorage.getItem('token')
    const response = await fetch(`${API_BASE}/audio/upload`, {
      method: 'POST',
      body: formData,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    
    if (!response.ok) throw new Error('上传失败')
    return response.json()
  },
  
  getStreamUrl: (id) => `${API_BASE}/audio/${id}/stream`,
  
  segment: (audioSampleId, startTime, endTime) =>
    request('/audio/segment', {
      method: 'POST',
      body: JSON.stringify({ audioSampleId, startTime, endTime })
    }),
  
  delete: (id) =>
    request(`/audio/${id}`, { method: 'DELETE' })
}

export const dialects = {
  getAllCategories: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/dialects/categories?${query}`)
  },
  
  createCategory: (data) =>
    request('/dialects/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  getSimilar: (sampleId) =>
    request(`/dialects/similar/${sampleId}`),
  
  classify: (sampleId) =>
    request(`/dialects/classify/${sampleId}`, { method: 'POST' }),
  
  runClustering: (type = 'kmeans', params = {}) =>
    request(`/dialects/clusters/${type}`, {
      method: 'POST',
      body: JSON.stringify(params)
    })
}

export const tasks = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/tasks?${query}`)
  },
  
  getAvailable: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/tasks/available?${query}`)
  },
  
  get: (id) => request(`/tasks/${id}`),
  
  create: (data) =>
    request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  claim: (taskId) =>
    request('/tasks/claim', {
      method: 'POST',
      body: JSON.stringify({ taskId })
    }),
  
  release: (taskId) =>
    request('/tasks/release', {
      method: 'POST',
      body: JSON.stringify({ taskId })
    }),
  
  start: (taskId) =>
    request(`/tasks/${taskId}/start`, { method: 'POST' }),
  
  delete: (id) =>
    request(`/tasks/${id}`, { method: 'DELETE' })
}

export const annotations = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/annotations?${query}`)
  },
  
  get: (id) => request(`/annotations/${id}`),
  
  create: (data) =>
    request('/annotations', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  update: (id, data) =>
    request(`/annotations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  
  submit: (id) =>
    request(`/annotations/${id}/submit`, { method: 'POST' }),
  
  review: (id, data) =>
    request(`/annotations/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  getStats: () => request('/annotations/stats/summary')
}

export const correction = {
  batchCorrect: (data) =>
    request('/correction/batch', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  getRules: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/correction/rules?${query}`)
  },
  
  applyRule: (data) =>
    request('/correction/apply-rule', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  findErrors: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/correction/find-errors?${query}`)
  },
  
  rejectBatch: (data) =>
    request('/correction/reject-batch', {
      method: 'POST',
      body: JSON.stringify(data)
    })
}

export const dialectTree = {
  getTree: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/dialect-tree/tree?${query}`)
  },
  
  getStats: () => request('/dialect-tree/stats'),
  
  search: (query) => request(`/dialect-tree/search?query=${query}`),
  
  getPath: (categoryId) => request(`/dialect-tree/path/${categoryId}`),
  
  getCategorySamples: (categoryId, params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/dialect-tree/${categoryId}/samples?${query}`)
  }
}

export const pronunciation = {
  setStandard: (sampleId, formData) =>
    fetch(`${API_BASE}/pronunciation/set-standard/${sampleId}`, {
      method: 'POST',
      body: formData,
      headers: getAuthHeaders()
    }).then(r => r.json()),
  
  compare: (sampleId) => request(`/pronunciation/compare/${sampleId}`),
  
  getStandardStreamUrl: (sampleId) => `${API_BASE}/pronunciation/standard/${sampleId}/stream`,
  
  needStandard: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/pronunciation/need-standard?${query}`)
  },
  
  withStandard: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/pronunciation/with-standard?${query}`)
  },
  
  autoAssign: (params = {}) =>
    request('/pronunciation/auto-assign', {
      method: 'POST',
      body: JSON.stringify(params)
    })
}

export const users = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/users?${query}`)
  },
  
  get: (id) => request(`/users/${id}`),
  
  update: (id, data) =>
    request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  
  delete: (id) =>
    request(`/users/${id}`, { method: 'DELETE' })
}

export const translation = {
  translate: (dialectText, dialectCategoryId = null) =>
    request('/translation/translate', {
      method: 'POST',
      body: JSON.stringify({ dialect_text: dialectText, dialect_category_id: dialectCategoryId })
    }),
  
  getSimilarPhrases: (dialectCategoryId, limit = 10) =>
    request(`/translation/similar-phrases?dialect_category_id=${dialectCategoryId}&limit=${limit}`),
  
  batchSuggest: (sampleIds) =>
    request('/translation/batch-suggest', {
      method: 'POST',
      body: JSON.stringify(sampleIds)
    })
}

export const qualityCheck = {
  getPending: (skip = 0, limit = 20) =>
    request(`/quality-check/pending?skip=${skip}&limit=${limit}`),
  
  getStats: (days = 30) =>
    request(`/quality-check/stats?days=${days}`),
  
  autoSample: (sampleCount = 10) =>
    request(`/quality-check/auto-sample?sample_count=${sampleCount}`, {
      method: 'POST'
    }),
  
  submitCheck: (sampleCheckId, passed, score, comment = null) =>
    request('/quality-check/submit-check', {
      method: 'POST',
      body: JSON.stringify({ sample_check_id: sampleCheckId, passed, score, comment })
    }),
  
  batchCheck: (submissions) =>
    request('/quality-check/batch-check', {
      method: 'POST',
      body: JSON.stringify(submissions)
    }),
  
  myChecks: (skip = 0, limit = 20) =>
    request(`/quality-check/my-checks?skip=${skip}&limit=${limit}`),
  
  annotatorPerformance: (annotatorId, days = 30) =>
    request(`/quality-check/annotator-performance/${annotatorId}?days=${days}`),
  
  markChecked: (sampleIds) =>
    request('/quality-check/mark-checked', {
      method: 'POST',
      body: JSON.stringify({ sample_ids: sampleIds })
    })
}

export const research = {
  getStats: () => request('/research/stats'),
  
  getDialectDistribution: (level = null) => {
    const query = level !== null ? `?level=${level}` : ''
    return request(`/research/dialect-distribution${query}`)
  },
  
  exportCsv: (params) =>
    request('/research/export-csv', {
      method: 'POST',
      body: JSON.stringify(params)
    }),
  
  getQualityReport: (days = 30) =>
    request(`/research/quality-report?days=${days}`),
  
  getAnnotatorLeaderboard: (days = 30, limit = 10) =>
    request(`/research/annotator-leaderboard?days=${days}&limit=${limit}`),
  
  getDialectLexicon: (dialectCategoryId = null, minFrequency = 3) => {
    const params = new URLSearchParams()
    if (dialectCategoryId) params.append('dialect_category_id', dialectCategoryId)
    params.append('min_frequency', minFrequency)
    return request(`/research/dialect-lexicon?${params.toString()}`)
  }
}
