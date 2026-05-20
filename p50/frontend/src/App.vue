<template>
  <el-config-provider :locale="zhCn">
    <div class="app-container">
      <el-container>
        <el-header class="header">
          <div class="header-content">
            <h1>方言语音合成系统</h1>
            <p>小众方言保护 | 语调矫正 | 情感适配</p>
          </div>
        </el-header>
        
        <el-container>
          <el-aside width="200px" class="aside">
            <el-menu
            :default-active="activeMenu"
            router
            class="menu"
          >
            <el-menu-item index="/synthesis">
              <el-icon><Microphone /></el-icon>
              <span>语音合成</span>
            </el-menu-item>
            <el-menu-item index="/audio-collection">
              <el-icon><Upload /></el-icon>
              <span>音频采集</span>
            </el-menu-item>
            <el-menu-item index="/annotation">
              <el-icon><Edit /></el-icon>
              <span>语料标注</span>
            </el-menu-item>
            <el-menu-item index="/knowledge-base">
              <el-icon><Reading /></el-icon>
              <span>方言知识库</span>
            </el-menu-item>
            <el-menu-item index="/repair">
              <el-icon><Tools /></el-icon>
              <span>语音修复</span>
            </el-menu-item>
            <el-menu-item index="/tasks">
              <el-icon><List /></el-icon>
              <span>任务列表</span>
            </el-menu-item>
          </el-menu>
          </el-aside>
          
          <el-main class="main-content">
            <router-view />
          </el-main>
        </el-container>
      </el-container>
    </div>
  </el-config-provider>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header {
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  text-align: center;
  padding: 20px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content h1 {
  margin: 0;
  font-size: 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-content p {
  margin: 8px 0 0;
  color: #666;
  font-size: 14px;
}

.aside {
  background: rgba(255, 255, 255, 0.95);
}

.menu {
  border-right: none;
}

.main-content {
  background: #f5f7fa;
  min-height: calc(100vh - 100px);
  padding: 20px;
}

:deep(.el-menu-item) {
  margin: 4px 8px;
  border-radius: 6px;
}

:deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
</style>
