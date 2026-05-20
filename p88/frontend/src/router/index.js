import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/console'
  },
  {
    path: '/console',
    name: 'Console',
    component: () => import('@/views/Console.vue')
  },
  {
    path: '/viewer',
    name: 'Viewer',
    component: () => import('@/views/Viewer.vue')
  },
  {
    path: '/craft',
    name: 'Craft',
    component: () => import('@/views/Craft.vue')
  },
  {
    path: '/viewer/:id',
    name: 'ViewerDetail',
    component: () => import('@/views/Viewer.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
