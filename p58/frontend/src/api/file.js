import request from '../utils/request'
import ChunkUploader from '../utils/chunkUpload'

export const uploadFile = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploader = new ChunkUploader({
      file,
      batchNo: options.batchNo,
      processCode: options.processCode,
      onProgress: options.onProgress,
      onSuccess: resolve,
      onError: reject
    })
    uploader.upload()
  })
}

export const getFileList = (params) => {
  return request({
    url: '/file/list',
    method: 'get',
    params
  })
}
