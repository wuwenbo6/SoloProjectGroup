import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/studio'
  },
  {
    path: '/studio',
    name: 'Studio',
    component: () => import('../views/Studio.vue')
  },
  {
    path: '/share/:id',
    name: 'Share',
    component: () => import('../views/Share.vue')
  },
  {
    path: '/works',
    name: 'Works',
    component: () => import('../views/Works.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
