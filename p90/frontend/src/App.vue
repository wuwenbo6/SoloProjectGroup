<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const activeMenu = ref('studio')
const isMobile = ref(false)
const menuOpen = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

const menuItems = [
  { key: 'studio', label: '纹样采集', icon: '🎨', path: '/studio' },
  { key: 'works', label: '我的作品', icon: '🖼️', path: '/works' }
]

watch(() => route.path, (path) => {
  if (path === '/studio') activeMenu.value = 'studio'
  if (path === '/works') activeMenu.value = 'works'
  menuOpen.value = false
}, { immediate: true })

const navigate = (item) => {
  activeMenu.value = item.key
  router.push(item.path)
  menuOpen.value = false
}

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value
}
</script>

<template>
  <div class="app-container">
    <header class="header">
      <div class="logo">
        <span class="logo-icon">脸谱</span>
        <span class="logo-text">纹样采集平台</span>
      </div>
      
      <button v-if="isMobile" class="mobile-menu-btn" @click="toggleMenu">
        {{ menuOpen ? '✕' : '☰' }}
      </button>
      
      <nav class="nav" :class="{ 'mobile-open': menuOpen }">
        <div
          v-for="item in menuItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: activeMenu === item.key }"
          @click="navigate(item)"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </div>
      </nav>
    </header>
    
    <div v-if="isMobile && menuOpen" class="mobile-overlay" @click="menuOpen = false"></div>
    
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

:root {
  --primary-color: #e94560;
  --primary-gradient: linear-gradient(135deg, #e94560, #ff6b6b);
  --bg-dark: #1a1a2e;
  --bg-card: rgba(255, 255, 255, 0.05);
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.7);
  --border-color: rgba(255, 255, 255, 0.1);
}

.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  height: 70px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 24px;
  font-weight: bold;
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.logo-text {
  color: #fff;
  font-size: 18px;
  font-weight: 500;
}

.nav {
  display: flex;
  gap: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.active {
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  color: #fff;
}

.nav-icon {
  font-size: 18px;
}

.nav-label {
  font-size: 14px;
}

.main-content {
  padding: 30px 40px;
  min-height: calc(100vh - 70px);
}

.mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background 0.2s;
}

.mobile-menu-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.mobile-overlay {
  position: fixed;
  top: 70px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.btn-primary {
  background: var(--primary-gradient);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(233, 69, 96, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid var(--border-color);
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.input-field {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 16px;
  color: white;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.input-field:focus {
  border-color: var(--primary-color);
}

.input-field::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.textarea {
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
}

@media (max-width: 768px) {
  .header {
    padding: 0 16px;
    height: 60px;
  }

  .logo-icon {
    font-size: 20px;
  }

  .logo-text {
    font-size: 16px;
  }

  .mobile-menu-btn {
    display: flex;
  }

  .nav {
    position: fixed;
    top: 60px;
    right: -250px;
    width: 250px;
    height: calc(100vh - 60px);
    flex-direction: column;
    background: rgba(26, 26, 46, 0.98);
    backdrop-filter: blur(20px);
    padding: 20px;
    transition: right 0.3s ease;
    border-left: 1px solid var(--border-color);
  }

  .nav.mobile-open {
    right: 0;
  }

  .nav-item {
    padding: 14px 20px;
    border-radius: 12px;
  }

  .nav-icon {
    font-size: 20px;
  }

  .nav-label {
    font-size: 15px;
  }

  .main-content {
    padding: 20px 16px;
    min-height: calc(100vh - 60px);
  }
}

@media (max-width: 480px) {
  .logo-text {
    display: none;
  }

  .btn-primary,
  .btn-secondary {
    padding: 10px 16px;
    font-size: 13px;
  }

  .input-field {
    padding: 10px 14px;
    font-size: 13px;
  }
}
</style>
