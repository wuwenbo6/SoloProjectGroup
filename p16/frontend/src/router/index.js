import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('@/views/Upload.vue')
  },
  {
    path: '/library',
    name: 'Library',
    component: () => import('@/views/Library.vue')
  },
  {
    path: '/restoration/:pageId',
    name: 'Restoration',
    component: () => import('@/views/Restoration.vue')
  },
  {
    path: '/interpretation',
    name: 'Interpretation',
    component: () => import('@/views/Interpretation.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
