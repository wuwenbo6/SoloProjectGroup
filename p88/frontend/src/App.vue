<template>
  <div id="app">
    <el-container class="layout-container">
      <el-header class="app-header">
        <div class="header-content">
          <h1 class="app-title">榫卯家具采集系统</h1>
          <div class="user-info">
            <span>{{ userName }}</span>
          </div>
        </div>
      </el-header>
      <el-container>
        <el-aside width="200px" class="app-aside">
          <el-menu
            :default-active="activeMenu"
            router
            class="nav-menu"
          >
            <el-menu-item index="/console">
              <el-icon><Monitor /></el-icon>
              <span>采集操作台</span>
            </el-menu-item>
            <el-menu-item index="/viewer">
              <el-icon><Box /></el-icon>
              <span>3D展示</span>
            </el-menu-item>
            <el-menu-item index="/craft">
              <el-icon><Document /></el-icon>
              <span>工艺说明</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        <el-main class="app-main">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Monitor, Box, Document } from '@element-plus/icons-vue'

const route = useRoute()
const userName = ref('管理员')

const activeMenu = computed(() => route.path)
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.app-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.app-aside {
  background-color: #f5f7fa;
  border-right: 1px solid #e4e7ed;
}

.nav-menu {
  border-right: none;
}

.app-main {
  background-color: #f0f2f5;
  padding: 20px;
}
</style>
