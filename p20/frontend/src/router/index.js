import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../store/auth';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue')
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/ScenesList.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/scene/:id',
    name: 'Scene',
    component: () => import('../views/SceneEditor.vue'),
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

  if (requiresAuth && !authStore.token) {
    next('/login');
  } else if ((to.path === '/login' || to.path === '/register') && authStore.token) {
    next('/');
  } else {
    next();
  }
});

export default router;
