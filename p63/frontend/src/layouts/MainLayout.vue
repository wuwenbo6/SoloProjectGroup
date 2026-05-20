<template>
  <el-container class="main-container">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon size="32" color="#409eff"><Document /></el-icon>
        <span>金石拓片释读平台</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="#fff"
        active-text-color="#409eff"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/capture">
          <el-icon><Camera /></el-icon>
          <span>拓片采集</span>
        </el-menu-item>
        <el-menu-item index="/compare">
          <el-icon><Comparison /></el-icon>
          <span>拓片对比</span>
        </el-menu-item>
        <el-menu-item index="/users" v-if="isAdmin">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>
      <div class="user-role-info">
        <el-tag :type="roleType" size="small">
          {{ roleText }}
        </el-tag>
      </div>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentRouteName">{{ currentRouteName }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32">{{ authStore.username.charAt(0) }}</el-avatar>
              <span class="username">{{ authStore.username }}</span>
              <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  <div class="dropdown-user-info">
                    <span class="username">{{ authStore.username }}</span>
                    <el-tag :type="roleType" size="small">{{ roleText }}</el-tag>
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="profile" divided>个人中心</el-dropdown-item>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { userAPI } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const userRole = ref('user')

const activeMenu = computed(() => route.path)

const isAdmin = computed(() => userRole.value === 'admin')

const roleType = computed(() => {
  const map = {
    user: 'info',
    editor: 'success',
    admin: 'danger'
  }
  return map[userRole.value] || 'info'
})

const roleText = computed(() => {
  const map = {
    user: '普通用户',
    editor: '编辑',
    admin: '管理员'
  }
  return map[userRole.value] || userRole.value
})

const currentRouteName = computed(() => {
  const nameMap = {
    'Dashboard': '工作台',
    'Capture': '拓片采集',
    'Compare': '拓片对比',
    'RubbingDetail': '拓片详情',
    'Interpretation': '文字释读',
    'UserManagement': '用户管理'
  }
  return nameMap[route.name] || ''
})

const loadUserInfo = async () => {
  try {
    const response = await userAPI.getCurrentUser()
    if (response.data.user) {
      userRole.value = response.data.user.role || 'user'
      authStore.user = response.data.user
    }
  } catch (error) {
    console.error('加载用户信息失败:', error)
  }
}

const handleCommand = async (command) => {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      authStore.logout()
      router.push('/login')
      ElMessage.success('退出成功')
    } catch {
    }
  }
}

onMounted(() => {
  loadUserInfo()
})
</script>

<style scoped>
.main-container {
  height: 100%;
}

.sidebar {
  background-color: #001529;
  height: 100%;
}

.logo {
  display: flex;
  align-items: center;
  padding: 20px;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header {
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background 0.3s;
}

.user-info:hover {
  background: #f5f5f5;
}

.username {
  margin-left: 8px;
}

.main-content {
  background: #f0f2f5;
  padding: 20px;
}

.user-role-info {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.dropdown-user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 200px;
}
</style>
