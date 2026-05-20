import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const equipmentApi = {
  getList: () => api.get('/equipment'),
  getDetail: (id) => api.get(`/equipment/${id}`),
  getParts: (id) => api.get(`/equipment/${id}/parts`),
  getDamageMarks: (id) => api.get(`/equipment/${id}/damage-marks`),
  save: (data) => api.post('/equipment', data),
  update: (data) => api.put('/equipment', data),
  delete: (id) => api.delete(`/equipment/${id}`),
  search: (keyword, type) => api.get('/equipment/search', { params: { keyword, type } })
}

export const archiveApi = {
  getList: () => api.get('/archive'),
  getByEquipment: (equipmentId) => api.get(`/archive/equipment/${equipmentId}`),
  getByType: (type) => api.get(`/archive/type/${type}`),
  save: (data) => api.post('/archive', data),
  update: (data) => api.put('/archive', data),
  delete: (id) => api.delete(`/archive/${id}`)
}

export const restorationApi = {
  getPlans: () => api.get('/restoration/plans'),
  getPlansByEquipment: (equipmentId) => api.get(`/restoration/plans/equipment/${equipmentId}`),
  getProgressByPlan: (planId) => api.get(`/restoration/progress/plan/${planId}`),
  savePlan: (data) => api.post('/restoration/plans', data),
  updatePlan: (data) => api.put('/restoration/plans', data),
  deletePlan: (id) => api.delete(`/restoration/plans/${id}`)
}

export default api
