import request from '@/utils/request'

export function getDisassembleSteps(furnitureId) {
  return request({
    url: `/teaching/steps/${furnitureId}`,
    method: 'get'
  })
}

export function getDisassembleStep(furnitureId, stepNumber) {
  return request({
    url: `/teaching/steps/${furnitureId}/${stepNumber}`,
    method: 'get'
  })
}

export function createStep(data) {
  return request({
    url: '/teaching/steps',
    method: 'post',
    data
  })
}
