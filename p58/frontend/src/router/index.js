import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('../views/Layout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '工作台' }
      },
      {
        path: '/process',
        name: 'Process',
        component: () => import('../views/Process.vue'),
        meta: { title: '工序操作台', roles: ['CRAFTSMAN', 'ADMIN'] }
      },
      {
        path: '/quality',
        name: 'Quality',
        component: () => import('../views/Quality.vue'),
        meta: { title: '品质检测', roles: ['INSPECTOR', 'ADMIN'] }
      },
      {
        path: '/trace',
        name: 'Trace',
        component: () => import('../views/Trace.vue'),
        meta: { title: '溯源查询' }
      },
      {
            path: '/material',
            name: 'Material',
            component: () => import('../views/Material.vue'),
            meta: { title: '原料管理', roles: ['ADMIN'] }
          },
          {
            path: '/analysis',
            name: 'Analysis',
            component: () => import('../views/Analysis.vue'),
            meta: { title: '对比分析' }
          }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  userStore.initFromStorage()

  const token = userStore.token
  const userInfo = userStore.userInfo

  if (to.meta.requiresAuth !== false && !token) {
    next('/login')
  } else if (to.meta.roles && userInfo && !to.meta.roles.includes(userInfo.role)) {
    ElMessage.error('无权限访问该页面')
    next(false)
  } else {
    next()
  }
})

export default router
