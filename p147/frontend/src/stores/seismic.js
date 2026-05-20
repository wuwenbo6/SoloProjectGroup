import { defineStore } from 'pinia'
import axios from 'axios'

export const useSeismicStore = defineStore('seismic', {
  state: () => ({
    files: [],
    currentFile: null,
    currentVolume: null,
    inlines: [],
    crosslines: [],
    histogram: null,
    annotations: [],
    selectedFiles: [],
    loading: false
  }),

  actions: {
    async fetchFiles() {
      this.loading = true
      try {
        const response = await axios.get('/api/files')
        this.files = response.data
      } catch (error) {
        console.error('获取文件列表失败:', error)
      } finally {
        this.loading = false
      }
    },

    async uploadFile(file, description = '') {
      this.loading = true
      const formData = new FormData()
      formData.append('file', file)
      formData.append('description', description)
      
      try {
        const response = await axios.post('/api/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        await this.fetchFiles()
        return response.data
      } catch (error) {
        console.error('上传文件失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async selectFile(fileId) {
      this.loading = true
      try {
        const response = await axios.get(`/api/files/${fileId}`)
        this.currentFile = response.data.file
        this.inlines = response.data.inlines
        this.crosslines = response.data.crosslines
        await this.fetchAnnotations(fileId)
      } catch (error) {
        console.error('获取文件信息失败:', error)
      } finally {
        this.loading = false
      }
    },

    async fetchHistogram(fileId, bins = 100) {
      try {
        const response = await axios.get(`/api/files/${fileId}/histogram`, {
          params: { bins }
        })
        this.histogram = response.data
      } catch (error) {
        console.error('获取直方图失败:', error)
      }
    },

    async getSlice(fileId, sliceType, index) {
      try {
        const response = await axios.get(`/api/files/${fileId}/slices/${sliceType}`, {
          params: { index }
        })
        return response.data
      } catch (error) {
        console.error('获取切片失败:', error)
        throw error
      }
    },

    async getVolumeData(fileId) {
      try {
        const response = await axios.get(`/api/files/${fileId}/volume`)
        this.currentVolume = response.data
        return response.data
      } catch (error) {
        console.error('获取体数据失败:', error)
        throw error
      }
    },

    async deleteFile(fileId) {
      try {
        await axios.delete(`/api/files/${fileId}`)
        if (this.currentFile?.id === fileId) {
          this.currentFile = null
          this.currentVolume = null
        }
        await this.fetchFiles()
      } catch (error) {
        console.error('删除文件失败:', error)
        throw error
      }
    },

    async createAnnotation(annotation) {
      try {
        const response = await axios.post('/api/annotations', annotation)
        await this.fetchAnnotations(annotation.segy_file_id)
        return response.data
      } catch (error) {
        console.error('创建标注失败:', error)
        throw error
      }
    },

    async fetchAnnotations(fileId) {
      try {
        const response = await axios.get(`/api/annotations/${fileId}`)
        this.annotations = response.data
      } catch (error) {
        console.error('获取标注失败:', error)
      }
    },

    async deleteAnnotation(annotationId) {
      try {
        await axios.delete(`/api/annotations/${annotationId}`)
        if (this.currentFile) {
          await this.fetchAnnotations(this.currentFile.id)
        }
      } catch (error) {
        console.error('删除标注失败:', error)
        throw error
      }
    },

    async compareFiles(fileIds) {
      try {
        const response = await axios.get(`/api/files/compare/${fileIds.join(',')}`)
        return response.data
      } catch (error) {
        console.error('对比文件失败:', error)
        throw error
      }
    },

    toggleFileSelection(fileId) {
      const index = this.selectedFiles.indexOf(fileId)
      if (index === -1) {
        this.selectedFiles.push(fileId)
      } else {
        this.selectedFiles.splice(index, 1)
      }
    },

    async detectFaults(fileId, params) {
      try {
        const response = await axios.get(`/api/files/${fileId}/analysis/fault-detection`, {
          params
        })
        return response.data
      } catch (error) {
        console.error('断层检测失败:', error)
        throw error
      }
    },

    async trackHorizon(fileId, sliceType, sliceIndex, seedPoints, similarityThreshold) {
      try {
        const response = await axios.post(`/api/files/${fileId}/analysis/horizon-tracking`, seedPoints, {
          params: {
            slice_type: sliceType,
            slice_index: sliceIndex,
            similarity_threshold: similarityThreshold
          }
        })
        return response.data
      } catch (error) {
        console.error('地层追踪失败:', error)
        throw error
      }
    },

    async exportGeotiff(fileId, sliceType, sliceIndex) {
      try {
        const response = await axios.post(`/api/files/${fileId}/export/geotiff`, null, {
          params: {
            slice_type: sliceType,
            slice_index: sliceIndex
          }
        })
        return response.data
      } catch (error) {
        console.error('导出GeoTIFF失败:', error)
        throw error
      }
    }
  }
})
