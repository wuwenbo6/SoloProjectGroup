import request from '@/utils/request'

export function getFurnitureList() {
  return request({
    url: '/furniture/public/list',
    method: 'get'
  })
}

export function getFurnitureDetail(id) {
  return request({
    url: `/furniture/public/${id}`,
    method: 'get'
  })
}

export function getFurnitureParts(id) {
  return request({
    url: `/furniture/public/${id}/parts`,
    method: 'get'
  })
}

export function getFurniturePartDetail(furnitureId, modelId) {
  return request({
    url: `/furniture/${furnitureId}/parts/${modelId}`,
    method: 'get'
  })
}

export function createFurniture(data) {
  return request({
    url: '/furniture',
    method: 'post',
    data
  })
}
