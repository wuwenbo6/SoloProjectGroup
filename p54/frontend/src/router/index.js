import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/store/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue')
      },
      {
        path: 'collection',
        name: 'Collection',
        component: () => import('@/views/Collection.vue')
      },
      {
        path: 'annotation/:id',
        name: 'Annotation',
        component: () => import('@/views/Annotation.vue')
      },
      {
        path: 'compare',
        name: 'Compare',
        component: () => import('@/views/Compare.vue')
      },
      {
        path: 'users',
        name: 'UserManagement',
        component: () => import('@/views/Users.vue'),
        meta: { roles: ['admin'] }
      },
      {
        path: 'rubbing-detail/:id',
        name: 'RubbingDetail',
        component: () => import('@/views/RubbingDetail.vue')
      },
      {
        path: 'museum',
        name: 'MuseumCollection',
        component: () => import('@/views/Museum.vue')
      },
      {
        path: 'review',
        name: 'ReviewCenter',
        component: () => import('@/views/Review.vue'),
        meta: { roles: ['admin', 'expert'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  
  if (to.meta.requiresAuth !== false && !userStore.token) {
    next('/login')
  } else if (to.meta.roles && !to.meta.roles.includes(userStore.user?.role)) {
    next('/')
  } else {
    next()
  }
})

export default router
