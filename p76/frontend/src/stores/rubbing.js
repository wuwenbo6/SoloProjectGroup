import { defineStore } from 'pinia'
import { ref } from 'vue'
import request from '@/utils/request'

export const useRubbingStore = defineStore('rubbing', () => {
  const progress = ref({
    current: 0,
    total: 100,
    status: 'idle',
    estimatedTime: 0
  })

  const imageQuality = ref({
    resolution: { width: 0, height: 0 },
    sharpness: 0,
    contrast: 0,
    noise: 0,
    score: 0
  })

  const parameters = ref({
    resolution: '400 DPI',
    colorDepth: '24位',
    scanMode: '灰度',
    brightness: 50,
    contrast: 50,
    threshold: 128,
    sharpness: 50,
    noiseLevel: 5
  })

  const currentImage = ref(null)
  const historyList = ref([])
  const realtimeLogs = ref([])

  const updateProgress = (data) => {
    progress.value = { ...progress.value, ...data }
  }

  const updateImageQuality = (data) => {
    imageQuality.value = { ...imageQuality.value, ...data }
  }

  const updateParameters = (data) => {
    parameters.value = { ...parameters.value, ...data }
  }

  const addLog = (log) => {
    realtimeLogs.value.unshift({
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      ...log
    })
    if (realtimeLogs.value.length > 50) {
      realtimeLogs.value.pop()
    }
  }

  const startCapture = async () => {
    return await request.post('/rubbing/start')
  }

  const stopCapture = async () => {
    return await request.post('/rubbing/stop')
  }

  const fetchHistory = async (params) => {
    const res = await request.get('/rubbing/history', { params })
    historyList.value = res.data || []
    return res
  }

  const getArchiveList = async (params) => {
    return await request.get('/rubbing/archive', { params })
  }

  const updateArchiveLevel = async (id, level) => {
    return await request.put(`/rubbing/archive/${id}/level`, { level })
  }

  const saveParameters = async (params) => {
    return await request.post('/rubbing/parameters', params)
  }

  const enhanceImage = async (type, intensity) => {
    return await request.post('/rubbing/image/enhance', { type, intensity })
  }

  const exportExcel = async (params) => {
    return await request.get('/rubbing/export/excel', {
      params,
      responseType: 'blob'
    })
  }

  const exportCSV = async (params) => {
    return await request.get('/rubbing/export/csv', {
      params,
      responseType: 'blob'
    })
  }

  const getAlertHistory = async () => {
    return await request.get('/rubbing/alerts/history')
  }

  const getThresholds = async () => {
    return await request.get('/rubbing/alerts/thresholds')
  }

  return {
    progress,
    imageQuality,
    parameters,
    currentImage,
    historyList,
    realtimeLogs,
    updateProgress,
    updateImageQuality,
    updateParameters,
    addLog,
    startCapture,
    stopCapture,
    fetchHistory,
    getArchiveList,
    updateArchiveLevel,
    saveParameters,
    enhanceImage,
    exportExcel,
    exportCSV,
    getAlertHistory,
    getThresholds
  }
})
