import request from '../utils/request'

export const generateTraceCode = (batchNo) => {
  return request({
    url: '/trace/generate',
    method: 'post',
    data: { batchNo }
  })
}

export const verifyTraceCode = (traceCode) => {
  return request({
    url: `/trace/verify/${traceCode}`,
    method: 'get'
  })
}

export const getTraceList = (params) => {
  return request({
    url: '/trace/list',
    method: 'get',
    params
  })
}
