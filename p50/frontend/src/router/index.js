import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/synthesis'
  },
  {
    path: '/synthesis',
    name: 'Synthesis',
    component: () => import('@/views/Synthesis.vue')
  },
  {
    path: '/audio-collection',
    name: 'AudioCollection',
    component: () => import('@/views/AudioCollection.vue')
  },
  {
    path: '/knowledge-base',
    name: 'KnowledgeBase',
    component: () => import('@/views/KnowledgeBase.vue')
  },
  {
    path: '/repair',
    name: 'Repair',
    component: () => import('@/views/Repair.vue')
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('@/views/Tasks.vue')
  },
  {
    path: '/annotation',
    name: 'Annotation',
    component: () => import('@/views/Annotation.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
