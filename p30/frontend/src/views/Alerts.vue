<template>
  <div class="alerts-page">
    <h2 class="page-title">预警信息</h2>
    
    <el-card class="filter-card">
      <el-form :inline="true" :model="filters">
        <el-form-item label="状态">
          <el-select v-model="filters.resolved" placeholder="请选择状态" style="width: 150px">
            <el-option label="未处理" :value="false" />
            <el-option label="已处理" :value="true" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadAlerts">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="alerts-card">
      <el-timeline>
        <el-timeline-item
          v-for="alert in alerts"
          :key="alert.id"
          :timestamp="formatDate(alert.timestamp)"
          :type="getSeverityType(alert.severity)"
          :color="getSeverityColor(alert.severity)"
          size="large"
        >
          <el-card class="alert-card">
            <template #header>
              <div class="alert-header">
                <span class="alert-title">
                  <el-icon :size="20"><Warning /></el-icon>
                  {{ alert.alert_type }}
                </span>
                <el-tag :type="alert.resolved ? 'success' : 'warning'" size="small">
                  {{ alert.resolved ? '已处理' : '待处理' }}
                </el-tag>
              </div>
            </template>
            <p class="alert-message">{{ alert.message }}</p>
            <div class="alert-footer">
              <span class="alert-edge">边缘节点: {{ alert.edge_id }}</span>
              <el-button 
                v-if="!alert.resolved"
                type="primary" 
                size="small"
                @click="markResolved(alert.id)"
              >
                标记已处理
              </el-button>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'

const alerts = ref([])
const filters = ref({
  resolved: false
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const getSeverityType = (severity) => {
  switch (severity) {
    case 'high': return 'danger'
    case 'medium': return 'warning'
    case 'low': return 'info'
    default: return 'primary'
  }
}

const getSeverityColor = (severity) => {
  switch (severity) {
    case 'high': return '#f56c6c'
    case 'medium': return '#e6a23c'
    case 'low': return '#409eff'
    default: return '#909399'
  }
}

const loadAlerts = async () => {
  try {
    const res = await fetch(`/api/v1/alerts?resolved=${filters.value.resolved}`)
    alerts.value = await res.json()
  } catch (e) {
    console.error('Failed to load alerts:', e)
  }
}

const markResolved = (id) => {
  ElMessage.success('已标记为已处理')
  loadAlerts()
}

onMounted(() => {
  loadAlerts()
})
</script>

<style scoped>
.alerts-page {
  height: 100%;
}

.page-title {
  margin-bottom: 20px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.filter-card {
  margin-bottom: 20px;
}

.alerts-card {
  margin-bottom: 20px;
}

.alert-card {
  margin-bottom: 10px;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.alert-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.alert-message {
  margin: 10px 0;
  color: #606266;
  font-size: 14px;
}

.alert-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #ebeef5;
}

.alert-edge {
  font-size: 12px;
  color: #909399;
}
</style>
