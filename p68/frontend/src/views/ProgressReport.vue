<template>
  <div class="progress-report">
    <el-header class="header">
      <div class="header-content">
        <el-button @click="$router.push('/')" icon="ArrowLeft">返回</el-button>
        <h1 class="title">学习进度报表</h1>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          @change="loadReportData"
        />
      </div>
    </el-header>

    <el-main class="main-content">
      <!-- 统计卡片 -->
      <el-row :gutter="20" style="margin-bottom: 20px;">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-icon total">
              <el-icon :size="30"><Collection /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ reportData.totalCourses }}</div>
              <div class="stat-label">总课程数</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-icon completed">
              <el-icon :size="30"><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ reportData.completedCourses }}</div>
              <div class="stat-label">已完成</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-icon learning">
              <el-icon :size="30"><Reading /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ reportData.learningCourses }}</div>
              <div class="stat-label">学习中</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-icon time">
              <el-icon :size="30"><Timer /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatTime(reportData.totalTime) }}</div>
              <div class="stat-label">总学习时长</div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <!-- 完成进度环形图 -->
        <el-col :span="8">
          <el-card class="chart-card">
            <template #header>
              <div class="card-header">
                <span>总体完成度</span>
              </div>
            </template>
            <div class="ring-chart">
              <div class="ring-container">
                <svg viewBox="0 0 100 100" class="ring-svg">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e4e7ed" stroke-width="10" />
                  <circle 
                    cx="50" cy="50" r="40" fill="none" stroke="#67c23a" stroke-width="10"
                    :stroke-dasharray="`${ringProgress} 251.2`"
                    stroke-dashoffset="0"
                    stroke-linecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div class="ring-center">
                  <div class="ring-percent">{{ Math.round(ringProgress / 251.2 * 100) }}%</div>
                  <div class="ring-label">完成率</div>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 学习时间趋势 -->
        <el-col :span="8">
          <el-card class="chart-card">
            <template #header>
              <div class="card-header">
                <span>学习时间趋势</span>
              </div>
            </template>
            <div class="bar-chart">
              <div v-for="(item, index) in timeTrend" :key="index" class="bar-item">
                <div class="bar-label">{{ item.date }}</div>
                <div class="bar-wrapper">
                  <div class="bar-fill" :style="{ height: (item.minutes / maxTime) * 100 + '%' }"></div>
                </div>
                <div class="bar-value">{{ item.minutes }}分</div>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 难度分布 -->
        <el-col :span="8">
          <el-card class="chart-card">
            <template #header>
              <div class="card-header">
                <span>难度分布</span>
              </div>
            </template>
            <div class="difficulty-chart">
              <div v-for="(item, index) in difficultyData" :key="index" class="difficulty-item">
                <div class="difficulty-label">
                  <el-rate v-model="item.level" disabled show-score text-color="#ff9900" />
                </div>
                <div class="difficulty-bar">
                  <div class="difficulty-fill" :style="{ width: item.percent + '%' }"></div>
                </div>
                <div class="difficulty-value">{{ item.count }}个</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 课程进度详情 -->
      <el-row style="margin-top: 20px;">
        <el-col :span="24">
          <el-card class="detail-card">
            <template #header>
              <div class="card-header">
                <span>课程进度详情</span>
                <el-select v-model="filterStatus" placeholder="筛选状态" size="small" style="width: 120px;">
                  <el-option label="全部" value="" />
                  <el-option label="已完成" value="completed" />
                  <el-option label="学习中" value="learning" />
                  <el-option label="未开始" value="notStarted" />
                </el-select>
              </div>
            </template>
            <el-table :data="filteredProgress" style="width: 100%;">
              <el-table-column prop="furnitureName" label="课程名称" width="200" />
              <el-table-column label="完成进度" width="250">
                <template #default="{ row }">
                  <el-progress 
                    :percentage="Math.round((row.currentStep / row.totalSteps) * 100)" 
                    :status="row.isCompleted ? 'success' : ''"
                  />
                </template>
              </el-table-column>
              <el-table-column prop="currentStep" label="当前步骤" width="100" align="center">
                <template #default="{ row }">
                  {{ row.currentStep }} / {{ row.totalSteps }}
                </template>
              </el-table-column>
              <el-table-column prop="totalTimeSpent" label="学习时长(分钟)" width="120" align="center" />
              <el-table-column prop="lastAccessed" label="最近学习" width="180" align="center" />
              <el-table-column label="状态" width="100" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.isCompleted" type="success">已完成</el-tag>
                  <el-tag v-else-if="row.currentStep > 0" type="primary">学习中</el-tag>
                  <el-tag v-else type="info">未开始</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="120" align="center">
                <template #default="{ row }">
                  <el-button type="primary" size="small" link @click="goToLearn(row.furnitureId)">
                    {{ row.isCompleted ? '复习' : '继续学习' }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </el-main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Collection, CircleCheck, Reading, Timer } from '@element-plus/icons-vue'
import { getUserProgress } from '@/api/progress'

const router = useRouter()
const dateRange = ref([])
const filterStatus = ref('')

const reportData = ref({
  totalCourses: 0,
  completedCourses: 0,
  learningCourses: 0,
  totalTime: 0
})

const progressList = ref([])

const ringProgress = computed(() => {
  if (reportData.value.totalCourses === 0) return 0
  return (reportData.value.completedCourses / reportData.value.totalCourses) * 251.2
})

const timeTrend = ref([
  { date: '周一', minutes: 45 },
  { date: '周二', minutes: 60 },
  { date: '周三', minutes: 30 },
  { date: '周四', minutes: 80 },
  { date: '周五', minutes: 55 },
  { date: '周六', minutes: 90 },
  { date: '周日', minutes: 120 }
])

const maxTime = computed(() => {
  return Math.max(...timeTrend.value.map(t => t.minutes), 1)
})

const difficultyData = ref([
  { level: 1, count: 3, percent: 30 },
  { level: 2, count: 5, percent: 50 },
  { level: 3, count: 2, percent: 20 }
])

const filteredProgress = computed(() => {
  if (!filterStatus.value) return progressList.value
  return progressList.value.filter(item => {
    if (filterStatus.value === 'completed') return item.isCompleted
    if (filterStatus.value === 'learning') return !item.isCompleted && item.currentStep > 0
    if (filterStatus.value === 'notStarted') return item.currentStep === 0
    return true
  })
})

onMounted(() => {
  loadReportData()
})

const loadReportData = async () => {
  try {
    const res = await getUserProgress()
    progressList.value = res.data.map(item => ({
      ...item,
      furnitureName: `家具课程 ${item.furnitureId}`
    }))
    
    reportData.value = {
      totalCourses: progressList.value.length,
      completedCourses: progressList.value.filter(p => p.isCompleted).length,
      learningCourses: progressList.value.filter(p => !p.isCompleted && p.currentStep > 0).length,
      totalTime: progressList.value.reduce((sum, p) => sum + p.totalTimeSpent, 0)
    }
  } catch (error) {
    console.error('加载报表数据失败', error)
    ElMessage.error('加载报表数据失败')
  }
}

const formatTime = (minutes) => {
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`
}

const goToLearn = (furnitureId) => {
  router.push(`/learn/${furnitureId}`)
}
</script>

<style scoped>
.progress-report {
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
  gap: 15px;
}

.title {
  flex: 1;
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
  height: 100px;
}

.stat-card .el-card__body {
  display: flex;
  align-items: center;
  padding: 15px;
  gap: 15px;
  height: 100%;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-icon.total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.completed {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.stat-icon.learning {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.time {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.chart-card {
  height: 350px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  color: #333;
}

.ring-chart {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 250px;
}

.ring-container {
  position: relative;
  width: 180px;
  height: 180px;
}

.ring-svg {
  width: 100%;
  height: 100%;
}

.ring-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.ring-percent {
  font-size: 32px;
  font-weight: bold;
  color: #67c23a;
}

.ring-label {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.bar-chart {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 250px;
  padding: 20px 0;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 10px;
}

.bar-wrapper {
  flex: 1;
  width: 30px;
  background: #e4e7ed;
  border-radius: 4px 4px 0 0;
  position: relative;
  display: flex;
  align-items: flex-end;
}

.bar-fill {
  width: 100%;
  background: linear-gradient(180deg, #409eff 0%, #66b1ff 100%);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
}

.bar-value {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

.difficulty-chart {
  padding: 10px 0;
}

.difficulty-item {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}

.difficulty-label {
  width: 100px;
}

.difficulty-bar {
  flex: 1;
  height: 12px;
  background: #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}

.difficulty-fill {
  height: 100%;
  background: linear-gradient(90deg, #e6a23c 0%, #f5d76e 100%);
  border-radius: 6px;
  transition: width 0.3s ease;
}

.difficulty-value {
  width: 50px;
  font-size: 14px;
  color: #666;
  text-align: right;
}

.detail-card {
  height: auto;
}
</style>
