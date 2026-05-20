import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'PatternLibrary',
    component: () => import('../views/PatternLibrary.vue')
  },
  {
    path: '/collect',
    name: 'CollectStation',
    component: () => import('../views/CollectStation.vue')
  },
  {
    path: '/category',
    name: 'CategoryArchive',
    component: () => import('../views/CategoryArchive.vue')
  },
  {
    path: '/pattern/:id',
    name: 'PatternDetail',
    component: () => import('../views/PatternDetail.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
