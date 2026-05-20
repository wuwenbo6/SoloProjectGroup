import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/collection'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/collection',
    name: 'Collection',
    component: () => import('@/views/Collection.vue')
  },
  {
    path: '/interpretation/:id',
    name: 'Interpretation',
    component: () => import('@/views/Interpretation.vue')
  },
  {
    path: '/comparison',
    name: 'Comparison',
    component: () => import('@/views/Comparison.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router
