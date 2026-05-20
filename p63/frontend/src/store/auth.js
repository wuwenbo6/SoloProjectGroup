import { defineStore } from 'pinia'
import { authAPI } from '@/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null')
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    username: (state) => state.user?.username || '',
    userId: (state) => state.user?.id || ''
  },

  actions: {
    async register(userData) {
      const response = await authAPI.register(userData)
      this.setAuthData(response.data)
      return response.data
    },

    async login(credentials) {
      const response = await authAPI.login(credentials)
      this.setAuthData(response.data)
      return response.data
    },

    async fetchCurrentUser() {
      if (this.token) {
        try {
          const response = await authAPI.getCurrentUser()
          this.user = response.data.user
          localStorage.setItem('user', JSON.stringify(this.user))
        } catch (error) {
          this.logout()
        }
      }
    },

    setAuthData(data) {
      this.token = data.token
      this.user = data.user
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    },

    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }
})
