import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Q&A',
    component: () => import('@/views/QAPage.vue')
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('@/views/UploadPage.vue')
  },
  {
    path: '/documents',
    name: 'Documents',
    component: () => import('@/views/DocumentsPage.vue')
  },
  {
    path: '/compare',
    name: 'Compare',
    component: () => import('@/views/ComparePage.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
