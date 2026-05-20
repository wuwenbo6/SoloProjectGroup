import request from './request'

export const authApi = {
  login: (data: { username: string; password: string }) => {
    return request.post('/auth/login', data)
  },
  register: (data: { username: string; password: string; email: string }) => {
    return request.post('/auth/register', data)
  },
  getUserInfo: () => {
    return request.get('/auth/userinfo')
  }
}

export const rubbingApi = {
  upload: (formData: FormData) => {
    return request.post('/rubbing/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  list: (params?: any) => {
    return request.get('/rubbing/list', { params })
  },
  getById: (id: number) => {
    return request.get(`/rubbing/${id}`)
  },
  delete: (id: number) => {
    return request.delete(`/rubbing/${id}`)
  }
}

export const interpretationApi = {
  recognize: (rubbingId: number) => {
    return request.post(`/interpretation/recognize/${rubbingId}`)
  },
  saveAnnotation: (data: any) => {
    return request.post('/interpretation/annotation', data)
  },
  getAnnotations: (rubbingId: number) => {
    return request.get(`/interpretation/annotations/${rubbingId}`)
  },
  getByRubbing: (rubbingId: number) => {
    return request.get(`/interpretation/rubbing/${rubbingId}`)
  }
}

export const comparisonApi = {
  compare: (interpretationIds: number[], page = 0, size = 20) => {
    return request.post(`/comparison/compare?page=${page}&size=${size}`, { interpretationIds })
  },
  getHistory: (page = 0, size = 10) => {
    return request.get(`/comparison/history?page=${page}&size=${size}`)
  }
}

export const dictionaryApi = {
  lookup: (character: string) => {
    return request.get(`/dictionary/lookup/${character}`)
  },
  lookupBatch: (characters: string[]) => {
    return request.post('/dictionary/lookup/batch', characters)
  },
  searchByPinyin: (pinyin: string) => {
    return request.get(`/dictionary/search/pinyin?pinyin=${pinyin}`)
  },
  searchByRadical: (radical: string) => {
    return request.get(`/dictionary/search/radical?radical=${radical}`)
  },
  search: (keyword: string) => {
    return request.get(`/dictionary/search?keyword=${keyword}`)
  }
}
