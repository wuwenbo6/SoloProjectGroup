import request from '@/utils/request'

export function uploadVideo(file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)

  return request({
    url: '/upload/video',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: onProgress
  })
}

export function uploadImage(file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)

  return request({
    url: '/upload/image',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: onProgress
  })
}

export function getSupportedFormats() {
  return request({
    url: '/upload/supported-formats',
    method: 'get'
  })
}
