import request from '@/utils/request'

export function getUserProgress() {
  return request({
    url: '/user/progress',
    method: 'get'
  })
}

export function startLearning(furnitureId) {
  return request({
    url: `/user/progress/start/${furnitureId}`,
    method: 'post'
  })
}

export function updateProgress(data) {
  return request({
    url: '/user/progress/update',
    method: 'put',
    data
  })
}

export function updateProgressAsync(data) {
  return request({
    url: '/user/progress/update-async',
    method: 'put',
    data
  })
}

export function batchUpdateProgress(updates) {
  return request({
    url: '/user/progress/batch-update',
    method: 'put',
    data: updates
  })
}
