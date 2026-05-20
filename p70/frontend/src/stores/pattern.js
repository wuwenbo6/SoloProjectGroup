import { defineStore } from 'pinia'
import axios from 'axios'

export const usePatternStore = defineStore('pattern', {
  state: () => ({
    patterns: [],
    currentPattern: null,
    loading: false,
    totalPages: 1,
    currentPage: 1
  }),

  actions: {
    async fetchPatterns(params = {}) {
      this.loading = true
      try {
        const res = await axios.get('/api/patterns', { params })
        this.patterns = res.data.patterns
        this.totalPages = res.data.totalPages
        this.currentPage = parseInt(res.data.currentPage)
      } catch (err) {
        console.error('获取纹样列表失败:', err)
      } finally {
        this.loading = false
      }
    },

    async fetchPattern(id) {
      this.loading = true
      try {
        const res = await axios.get(`/api/patterns/${id}`)
        this.currentPattern = res.data
        return res.data
      } catch (err) {
        console.error('获取纹样详情失败:', err)
        throw err
      } finally {
        this.loading = false
      }
    },

    async createPattern(formData) {
      this.loading = true
      try {
        const res = await axios.post('/api/patterns', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        this.patterns.unshift(res.data)
        return res.data
      } catch (err) {
        console.error('创建纹样失败:', err)
        throw err
      } finally {
        this.loading = false
      }
    },

    async updatePattern(id, data) {
      try {
        const res = await axios.put(`/api/patterns/${id}`, data)
        const index = this.patterns.findIndex(p => p._id === id)
        if (index !== -1) {
          this.patterns[index] = res.data
        }
        if (this.currentPattern?._id === id) {
          this.currentPattern = res.data
        }
        return res.data
      } catch (err) {
        console.error('更新纹样失败:', err)
        throw err
      }
    },

    async deletePattern(id) {
      try {
        await axios.delete(`/api/patterns/${id}`)
        this.patterns = this.patterns.filter(p => p._id !== id)
      } catch (err) {
        console.error('删除纹样失败:', err)
        throw err
      }
    },

    async findSimilarPatterns(featureVector) {
      try {
        const res = await axios.get('/api/patterns/search/similar', {
          params: { vector: JSON.stringify(featureVector) }
        })
        return res.data
      } catch (err) {
        console.error('查找相似纹样失败:', err)
        return []
      }
    }
  }
})
