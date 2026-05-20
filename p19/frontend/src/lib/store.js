import { writable, derived } from 'svelte/store'
import { auth } from './api.js'

function createAuthStore() {
  const savedUser = localStorage.getItem('user')
  const savedToken = localStorage.getItem('token')
  
  const { subscribe, set, update } = writable({
    user: savedUser ? JSON.parse(savedUser) : null,
    token: savedToken || null,
    isAuthenticated: !!savedToken,
    loading: false,
    error: null
  })

  return {
    subscribe,
    
    login: async (username, password) => {
      update(state => ({ ...state, loading: true, error: null }))
      try {
        const { user, access_token } = await auth.login(username, password)
        localStorage.setItem('token', access_token)
        localStorage.setItem('user', JSON.stringify(user))
        update(state => ({
          ...state,
          user,
          token: access_token,
          isAuthenticated: true,
          loading: false
        }))
        return { user, token: access_token }
      } catch (error) {
        update(state => ({
          ...state,
          loading: false,
          error: error.message
        }))
        throw error
      }
    },
    
    register: async (userData) => {
      update(state => ({ ...state, loading: true, error: null }))
      try {
        const user = await auth.register(userData)
        update(state => ({
          ...state,
          loading: false
        }))
        return user
      } catch (error) {
        update(state => ({
          ...state,
          loading: false,
          error: error.message
        }))
        throw error
      }
    },
    
    logout: () => {
      auth.logout()
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: null
      })
    },
    
    checkAuth: async () => {
      try {
        const user = await auth.getCurrentUser()
        localStorage.setItem('user', JSON.stringify(user))
        update(state => ({
          ...state,
          user,
          isAuthenticated: true
        }))
      } catch {
        auth.logout()
        update(state => ({
          ...state,
          user: null,
          token: null,
          isAuthenticated: false
        }))
      }
    },
    
    clearError: () => {
      update(state => ({ ...state, error: null }))
    }
  }
}

export const authStore = createAuthStore()

export const isAdmin = derived(
  authStore,
  $auth => $auth.user?.role === 'admin'
)

export const isManager = derived(
  authStore,
  $auth => ['admin', 'manager'].includes($auth.user?.role)
)

export const isReviewer = derived(
  authStore,
  $auth => ['admin', 'manager', 'reviewer'].includes($auth.user?.role)
)
