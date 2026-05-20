import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/crafts',
    name: 'CraftList',
    component: () => import('../views/CraftList.vue')
  },
  {
    path: '/craft/:id',
    name: 'CraftDetail',
    component: () => import('../views/CraftDetail.vue')
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('../views/Upload.vue')
  },
  {
    path: '/user/works',
    name: 'UserWorks',
    component: () => import('../views/UserWorks.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
