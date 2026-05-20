<template>
  <div class="progress-container">
    <el-header class="header">
      <div class="header-content">
        <el-button @click="$router.push('/')" icon="ArrowLeft">返回</el-button>
        <h1 class="title">我的学习进度</h1>
      </div>
    </el-header>
    <el-main class="main-content">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon learning">
                <el-icon :size="30"><Reading /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ progressList.filter(p => !p.isCompleted).length }}</div>
                <div class="stat-label">学习中</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon completed">
                <el-icon :size="30"><CircleCheck /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ progressList.filter(p => p.isCompleted).length }}</div>
                <div class="stat-label">已完成</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon time">
                <el-icon :size="30"><Timer /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ totalTime }}</div>
                <div class="stat-label">总学习时长(分钟)</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon total">
                <el-icon :size="30"><Collection /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ progressList.length }}</div>
                <div class="stat-label">总课程</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
      <el-card class="progress-list-card" style="margin-top: 20px;">
        <template #header>
          <span>学习列表</span>
        </template>
        <el-table :data="progressList" style="width: 100%">
          <el-table-column prop="furnitureId" label="课程ID" width="100" align="center" />
          <el-table-column label="完成进度" width="200">
            <template #default="{ row }">
              <el-progress :percentage="Math.round((row.currentStep / row.totalSteps) * 100)" :status="row.isCompleted ? 'success' : ''" />
            </template>
          </el-table-column>
          <el-table-column label="进度详情">
            <template #default="{ row }">
              <span>{{ row.currentStep }} / {{ row.totalSteps }} 步</span>
            </template>
          </el-table-column>
          <el-table-column prop="totalTimeSpent" label="学习时长(分钟)" width="150" align="center" />
          <el-table-column prop="lastAccessed" label="最近学习" width="200" align="center" />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.isCompleted" type="success">已完成</el-tag>
              <el-tag v-else type="primary">学习中</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="center">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="continueLearn(row.furnitureId)">
                {{ row.isCompleted ? '复习' : '继续学习' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="progressList.length === 0" description="暂无学习记录" />
      </el-card>
    </el-main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getUserProgress } from '@/api/progress'
import { Reading, CircleCheck, Timer, Collection, ArrowLeft } from '@element-plus/icons-vue'

const router = useRouter()
const progressList = ref([])

const totalTime = computed(() => {
  return progressList.value.reduce((sum, item) => sum + (item.totalTimeSpent || 0), 0)
})

onMounted(() => {
  loadProgress()
})

const loadProgress = async () => {
  try {
    const response = await getUserProgress()
    progressList.value = response.data
  } catch (error) {
    console.error('加载学习进度失败', error)
  }
}

const continueLearn = (furnitureId) => {
  router.push(`/learn/${furnitureId}`)
}
</script>

<style scoped>
.progress-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.header {
  background: white;
  border-bottom: 1px solid #e4e7ed;
  padding: 0;
  height: 60px;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 20px;
  gap: 20px;
}

.title {
  font-size: 18px;
  margin: 0;
  color: #333;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.stat-card {
  height: 120px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 100%;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.learning {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-icon.completed {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}

.stat-icon.time {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-icon.total {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.progress-list-card {
  margin-top: 20px;
}
</style>
