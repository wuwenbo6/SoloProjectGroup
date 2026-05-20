import request from '../utils/request'

export const createQualityReport = (data) => {
  return request({
    url: '/quality/report',
    method: 'post',
    data
  })
}

export const getQualityReportList = (params) => {
  return request({
    url: '/quality/list',
    method: 'get',
    params
  })
}

export const getQualityReportById = (id) => {
  return request({
    url: `/quality/report/${id}`,
    method: 'get'
  })
}
