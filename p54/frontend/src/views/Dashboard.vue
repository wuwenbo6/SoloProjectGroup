<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #409EFF">
              <el-icon :size="30"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalRubbings || 0 }}</div>
              <div class="stat-label">拓片总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #67C23A">
              <el-icon :size="30"><Edit /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalAnnotations || 0 }}</div>
              <div class="stat-label">释读文字</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #E6A23C">
              <el-icon :size="30"><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalUsers || 0 }}</div>
              <div class="stat-label">用户总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #F56C6C">
              <el-icon :size="30"><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.completed || 0 }}</div>
              <div class="stat-label">已完成</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="content-row">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最新拓片</span>
              <el-button type="primary" size="small" @click="$router.push('/collection')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentRubbings" style="width: 100%">
            <el-table-column prop="title" label="标题" width="200" />
            <el-table-column prop="category" label="分类" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ getCategoryLabel(row.category) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="dynasty" label="朝代" width="120" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="annotationProgress" label="进度" width="120">
              <template #default="{ row }">
                <el-progress :percentage="row.annotationProgress || 0" :stroke-width="10" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button type="primary" size="small" link @click="goToDetail(row.id)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>分类统计</span>
          </template>
          <div class="category-chart">
            <div v-for="(item, index) in categoryStats" :key="index" class="category-item">
              <div class="category-name">{{ item.name }}</div>
              <div class="category-bar">
                <div class="category-fill" :style="{ width: item.percentage + '%', background: item.color }"></div>
              </div>
              <div class="category-count">{{ item.count }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()
const stats = ref({})
const recentRubbings = ref([])
const categoryStats = ref([
  { name: '碑刻', count: 0, percentage: 0, color: '#409EFF' },
  { name: '青铜器', count: 0, percentage: 0, color: '#67C23A' },
  { name: '玉器', count: 0, percentage: 0, color: '#E6A23C' },
  { name: '陶器', count: 0, percentage: 0, color: '#F56C6C' },
  { name: '其他', count: 0, percentage: 0, color: '#909399' }
])

async function loadDashboard() {
  try {
    const res = await api.get('/rubbing/list?pageSize=10')
    recentRubbings.value = res.data.rubbings || []
    
    stats.value = {
      totalRubbings: res.data.total || 0,
      totalAnnotations: recentRubbings.value.reduce((sum, r) => sum + (r.annotatedCharacters || 0), 0),
      totalUsers: 0,
      completed: recentRubbings.value.filter(r => r.status === 'completed').length
    }

    const categoryMap = { stele: 0, bronze: 1, jade: 2, pottery: 3, other: 4 }
    recentRubbings.value.forEach(r => {
      const idx = categoryMap[r.category] ?? 4
      categoryStats.value[idx].count++
    })
    
    const total = categoryStats.value.reduce((sum, c) => sum + c.count, 0)
    if (total > 0) {
      categoryStats.value.forEach(c => {
        c.percentage = Math.round((c.count / total) * 100)
      })
    }
  } catch (err) {
    console.error(err)
  }
}

function getCategoryLabel(category) {
  const labels = { stele: '碑刻', bronze: '青铜', jade: '玉器', pottery: '陶器', other: '其他' }
  return labels[category] || category
}

function getStatusLabel(status) {
  const labels = { uploaded: '已上传', processing: '处理中', processed: '已处理', annotating: '释读中', completed: '已完成' }
  return labels[status] || status
}

function getStatusType(status) {
  const types = { uploaded: 'info', processing: 'warning', processed: 'warning', annotating: 'primary', completed: 'success' }
  return types[status] || 'info'
}

function goToDetail(id) {
  router.push(`/rubbing-detail/${id}`)
}

onMounted(() => {
  loadDashboard()
})
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border: none;
}

.stat-content {
  display: flex;
  align-items: center;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-right: 20px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.content-row {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-chart {
  padding: 10px 0;
}

.category-item {
  margin-bottom: 20px;
}

.category-name {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.category-bar {
  height: 10px;
  background: #f0f0f0;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 4px;
}

.category-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s;
}

.category-count {
  font-size: 12px;
  color: #999;
  text-align: right;
}
</style>
