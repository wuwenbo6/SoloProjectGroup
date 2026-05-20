<template>
  <div class="learning-report">
    <div class="report-header">
      <h2>{{ t('report.title') }}</h2>
      <el-select v-model="timeRange" size="small" style="width: 120px">
        <el-option label="本周" value="week" />
        <el-option label="本月" value="month" />
        <el-option label="全部" value="all" />
      </el-select>
    </div>

    <el-row :gutter="20" class="overview-section">
      <el-col :xs="24" :sm="12" :md="6">
        <div class="stat-card stitches-learned">
          <div class="stat-icon">
            <el-icon :size="32"><Brush /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ progressData.stitchesLearned }}</div>
            <div class="stat-label">{{ t('report.stitchesLearned') }}</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="stat-card hours-learned">
          <div class="stat-icon">
            <el-icon :size="32"><Clock /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ progressData.hoursLearned }}</div>
            <div class="stat-label">{{ t('report.totalHours') }}</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="stat-card completion-rate">
          <div class="stat-icon">
            <el-icon :size="32"><Odometer /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ progressData.completionRate }}%</div>
            <div class="stat-label">{{ t('report.completionRate') }}</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <div class="stat-card accuracy">
          <div class="stat-icon">
            <el-icon :size="32"><Trophy /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ progressData.averageScore }}%</div>
            <div class="stat-label">{{ t('practice.result.accuracy') }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-section">
      <el-col :xs="24" :lg="14">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('report.weeklyActivity') }}</span>
              <el-radio-group v-model="chartType" size="small">
                <el-radio-button label="bar">柱状图</el-radio-button>
                <el-radio-button label="line">折线图</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div class="chart-container">
            <div class="bar-chart" v-if="chartType === 'bar'">
              <div v-for="(item, idx) in weeklyData" :key="idx" class="bar-item">
                <div class="bar-wrapper">
                  <div class="bar" :style="{ height: (item.minutes / 60 * 100) + '%' }"></div>
                </div>
                <span class="bar-label">{{ item.day }}</span>
                <span class="bar-value">{{ item.minutes }}分钟</span>
              </div>
            </div>
            <div class="line-chart" v-else>
              <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet">
                <polyline 
                  :points="linePoints"
                  fill="none"
                  stroke="#667eea"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <circle v-for="(p, i) in chartPoints" :key="i"
                  :cx="p.x" :cy="p.y" r="6"
                  fill="#667eea" stroke="white" stroke-width="2"
                />
              </svg>
              <div class="x-labels">
                <span v-for="item in weeklyData" :key="item.day">{{ item.day }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="10">
        <el-card class="achievement-card">
          <template #header>
            <span>{{ t('report.achievements') }}</span>
          </template>
          <div class="achievements-grid">
            <div 
              v-for="achievement in achievements" 
              :key="achievement.id"
              class="achievement-item"
              :class="{ unlocked: achievement.unlocked }"
            >
              <div class="achievement-icon">
                <el-icon :size="28">
                  <component :is="achievement.icon" />
                </el-icon>
              </div>
              <div class="achievement-info">
                <div class="achievement-name">{{ achievement.name }}</div>
                <div class="achievement-desc">{{ achievement.description }}</div>
              </div>
              <div class="achievement-status" v-if="achievement.unlocked">
                <el-icon color="#67c23a"><CircleCheck /></el-icon>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="details-section">
      <el-col :xs="24" :lg="14">
        <el-card class="progress-card">
          <template #header>
            <span>针法学习进度</span>
          </template>
          <div class="progress-list">
            <div v-for="item in stitchProgress" :key="item.id" class="progress-item">
              <div class="progress-info">
                <div class="stitch-name">{{ item.name }}</div>
                <div class="stitch-category" v-if="item.category">{{ item.category }}</div>
              </div>
              <div class="progress-bar-wrapper">
                <el-progress :percentage="item.progress" :status="item.progress === 100 ? 'success' : ''" />
              </div>
              <div class="progress-actions">
                <el-button type="primary" size="small" @click="continueLearning(item)">
                  继续学习
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="10">
        <el-card class="distribution-card">
          <template #header>
            <span>{{ t('report.categoryDistribution') }}</span>
          </template>
          <div class="donut-chart">
            <svg viewBox="0 0 200 200">
              <circle 
                v-for="(cat, idx) in categoryDistribution"
                :key="cat.name"
                cx="100" cy="100" r="70"
                fill="none"
                :stroke="cat.color"
                stroke-width="30"
                :stroke-dasharray="getDashArray(cat.value, idx)"
                :stroke-dashoffset="getDashOffset(idx)"
                transform="rotate(-90 100 100)"
              />
            </svg>
            <div class="chart-center">
              <div class="total-stitches">{{ categoryTotal }}</div>
              <div class="total-label">总数</div>
            </div>
          </div>
          <div class="category-legend">
            <div v-for="cat in categoryDistribution" :key="cat.name" class="legend-item">
              <span class="legend-color" :style="{ background: cat.color }"></span>
              <span class="legend-name">{{ cat.name }}</span>
              <span class="legend-value">{{ cat.value }} ({{ cat.percentage }}%)</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/store/user'
import { progressAPI, stitchAPI } from '@/api'

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()

const timeRange = ref('week')
const chartType = ref('bar')

const progressData = ref({
  stitchesLearned: 3,
  hoursLearned: 12.5,
  completionRate: 60,
  averageScore: 78
})

const weeklyData = ref([
  { day: '周一', minutes: 45 },
  { day: '周二', minutes: 30 },
  { day: '周三', minutes: 60 },
  { day: '周四', minutes: 25 },
  { day: '周五', minutes: 50 },
  { day: '周六', minutes: 90 },
  { day: '周日', minutes: 40 }
])

const achievements = ref([
  { id: 1, name: '初学者', description: '完成第一个针法', icon: 'Medal', unlocked: true },
  { id: 2, name: '五日坚持', description: '连续学习5天', icon: 'Calendar', unlocked: true },
  { id: 3, name: '优秀学员', description: '测验获得满分', icon: 'Trophy', unlocked: false },
  { id: 4, name: '针法大师', description: '完成10个针法', icon: 'Star', unlocked: false },
  { id: 5, name: '分享达人', description: '分享10次作品', icon: 'Share', unlocked: false },
  { id: 6, name: '周学习冠军', description: '周学习时长第一', icon: 'FirstAidKit', unlocked: false }
])

const stitchProgress = ref([])

const categoryDistribution = ref([
  { name: '基础针法', value: 3, percentage: 50, color: '#667eea' },
  { name: '装饰针法', value: 2, percentage: 33, color: '#764ba2' },
  { name: '立体针法', value: 1, percentage: 17, color: '#f093fb' }
])

const categoryTotal = computed(() => {
  return categoryDistribution.value.reduce((sum, cat) => sum + cat.value, 0)
})

const chartPoints = computed(() => {
  const maxValue = Math.max(...weeklyData.value.map(d => d.minutes))
  return weeklyData.value.map((item, idx) => ({
    x: 50 + idx * 80,
    y: 180 - (item.minutes / maxValue) * 150
  }))
})

const linePoints = computed(() => {
  return chartPoints.value.map(p => `${p.x},${p.y}`).join(' ')
})

const getDashArray = (value, idx) => {
  const circumference = 2 * Math.PI * 70
  const percentage = value / categoryTotal.value
  return `${percentage * circumference} ${circumference}`
}

const getDashOffset = (idx) => {
  const circumference = 2 * Math.PI * 70
  let offset = 0
  for (let i = 0; i < idx; i++) {
    const percentage = categoryDistribution.value[i].value / categoryTotal.value
    offset += percentage * circumference
  }
  return -offset
}

const continueLearning = (stitch) => {
  router.push(`/stitch/${stitch.id}`)
}

onMounted(async () => {
  try {
    const stitchRes = await stitchAPI.getStitches()
    if (stitchRes.success) {
      stitchProgress.value = stitchRes.stitches.slice(0, 5).map((s, i) => ({
        ...s,
        progress: Math.min(100, 20 + i * 20)
      }))
    }

    if (userStore.user?.id) {
      const progressRes = await progressAPI.getStats(userStore.user.id)
      if (progressRes.success) {
      }
    }
  } catch (error) {
    console.error('加载学习数据失败', error)
  }
})
</script>

<style scoped>
.learning-report {
  padding: 20px;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.report-header h2 {
  margin: 0;
  color: #303133;
}

.overview-section {
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
  border-radius: 12px;
  color: white;
  margin-bottom: 20px;
}

.stat-card.stitches-learned {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-card.hours-learned {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-card.completion-rate {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-card.accuracy {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-icon {
  margin-right: 15px;
  opacity: 0.9;
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  line-height: 1;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.charts-section {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-container {
  min-height: 250px;
  padding: 20px 0;
}

.bar-chart {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 200px;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 14%;
}

.bar-wrapper {
  width: 100%;
  height: 150px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 60%;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px 6px 0 0;
  transition: height 0.3s ease;
  min-height: 5px;
}

.bar-label {
  margin-top: 10px;
  font-size: 12px;
  color: #606266;
}

.bar-value {
  font-size: 11px;
  color: #909399;
}

.line-chart {
  position: relative;
  height: 220px;
}

.line-chart svg {
  width: 100%;
  height: 180px;
}

.x-labels {
  display: flex;
  justify-content: space-around;
  font-size: 12px;
  color: #606266;
}

.achievements-grid {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.achievement-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  background: #f5f7fa;
  opacity: 0.5;
  transition: all 0.3s;
}

.achievement-item.unlocked {
  opacity: 1;
  background: linear-gradient(135deg, #f0f9eb 0%, #e6f7ff 100%);
}

.achievement-icon {
  margin-right: 12px;
  color: #909399;
}

.achievement-item.unlocked .achievement-icon {
  color: #67c23a;
}

.achievement-info {
  flex: 1;
}

.achievement-name {
  font-weight: 500;
  color: #303133;
  margin-bottom: 3px;
}

.achievement-desc {
  font-size: 12px;
  color: #909399;
}

.details-section {
  margin-bottom: 20px;
}

.progress-list {
  max-height: 400px;
  overflow-y: auto;
}

.progress-item {
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #ebeef5;
}

.progress-item:last-child {
  border-bottom: none;
}

.progress-info {
  width: 120px;
  flex-shrink: 0;
}

.stitch-name {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.stitch-category {
  font-size: 12px;
  color: #909399;
}

.progress-bar-wrapper {
  flex: 1;
  padding: 0 15px;
}

.progress-actions {
  flex-shrink: 0;
}

.donut-chart {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto 20px;
}

.donut-chart svg {
  width: 100%;
  height: 100%;
}

.chart-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.total-stitches {
  font-size: 32px;
  font-weight: bold;
  color: #303133;
}

.total-label {
  font-size: 14px;
  color: #909399;
}

.category-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-name {
  flex: 1;
  font-size: 14px;
  color: #606266;
}

.legend-value {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

@media (max-width: 768px) {
  .learning-report {
    padding: 10px;
  }
  
  .stat-number {
    font-size: 22px;
  }
  
  .progress-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .progress-info {
    width: 100%;
  }
  
  .progress-bar-wrapper {
    width: 100%;
    padding: 0;
  }
}
</style>
