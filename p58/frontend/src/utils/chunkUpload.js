import SparkMD5 from 'spark-md5'
import request from './request'

const CHUNK_SIZE = 5 * 1024 * 1024
const CONCURRENCY = 3

export default class ChunkUploader {
  constructor(options) {
    this.file = options.file
    this.batchNo = options.batchNo
    this.processCode = options.processCode
    this.chunkSize = options.chunkSize || CHUNK_SIZE
    this.concurrency = options.concurrency || CONCURRENCY
    this.onProgress = options.onProgress || (() => {})
    this.onSuccess = options.onSuccess || (() => {})
    this.onError = options.onError || (() => {})
    this.fileId = null
    this.totalChunks = 0
    this.uploadedChunks = new Set()
    this.aborted = false
  }

  async upload() {
    try {
      this.fileId = await this.calculateFileId()
      this.totalChunks = Math.ceil(this.file.size / this.chunkSize)

      const checkResult = await this.checkChunks()
      if (checkResult.skipUpload) {
        this.onProgress(100)
        const mergeResult = await this.mergeChunks()
        this.onSuccess(mergeResult)
        return mergeResult
      }

      this.uploadedChunks = new Set(checkResult.uploadedChunks || [])
      this.updateProgress()

      await this.uploadChunks()
      const mergeResult = await this.mergeChunks()
      this.onSuccess(mergeResult)
      return mergeResult
    } catch (error) {
      this.onError(error)
      throw error
    }
  }

  calculateFileId() {
    return new Promise((resolve, reject) => {
      const spark = new SparkMD5.ArrayBuffer()
      const fileReader = new FileReader()
      const chunkSize = 2 * 1024 * 1024
      const chunks = Math.ceil(this.file.size / chunkSize)
      let currentChunk = 0

      const loadNext = () => {
        const start = currentChunk * chunkSize
        const end = Math.min(start + chunkSize, this.file.size)
        fileReader.readAsArrayBuffer(this.file.slice(start, end))
      }

      fileReader.onload = (e) => {
        spark.append(e.target.result)
        currentChunk++
        if (currentChunk < chunks) {
          loadNext()
        } else {
          const hash = spark.end()
          resolve(`${hash}_${this.file.lastModified}_${this.file.size}`)
        }
      }

      fileReader.onerror = () => {
        reject(new Error('文件读取失败'))
      }

      loadNext()
    })
  }

  async checkChunks() {
    const response = await request({
      url: '/file/check-chunk',
      method: 'get',
      params: {
        fileId: this.fileId,
        fileName: this.file.name
      }
    })
    return response.data
  }

  async uploadChunks() {
    const chunks = []
    for (let i = 0; i < this.totalChunks; i++) {
      if (!this.uploadedChunks.has(i)) {
        chunks.push(i)
      }
    }

    if (chunks.length === 0) {
      return
    }

    const uploading = new Set()
    let index = 0

    return new Promise((resolve, reject) => {
      const uploadNext = async () => {
        if (this.aborted) {
          reject(new Error('上传已取消'))
          return
        }

        if (index >= chunks.length) {
          if (uploading.size === 0) {
            resolve()
          }
          return
        }

        const chunkIndex = chunks[index++]
        uploading.add(chunkIndex)

        try {
          await this.uploadSingleChunk(chunkIndex)
          this.uploadedChunks.add(chunkIndex)
          this.updateProgress()
        } catch (error) {
          console.error(`分片 ${chunkIndex} 上传失败，重试`, error)
          chunks.push(chunkIndex)
        } finally {
          uploading.delete(chunkIndex)
          uploadNext()
        }
      }

      for (let i = 0; i < this.concurrency; i++) {
        uploadNext()
      }
    })
  }

  async uploadSingleChunk(chunkIndex) {
    const start = chunkIndex * this.chunkSize
    const end = Math.min(start + this.chunkSize, this.file.size)
    const chunk = this.file.slice(start, end)

    const formData = new FormData()
    formData.append('file', chunk)
    formData.append('fileId', this.fileId)
    formData.append('chunkNumber', chunkIndex)
    formData.append('chunkSize', this.chunkSize)
    formData.append('totalSize', this.file.size)
    formData.append('totalChunks', this.totalChunks)
    formData.append('fileName', this.file.name)
    formData.append('contentType', this.file.type)
    if (this.batchNo) formData.append('batchNo', this.batchNo)
    if (this.processCode) formData.append('processCode', this.processCode)

    const response = await request({
      url: '/file/upload-chunk',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    return response.data
  }

  async mergeChunks() {
    const response = await request({
      url: '/file/merge-chunks',
      method: 'post',
      data: {
        fileId: this.fileId,
        fileName: this.file.name
      }
    })
    return response.data
  }

  updateProgress() {
    const progress = Math.round((this.uploadedChunks.size / this.totalChunks) * 100)
    this.onProgress(progress, this.uploadedChunks.size, this.totalChunks)
  }

  abort() {
    this.aborted = true
  }
}
