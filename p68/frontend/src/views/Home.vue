<template>
  <div class="home-container">
    <el-header class="header">
      <div class="header-content">
        <h1 class="logo">榫卯家具拆解教学平台</h1>
        <div class="nav-menu">
          <el-button type="text" @click="$router.push('/')">首页</el-button>
          <el-button type="text" @click="$router.push('/progress')">学习进度</el-button>
          <el-button type="text" @click="$router.push('/progress-report')">学习报表</el-button>
          <el-button v-if="authStore.isInstructor" type="text" @click="$router.push('/step-manage')">教学管理</el-button>
        </div>
        <div class="user-info">
          <span>欢迎，{{ authStore.user?.username }}</span>
          <LanguageSwitcher />
          <el-button type="text" @click="handleLogout">退出登录</el-button>
        </div>
      </div>
    </el-header>
    <el-main class="main-content">
      <div class="furniture-list">
        <h2>家具列表</h2>
        <el-row :gutter="20">
          <el-col :span="8" v-for="item in furnitureList" :key="item.id">
            <el-card class="furniture-card" shadow="hover">
              <div class="card-image">
                <div class="placeholder-image">
                  <el-icon :size="60"><FolderOpened /></el-icon>
                </div>
              </div>
              <template #footer>
                <div class="card-footer">
                  <h3>{{ item.name }}</h3>
                  <p class="category">{{ item.category }}</p>
                  <div class="difficulty">
                    <el-rate v-model="item.difficulty" disabled show-score text-color="#ff9900" />
                  </div>
                  <p class="description">{{ item.description }}</p>
                  <div class="actions">
                    <el-button type="primary" @click="viewDetail(item.id)">查看详情</el-button>
                    <el-button type="success" @click="startLearn(item.id)">开始学习</el-button>
                  </div>
                </div>
              </template>
            </el-card>
          </el-col>
        </el-row>
        <el-empty v-if="furnitureList.length === 0" description="暂无家具数据" />
      </div>
    </el-main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getFurnitureList } from '@/api/furniture'
import { FolderOpened } from '@element-plus/icons-vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

const router = useRouter()
const authStore = useAuthStore()
const furnitureList = ref([])

onMounted(() => {
  loadFurnitureList()
})

const loadFurnitureList = async () => {
  try {
    const response = await getFurnitureList()
    furnitureList.value = response.data
  } catch (error) {
    console.error('加载家具列表失败', error)
  }
}

const viewDetail = (id) => {
  router.push(`/furniture/${id}`)
}

const startLearn = (id) => {
  router.push(`/learn/${id}`)
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0;
  height: 60px;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}

.logo {
  font-size: 20px;
  margin: 0;
  color: white;
}

.nav-menu {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 5px;
}

.nav-menu .el-button {
  color: white;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-info span {
  color: white;
}

.user-info .el-button {
  color: white;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.furniture-list h2 {
  margin-bottom: 20px;
  color: #333;
}

.furniture-card {
  margin-bottom: 20px;
}

.card-image {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}

.placeholder-image {
  color: #c0c4cc;
}

.card-footer h3 {
  margin: 10px 0;
  font-size: 18px;
  color: #333;
}

.category {
  color: #666;
  font-size: 14px;
  margin: 5px 0;
}

.difficulty {
  margin: 10px 0;
}

.description {
  color: #909399;
  font-size: 14px;
  margin: 10px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.actions .el-button {
  flex: 1;
}
</style>
