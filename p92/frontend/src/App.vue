<template>
  <div id="app">
    <el-container>
      <el-header>
        <div class="header-content">
          <div class="logo" @click="$router.push('/')">
            <el-icon><Brush /></el-icon>
            <span>竹编工艺平台</span>
          </div>
          <el-menu
            :default-active="activeMenu"
            mode="horizontal"
            router
            class="nav-menu"
          >
            <el-menu-item index="/">首页</el-menu-item>
            <el-menu-item index="/crafts">工艺展示</el-menu-item>
            <el-menu-item index="/upload">采集上传</el-menu-item>
            <el-menu-item index="/user/works">我的作品</el-menu-item>
          </el-menu>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
      <el-footer>
        <div class="footer-content">
          <p>© 2024 竹编工艺传承平台 - 传承非遗文化</p>
        </div>
      </el-footer>
    </el-container>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  min-height: 100vh;
}

.el-header {
  background: linear-gradient(135deg, #2d5016 0%, #4a7c23 100%);
  color: white;
  padding: 0;
  height: 70px !important;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 20px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: bold;
  cursor: pointer;
}

.logo .el-icon {
  font-size: 28px;
}

.nav-menu {
  background: transparent;
  border: none;
}

.nav-menu .el-menu-item {
  color: white;
  border-bottom: 2px solid transparent;
}

.nav-menu .el-menu-item:hover,
.nav-menu .el-menu-item.is-active {
  background: rgba(255, 255, 255, 0.1);
  border-bottom-color: #ffd700;
  color: #ffd700;
}

.el-main {
  background: #f5f7fa;
  min-height: calc(100vh - 130px);
  padding: 30px;
}

.el-footer {
  background: #2d5016;
  color: white;
  text-align: center;
  height: 60px !important;
  line-height: 60px;
}

.footer-content p {
  margin: 0;
}
</style>
