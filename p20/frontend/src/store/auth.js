import { defineStore } from 'pinia';
import api from '../services/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || null
  }),

  actions: {
    async login(username, password) {
      const response = await api.post('/auth/login', { username, password });
      this.token = response.data.token;
      this.user = response.data.user;
      localStorage.setItem('token', response.data.token);
      return response.data;
    },

    async register(username, password) {
      const response = await api.post('/auth/register', { username, password });
      this.token = response.data.token;
      this.user = response.data.user;
      localStorage.setItem('token', response.data.token);
      return response.data;
    },

    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
    },

    async fetchMe() {
      if (this.token) {
        try {
          const response = await api.get('/auth/me');
          this.user = response.data.user;
        } catch (err) {
          this.logout();
        }
      }
    }
  },

  getters: {
    userId: (state) => state.user?.id
  }
});
