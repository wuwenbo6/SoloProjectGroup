
import SparkMD5 from 'spark-md5'

const CHUNK_SIZE = 1024 * 1024 * 5
const API_BASE = '/api/v1'

function getHeaders() {
  const token = localStorage.getItem('token')
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  }
}

export class ChunkedUploader {
  constructor(file, options = {}) {
    this.file = file
    this.chunkSize = options.chunkSize || CHUNK_SIZE
    this.onProgress = options.onProgress || (() => {})
    this.onComplete = options.onComplete || (() => {})
    this.onError = options.onError || (() => {})
    this.metadata = options.metadata || {}
    
    this.totalChunks = Math.ceil(file.size / this.chunkSize)
    this.fileId = this.generateFileId()
    this.uploadedChunks = this.loadProgress()
    this.aborted = false
  }

  generateFileId() {
    const name = this.file.name
    const size = this.file.size
    const lastModified = this.file.lastModified
    return SparkMD5.hash(`${name}-${size}-${lastModified}`)
  }

  getStorageKey() {
    return `upload_progress_${this.fileId}`
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem(this.getStorageKey())
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }

  saveProgress(chunkIndex) {
    if (!this.uploadedChunks.includes(chunkIndex)) {
      this.uploadedChunks.push(chunkIndex)
      try {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.uploadedChunks))
      } catch {}
    }
  }

  clearProgress() {
    try {
      localStorage.removeItem(this.getStorageKey())
    } catch {}
  }

  abort() {
    this.aborted = true
  }

  async calculateFileHash() {
    return new Promise((resolve) => {
      const spark = new SparkMD5.ArrayBuffer()
      const reader = new FileReader()
      reader.onload = (e) => {
        spark.append(e.target.result)
        resolve(spark.end())
      }
      reader.readAsArrayBuffer(this.file.slice(0, Math.min(this.chunkSize, this.file.size)))
    })
  }

  async uploadChunk(chunkIndex, signal) {
    if (this.aborted) throw new Error('Upload aborted')
    
    const start = chunkIndex * this.chunkSize
    const end = Math.min(start + this.chunkSize, this.file.size)
    const chunk = this.file.slice(start, end)
    
    const formData = new FormData()
    formData.append('fileId', this.fileId)
    formData.append('chunkIndex', chunkIndex)
    formData.append('totalChunks', this.totalChunks)
    formData.append('filename', this.file.name)
    formData.append('chunk', chunk)
    
    Object.entries(this.metadata).forEach(([key, value]) => {
      if (value) formData.append(key, String(value))
    })
    
    const response = await fetch(`${API_BASE}/audio/upload-chunk`, {
      method: 'POST',
      body: formData,
      headers: getHeaders(),
      signal
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '上传失败' }))
      throw new Error(error.detail || `Chunk upload failed: HTTP ${response.status}`)
    }
    
    this.saveProgress(chunkIndex)
    this.onProgress(this.uploadedChunks.length / this.totalChunks)
    
    return response.json()
  }

  async upload() {
    const controller = new AbortController()
    
    try {
      const checkResponse = await fetch(`${API_BASE}/audio/check-upload?fileId=${this.fileId}`, {
        headers: getHeaders(),
        signal: controller.signal
      })
      
      if (checkResponse.ok) {
        const checkData = await checkResponse.json()
        if (checkData.completed) {
          this.onProgress(1)
          this.clearProgress()
          this.onComplete(checkData.sample)
          return checkData.sample
        }
        
        if (checkData.uploadedChunks) {
          this.uploadedChunks = [...new Set([...this.uploadedChunks, ...checkData.uploadedChunks])]
          this.onProgress(this.uploadedChunks.length / this.totalChunks)
        }
      }
      
      const pendingChunks = []
      for (let i = 0; i < this.totalChunks; i++) {
        if (!this.uploadedChunks.includes(i)) {
          pendingChunks.push(i)
        }
      }
      
      const concurrency = 3
      for (let i = 0; i < pendingChunks.length; i += concurrency) {
        if (this.aborted) throw new Error('Upload aborted')
        
        const batch = pendingChunks.slice(i, i + concurrency)
        await Promise.all(
          batch.map(chunkIndex => this.uploadChunk(chunkIndex, controller.signal))
        )
      }
      
      const completeResponse = await fetch(`${API_BASE}/audio/complete-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders()
        },
        body: JSON.stringify({
          fileId: this.fileId,
          filename: this.file.name,
          totalChunks: this.totalChunks,
          ...this.metadata
        }),
        signal: controller.signal
      })
      
      if (!completeResponse.ok) {
        const error = await completeResponse.json().catch(() => ({ detail: '合并文件失败' }))
        throw new Error(error.detail || 'Complete upload failed')
      }
      
      const result = await completeResponse.json()
      this.clearProgress()
      this.onComplete(result)
      return result
      
    } catch (error) {
      controller.abort()
      this.onError(error)
      throw error
    }
  }
}

export function getUploadProgress(file) {
  const uploader = new ChunkedUploader(file)
  return uploader.loadProgress()
}

export function clearUploadProgress(file) {
  const uploader = new ChunkedUploader(file)
  uploader.clearProgress()
}
