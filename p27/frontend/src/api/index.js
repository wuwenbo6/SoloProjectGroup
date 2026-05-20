import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 300000
})

export const uploadDocument = (file, onUploadProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress
  })
}

export const uploadRevisedVersion = (originalDocumentId, file, onUploadProgress) => {
  const formData = new FormData()
  formData.append('original_document_id', originalDocumentId)
  formData.append('file', file)
  return api.post('/version/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress
  })
}

export const queryDocument = (query, documentId = null) => {
  return api.post('/query', {
    query,
    document_id: documentId
  })
}

export const getDocuments = () => {
  return api.get('/documents')
}

export const deleteDocument = (documentId) => {
  return api.delete(`/documents/${documentId}`)
}

export const compareDocuments = (originalDocumentId, revisedDocumentId) => {
  const formData = new FormData()
  formData.append('original_document_id', originalDocumentId)
  formData.append('revised_document_id', revisedDocumentId)
  return api.post('/documents/compare', formData)
}

export const getDiffStatistics = (originalDocumentId, revisedDocumentId) => {
  const formData = new FormData()
  formData.append('original_document_id', originalDocumentId)
  formData.append('revised_document_id', revisedDocumentId)
  return api.post('/documents/compare/statistics', formData)
}

export const exportDiffReport = (originalDocumentId, revisedDocumentId, format = 'json') => {
  const formData = new FormData()
  formData.append('original_document_id', originalDocumentId)
  formData.append('revised_document_id', revisedDocumentId)
  formData.append('format', format)
  return api.post('/documents/compare/export', formData, {
    responseType: format === 'html' ? 'blob' : 'json'
  })
}

export const submitFeedback = (feedback) => {
  return api.post('/feedback/submit', feedback)
}

export const getDocumentFeedback = (documentId) => {
  return api.get(`/feedback/document/${documentId}`)
}

export const getPendingFeedback = (limit = 100) => {
  return api.get(`/feedback/pending?limit=${limit}`)
}

export const getFeedbackStats = () => {
  return api.get('/feedback/stats')
}

export const approveFeedback = (feedbackId) => {
  return api.post(`/feedback/${feedbackId}/approve`)
}

export const rejectFeedback = (feedbackId) => {
  return api.post(`/feedback/${feedbackId}/reject`)
}

export const deleteFeedback = (feedbackId) => {
  return api.delete(`/feedback/${feedbackId}`)
}

export const triggerFinetuning = () => {
  return api.post('/training/finetune')
}

export const getTrainingSuggestions = (documentId) => {
  return api.get(`/training/suggestions/${documentId}`)
}

export const exportTrainingDataset = () => {
  return api.post('/training/export')
}

export const checkHealth = () => {
  return api.get('/health')
}

export default api
