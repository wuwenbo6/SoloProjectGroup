<template>
  <div class="layout-container">
    <el-header>
      <div class="header-left">
        <div class="logo">古法造纸全链路管理系统</div>
      </div>
      <div class="header-right">
        <div class="user-info">
          <el-icon><User /></el-icon>
          <span>{{ userStore.userInfo?.realName || userStore.userInfo?.username }}</span>
          <el-tag :type="getRoleTagType(userStore.userInfo?.role)">
            {{ getRoleText(userStore.userInfo?.role) }}
          </el-tag>
        </div>
        <el-button type="danger" size="small" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          退出
        </el-button>
      </div>
    </el-header>
    <div class="layout-main">
      <el-aside width="200px">
        <el-menu
          :default-active="$route.path"
          class="el-menu-vertical-demo"
          text-color="#fff"
          active-text-color="#ffd04b"
          background-color="#304156"
          router
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>工作台</span>
          </el-menu-item>
          <el-menu-item v-if="hasRole(['CRAFTSMAN', 'ADMIN'])" index="/process">
            <el-icon><Operation /></el-icon>
            <span>工序操作台</span>
          </el-menu-item>
          <el-menu-item v-if="hasRole(['INSPECTOR', 'ADMIN'])" index="/quality">
            <el-icon><Quality /></el-icon>
            <span>品质检测</span>
          </el-menu-item>
          <el-menu-item index="/trace">
            <el-icon><Search /></el-icon>
            <span>溯源查询</span>
          </el-menu-item>
          <el-menu-item v-if="hasRole(['ADMIN'])" index="/material">
            <el-icon><Box /></el-icon>
            <span>原料管理</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main>
        <router-view />
      </el-main>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'

const router = useRouter()
const userStore = useUserStore()

const hasRole = (roles) => {
  return userStore.userInfo && roles.includes(userStore.userInfo.role)
}

const getRoleText = (role) => {
  const roleMap = {
    'ADMIN': '管理员',
    'CRAFTSMAN': '工匠',
    'INSPECTOR': '质检员'
  }
  return roleMap[role] || role
}

const getRoleTagType = (role) => {
  const typeMap = {
    'ADMIN': 'danger',
    'CRAFTSMAN': 'success',
    'INSPECTOR': 'warning'
  }
  return typeMap[role] || 'info'
}

const handleLogout = () => {
  userStore.logout()
  ElMessage.success('已退出登录')
  router.push('/login')
}
</script>
