import request from '../utils/request'

export const startProcess = (data) => {
  return request({
    url: '/process/start',
    method: 'post',
    data
  })
}

export const completeProcess = (id, params) => {
  return request({
    url: `/process/complete/${id}`,
    method: 'put',
    data: { parameters: params }
  })
}

export const getProcessList = (params) => {
  return request({
    url: '/process/list',
    method: 'get',
    params
  })
}

export const getProcessNodes = () => {
  return request({
    url: '/process/nodes',
    method: 'get'
  })
}

export const getAbnormalList = () => {
  return request({
    url: '/process/abnormal',
    method: 'get'
  })
}
