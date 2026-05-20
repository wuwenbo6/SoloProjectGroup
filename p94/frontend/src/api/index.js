import request from '../utils/request'

export const userApi = {
  login(data) {
    return request({
      url: '/users/login',
      method: 'post',
      data
    })
  },
  list() {
    return request({
      url: '/users',
      method: 'get'
    })
  }
}

export const propApi = {
  list(params) {
    return request({
      url: '/props',
      method: 'get',
      params
    })
  },
  get(id) {
    return request({
      url: `/props/${id}`,
      method: 'get'
    })
  },
  create(data) {
    return request({
      url: '/props',
      method: 'post',
      data
    })
  },
  update(id, data) {
    return request({
      url: `/props/${id}`,
      method: 'put',
      data
    })
  },
  delete(id) {
    return request({
      url: `/props/${id}`,
      method: 'delete'
    })
  },
  uploadImage(file) {
    const formData = new FormData()
    formData.append('file', file)
    return request({
      url: '/props/upload',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },
  getByCollector(collectorId) {
    return request({
      url: `/props/collector/${collectorId}`,
      method: 'get'
    })
  }
}

export const craftApi = {
  list(params) {
    return request({
      url: '/crafts',
      method: 'get',
      params
    })
  },
  get(id) {
    return request({
      url: `/crafts/${id}`,
      method: 'get'
    })
  },
  create(data) {
    return request({
      url: '/crafts',
      method: 'post',
      data
    })
  },
  update(id, data) {
    return request({
      url: `/crafts/${id}`,
      method: 'put',
      data
    })
  },
  delete(id) {
    return request({
      url: `/crafts/${id}`,
      method: 'delete'
    })
  }
}

export const craftStepApi = {
  list(craftId) {
    return request({
      url: `/craft-steps/craft/${craftId}`,
      method: 'get'
    })
  },
  create(data) {
    return request({
      url: '/craft-steps',
      method: 'post',
      data
    })
  },
  update(id, data) {
    return request({
      url: `/craft-steps/${id}`,
      method: 'put',
      data
    })
  },
  delete(id) {
    return request({
      url: `/craft-steps/${id}`,
      method: 'delete'
    })
  },
  batchSave(craftId, data) {
    return request({
      url: `/craft-steps/batch/${craftId}`,
      method: 'post',
      data
    })
  }
}

export const propSearchApi = {
  searchSimilar(id) {
    return request({
      url: `/props/${id}/similar`,
      method: 'get'
    })
  }
}
