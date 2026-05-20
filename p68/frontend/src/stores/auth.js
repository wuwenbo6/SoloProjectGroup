import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login, register } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isLoggedIn = computed(() => !!token.value)
  const isInstructor = computed(() => user.value?.roles?.includes('INSTRUCTOR') || user.value?.roles?.includes('ADMIN'))

  async function handleLogin(credentials) {
    const response = await login(credentials)
    token.value = response.data.token
    user.value = {
      username: response.data.username,
      email: response.data.email,
      realName: response.data.realName,
      roles: response.data.roles
    }
    localStorage.setItem('token', token.value)
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  async function handleRegister(credentials) {
    const response = await register(credentials)
    token.value = response.data.token
    user.value = {
      username: response.data.username,
      email: response.data.email,
      realName: response.data.realName,
      roles: response.data.roles
    }
    localStorage.setItem('token', token.value)
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return { token, user, isLoggedIn, isInstructor, handleLogin, handleRegister, logout }
})
