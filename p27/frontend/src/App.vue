<template>
  <el-config-provider :locale="zhCn">
    <div class="app-container">
      <el-container>
        <el-header class="header">
          <div class="header-content">
            <h1><el-icon size="28"><Document /></el-icon> 企业级文档问答系统</h1>
          </div>
        </el-header>
        <el-container>
          <el-aside width="280px" class="aside">
            <el-menu
              :default-active="currentRoute"
              class="menu"
              router
            >
              <el-menu-item index="/">
                <el-icon><QuestionFilled /></el-icon>
                <span>智能问答</span>
              </el-menu-item>
              <el-menu-item index="/upload">
                <el-icon><Upload /></el-icon>
                <span>文档上传</span>
              </el-menu-item>
              <el-menu-item index="/documents">
                <el-icon><List /></el-icon>
                <span>文档管理</span>
              </el-menu-item>
              <el-menu-item index="/compare">
                <el-icon><Comparison /></el-icon>
                <span>版本对比</span>
              </el-menu-item>
            </el-menu>
          </el-aside>
          <el-main class="main">
            <router-view />
          </el-main>
        </el-container>
      </el-container>
    </div>
  </el-config-provider>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { Document, QuestionFilled, Upload, List, Comparison } from '@element-plus/icons-vue'

const route = useRoute()
const currentRoute = computed(() => route.path)
</script>

<style scoped>
.app-container {
  height: 100vh;
  background-color: #f5f7fa;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  padding: 0 30px;
  height: 70px !important;
}

.header-content h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
}

.aside {
  background-color: #fff;
  border-right: 1px solid #e4e7ed;
}

.menu {
  border-right: none;
}

.main {
  padding: 30px;
  overflow-y: auto;
}
</style>
