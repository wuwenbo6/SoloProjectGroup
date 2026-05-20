import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue')
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/furniture/:id',
    name: 'FurnitureDetail',
    component: () => import('@/views/FurnitureDetail.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/learn/:id',
    name: 'Learn',
    component: () => import('@/views/Learn.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/progress',
    name: 'Progress',
    component: () => import('@/views/Progress.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/progress-report',
    name: 'ProgressReport',
    component: () => import('@/views/ProgressReport.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/step-manage',
    name: 'StepManage',
    component: () => import('@/views/StepManage.vue'),
    meta: { requiresAuth: true, roles: ['INSTRUCTOR', 'ADMIN'] }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.token) {
    next('/login')
  } else {
    next()
  }
})

export default router
