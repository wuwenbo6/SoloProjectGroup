import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/collection',
    name: 'Collection',
    component: () => import('../views/Collection.vue')
  },
  {
    path: '/props',
    name: 'Props',
    component: () => import('../views/Props.vue')
  },
  {
    path: '/prop/:id',
    name: 'PropDetail',
    component: () => import('../views/PropDetail.vue')
  },
  {
    path: '/crafts',
    name: 'Crafts',
    component: () => import('../views/Crafts.vue')
  },
  {
    path: '/craft/:id',
    name: 'CraftDetail',
    component: () => import('../views/CraftDetail.vue')
  },
  {
    path: '/craft/edit/:id',
    name: 'CraftEdit',
    component: () => import('../views/CraftEdit.vue')
  },
  {
    path: '/collaboration',
    name: 'Collaboration',
    component: () => import('../views/Collaboration.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const user = localStorage.getItem('user')
  if (to.path !== '/login' && !user) {
    next('/login')
  } else {
    next()
  }
})

export default router
