<template>
  <div class="home-container">
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <h1>刺绣针法教学操作台</h1>
        </div>
        <div class="header-right">
          <span class="user-info">{{ userStore.user?.username }} ({{ userStore.isTeacher ? '教师' : '学员' }})</span>
          <el-button type="danger" size="small" @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      
      <el-container>
        <el-aside width="200px" class="aside">
          <el-menu :default-active="activeMenu" @select="handleMenuSelect">
            <el-menu-item index="home">
              <el-icon><House /></el-icon>
              <span>针法列表</span>
            </el-menu-item>
            <el-menu-item index="practice">
              <el-icon><Edit /></el-icon>
              <span>互动练习</span>
            </el-menu-item>
            <el-menu-item index="report">
              <el-icon><TrendCharts /></el-icon>
              <span>学习报告</span>
            </el-menu-item>
            <el-menu-item index="qa">
              <el-icon><ChatDotRound /></el-icon>
              <span>互动问答</span>
            </el-menu-item>
            <el-menu-item index="admin" v-if="userStore.isTeacher">
              <el-icon><Setting /></el-icon>
              <span>管理后台</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        
        <el-main class="main">
          <div class="stats-row">
            <el-card class="stat-card">
              <div class="stat-content">
                <el-icon class="stat-icon" style="color: #409eff"><Reading /></el-icon>
                <div class="stat-text">
                  <div class="stat-number">{{ stats.total_stitches || 0 }}</div>
                  <div class="stat-label">已学针法</div>
                </div>
              </div>
            </el-card>
            <el-card class="stat-card">
              <div class="stat-content">
                <el-icon class="stat-icon" style="color: #67c23a"><CircleCheck /></el-icon>
                <div class="stat-text">
                  <div class="stat-number">{{ stats.completed_stitches || 0 }}</div>
                  <div class="stat-label">已完成</div>
                </div>
              </div>
            </el-card>
            <el-card class="stat-card">
              <div class="stat-content">
                <el-icon class="stat-icon" style="color: #e6a23c"><Trophy /></el-icon>
                <div class="stat-text">
                  <div class="stat-number">{{ Math.round(stats.average_progress || 0) }}%</div>
                  <div class="stat-label">平均进度</div>
                </div>
              </div>
            </el-card>
          </div>
          
          <h2 class="section-title">针法列表</h2>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="stitch in stitches" :key="stitch.id">
              <el-card class="stitch-card" @click="goToStitch(stitch.id)">
                <div class="stitch-image">
                  <el-icon :size="60" style="color: #c39bd3"><Brush /></el-icon>
                </div>
                <div class="stitch-info">
                  <h3>{{ stitch.name }}</h3>
                  <p class="description">{{ stitch.description || '暂无描述' }}</p>
                  <div class="stitch-meta">
                    <el-tag size="small" :type="getDifficultyType(stitch.difficulty)">
                      难度: {{ stitch.difficulty }}
                    </el-tag>
                    <span v-if="stitch.category" class="category">{{ stitch.category }}</span>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user'
import { stitchAPI, progressAPI } from '@/api'

const router = useRouter()
const userStore = useUserStore()

const activeMenu = ref('home')
const stitches = ref([])
const stats = ref({})

const handleMenuSelect = (index) => {
  if (index === 'qa') {
    router.push('/qa')
  } else if (index === 'admin') {
    router.push('/admin')
  } else if (index === 'practice') {
    router.push('/practice')
  } else if (index === 'report') {
    router.push('/report')
  }
}

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
  ElMessage.success('已退出登录')
}

const goToStitch = (id) => {
  router.push(`/stitch/${id}`)
}

const getDifficultyType = (level) => {
  if (level <= 2) return 'success'
  if (level <= 4) return 'warning'
  return 'danger'
}

const loadStitches = async () => {
  try {
    const res = await stitchAPI.getStitches()
    if (res.success) {
      stitches.value = res.stitches
    }
  } catch (error) {
    console.error('加载针法列表失败', error)
  }
}

const loadStats = async () => {
  try {
    const res = await progressAPI.getStats(userStore.user?.id)
    if (res.success) {
      stats.value = res.stats
    }
  } catch (error) {
    console.error('加载统计数据失败', error)
  }
}

onMounted(() => {
  userStore.restoreUser()
  loadStitches()
  loadStats()
})
</script>

<style scoped>
.home-container {
  min-height: 100vh;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 30px;
}

.header h1 {
  color: white;
  font-size: 20px;
  margin: 0;
}

.user-info {
  margin-right: 15px;
}

.aside {
  background: white;
  border-right: 1px solid #e6e6e6;
}

.main {
  padding: 20px;
}

.stats-row {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  flex: 1;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  font-size: 40px;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.section-title {
  font-size: 20px;
  margin-bottom: 20px;
  color: #333;
}

.stitch-card {
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
  margin-bottom: 20px;
}

.stitch-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.stitch-image {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 8px;
  margin-bottom: 15px;
}

.stitch-info h3 {
  margin: 0 0 10px 0;
  font-size: 18px;
  color: #333;
}

.description {
  color: #666;
  font-size: 14px;
  margin-bottom: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stitch-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category {
  font-size: 12px;
  color: #999;
}
</style>
