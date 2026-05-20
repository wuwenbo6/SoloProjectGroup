<template>
  <div id="app">
    <el-container class="main-container">
      <el-header class="header">
        <div class="header-content">
          <div class="logo">
            <el-icon size="32" color="#c23c31"><Mask /></el-icon>
            <span class="title">脸谱纹样采集操作台</span>
          </div>
          <div class="header-actions">
            <el-button type="primary" @click="showUpload = true">
              <el-icon><Upload /></el-icon>
              上传纹样
            </el-button>
            <el-avatar :size="32" :src="currentUser.avatar" />
          </div>
        </div>
      </el-header>
      
      <el-container>
        <el-aside width="200px" class="sidebar">
          <el-menu
            :default-active="activeMenu"
            router
            class="sidebar-menu"
          >
            <el-menu-item index="/">
              <el-icon><Picture /></el-icon>
              <span>纹样库</span>
            </el-menu-item>
            <el-menu-item index="/collect">
              <el-icon><Camera /></el-icon>
              <span>采集操作台</span>
            </el-menu-item>
            <el-menu-item index="/category">
              <el-icon><FolderOpened /></el-icon>
              <span>分类归档</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        
        <el-main class="main-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>

    <UploadDialog 
      v-model:visible="showUpload" 
      @success="handleUploadSuccess"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Mask, Upload, Picture, Camera, FolderOpened } from '@element-plus/icons-vue'
import UploadDialog from './components/UploadDialog.vue'

const router = useRouter()
const route = useRoute()
const showUpload = ref(false)

const currentUser = ref({
  _id: '1',
  username: '采集员',
  avatar: 'https://ui-avatars.com/api/?name=采集员&background=c23c31&color=fff'
})

const activeMenu = computed(() => route.path)

const handleUploadSuccess = () => {
  showUpload.value = false
  router.push('/')
}
</script>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
}

.main-container {
  height: 100%;
}

.header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 0;
  color: #fff;
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 100%;
    padding: 0 20px;
  }
  
  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .title {
      font-size: 20px;
      font-weight: 600;
    }
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
}

.sidebar {
  background: #f5f7fa;
  border-right: 1px solid #e4e7ed;
}

.main-content {
  background: #fff;
  padding: 20px;
}
</style>
