import request from '@/utils/request'

export const furnitureApi = {
  list: () => request.get('/furniture/list'),
  getById: (id) => request.get(`/furniture/${id}`),
  save: (data) => request.post('/furniture/save', data),
  update: (data) => request.put('/furniture/update', data),
  delete: (id) => request.delete(`/furniture/${id}`),
  upload: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return request.post('/furniture/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  getByCategory: (category) => request.get(`/furniture/category/${category}`)
}

export const mortiseApi = {
  list: () => request.get('/mortise/list'),
  getById: (id) => request.get(`/mortise/${id}`),
  getByFurnitureId: (furnitureId) => request.get(`/mortise/furniture/${furnitureId}`),
  save: (data) => request.post('/mortise/save', data),
  update: (data) => request.put('/mortise/update', data),
  delete: (id) => request.delete(`/mortise/${id}`)
}

export const craftApi = {
  list: () => request.get('/craft/list'),
  getById: (id) => request.get(`/craft/${id}`),
  getByFurnitureId: (furnitureId, includeContent = false, lang = 'zh') => request.get(`/craft/furniture/${furnitureId}`, { params: { includeContent, lang } }),
  getByFurnitureIdPage: (furnitureId, page, pageSize) => request.get(`/craft/furniture/${furnitureId}/page`, { params: { page, pageSize } }),
  getByMortiseId: (mortiseId) => request.get(`/craft/mortise/${mortiseId}`),
  save: (data) => request.post('/craft/save', data),
  update: (data) => request.put('/craft/update', data),
  delete: (id) => request.delete(`/craft/${id}`)
}

export const disassemblyApi = {
  getByFurnitureId: (furnitureId) => request.get(`/disassembly/furniture/${furnitureId}`),
  getById: (id) => request.get(`/disassembly/${id}`),
  save: (data) => request.post('/disassembly/save', data),
  update: (data) => request.put('/disassembly/update', data),
  batchSave: (furnitureId, steps) => request.post(`/disassembly/batch/${furnitureId}`, steps),
  delete: (id) => request.delete(`/disassembly/${id}`)
}

export const similarityApi = {
  findSimilar: (furnitureId, topN = 10) => request.get(`/similarity/furniture/${furnitureId}`, { params: { topN } }),
  extractFeatures: (furnitureId) => request.post(`/similarity/extract/${furnitureId}`),
  getFeatures: (furnitureId) => request.get(`/similarity/feature/${furnitureId}`),
  clearCache: () => request.post('/similarity/clear-cache')
}
