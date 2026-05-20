import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    token: null
  }),
  
  actions: {
    login(userData, token) {
      this.user = userData
      this.token = token
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
    },
    
    logout() {
      this.user = null
      this.token = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
    
    restoreUser() {
      const user = localStorage.getItem('user')
      const token = localStorage.getItem('token')
      if (user && token) {
        this.user = JSON.parse(user)
        this.token = token
      }
    }
  },
  
  getters: {
    isLoggedIn: (state) => !!state.token,
    isTeacher: (state) => state.user?.role === 'teacher'
  }
})
