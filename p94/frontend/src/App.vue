<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <h1 class="app-title">
          <el-icon><VideoPlay /></el-icon>
          <span class="title-text">{{ $t('common.title', '皮影道具采集系统') }}</span>
        </h1>
        <div class="header-right">
          <el-dropdown @command="changeLocale" v-if="user">
            <span class="lang-switch">
              <el-icon><Reading /></el-icon>
              {{ currentLocaleName }}
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="zh-CN" :divided="false">简体中文</el-dropdown-item>
                <el-dropdown-item command="en-US">English</el-dropdown-item>
                <el-dropdown-item command="ja-JP">日本語</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <div class="header-user" v-if="user">
            <span class="user-name">{{ user.realName || user.username }}</span>
            <el-button type="text" @click="logout">{{ $t('user.logout') }}</el-button>
          </div>
        </div>
        <el-button class="mobile-menu-btn" type="text" @click="showMenu = !showMenu" v-if="user">
          <el-icon><Menu /></el-icon>
        </el-button>
      </div>
    </el-header>
    <el-container>
      <el-aside :width="showMenu ? '200px' : '0'" class="app-aside" v-if="user" :class="{ 'mobile-menu': showMenu }">
        <el-menu
          :default-active="activeMenu"
          router
          background-color="#545c64"
          text-color="#fff"
          active-text-color="#ffd04b"
        >
          <el-menu-item index="/">
            <el-icon><House /></el-icon>
            <span>{{ $t('nav.home') }}</span>
          </el-menu-item>
          <el-menu-item index="/collection">
            <el-icon><Plus /></el-icon>
            <span>{{ $t('nav.collection') }}</span>
          </el-menu-item>
          <el-menu-item index="/props">
            <el-icon><Grid /></el-icon>
            <span>{{ $t('nav.props') }}</span>
          </el-menu-item>
          <el-menu-item index="/crafts">
            <el-icon><Document /></el-icon>
            <span>{{ $t('nav.crafts') }}</span>
          </el-menu-item>
          <el-menu-item index="/collaboration">
            <el-icon><User /></el-icon>
            <span>{{ $t('nav.collaboration') }}</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const { locale } = useI18n()
const user = ref(null)
const showMenu = ref(false)

const activeMenu = computed(() => route.path)

const currentLocaleName = computed(() => {
  const names = {
    'zh-CN': '简体中文',
    'en-US': 'English',
    'ja-JP': '日本語'
  }
  return names[locale.value] || '简体中文'
})

const changeLocale = (lang) => {
  locale.value = lang
  localStorage.setItem('locale', lang)
  ElMessage.success('语言切换成功')
}

onMounted(() => {
  const savedLocale = localStorage.getItem('locale')
  if (savedLocale) {
    locale.value = savedLocale
  }
  
  const userData = localStorage.getItem('user')
  if (userData) {
    user.value = JSON.parse(userData)
  } else if (route.path !== '/login') {
    router.push('/login')
  }
})

const logout = () => {
  localStorage.removeItem('user')
  user.value = null
  ElMessage.success('退出成功')
  router.push('/login')
}

watch(() => route.path, () => {
  showMenu.value = false
})
</script>

<style scoped>
.app-container {
  height: 100vh;
}
.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0;
}
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}
.app-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 24px;
}
.title-text {
  display: inline-block;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 15px;
}
.lang-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background 0.3s;
}
.lang-switch:hover {
  background: rgba(255, 255, 255, 0.15);
}
.header-user {
  display: flex;
  align-items: center;
  gap: 15px;
}
.header-user .el-button {
  color: white;
}
.mobile-menu-btn {
  display: none;
  color: white;
  padding: 8px;
}
.mobile-menu-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}
.app-aside {
  background-color: #545c64;
  transition: width 0.3s ease;
  overflow: hidden;
}
.app-main {
  background-color: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .header-content {
    padding: 0 12px;
  }
  .title-text {
    font-size: 18px;
  }
  .header-user .user-name {
    display: none;
  }
  .mobile-menu-btn {
    display: flex;
  }
  .app-aside {
    position: fixed;
    left: 0;
    top: 60px;
    bottom: 0;
    z-index: 1000;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
  }
  .app-aside.mobile-menu {
    width: 200px !important;
  }
  .app-main {
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .title-text {
    display: none;
  }
}
</style>
