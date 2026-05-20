import { create } from 'zustand'
import { User, LoginResponse } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (data: LoginResponse) => void
  logout: () => void
  updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  
  login: (data) => {
    localStorage.setItem('token', data.token)
    set({
      user: data.user,
      token: data.token,
      isAuthenticated: true,
    })
  },
  
  logout: () => {
    localStorage.removeItem('token')
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    })
  },
  
  updateUser: (user) => set({ user }),
}))
