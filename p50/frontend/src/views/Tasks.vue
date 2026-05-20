<template>
  <div class="tasks-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>合成任务列表</span>
          <el-button size="small" :icon="Refresh" @click="loadTasks">刷新</el-button>
        </div>
      </template>

      <el-table :data="tasks" stripe v-loading="loading">
        <el-table-column prop="task_id" label="任务ID" width="280" />
        <el-table-column prop="dialect_id" label="方言ID" width="80" />
        <el-table-column prop="text" label="合成文本" show-overflow-tooltip min-width="200" />
        <el-table-column prop="emotion" label="情感" width="80">
          <template #default="{ row }">
            {{ getEmotionLabel(row.emotion) }}
          </template>
        </el-table-column>
        <el-table-column prop="speed" label="语速" width="80">
          <template #default="{ row }">{{ row.speed }}x</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'completed'"
              size="small"
              type="success"
              @click="playAudio(row)"
            >
              播放
            </el-button>
            <el-button v-else size="small" disabled>处理中</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { synthesisApi } from '@/utils/api'

const tasks = ref([])
const loading = ref(false)

const loadTasks = async () => {
  loading.value = true
  try {
    const response = await synthesisApi.getTasks()
    tasks.value = response.data.tasks || []
  } catch (error) {
    console.error('加载任务列表失败')
  } finally {
    loading.value = false
  }
}

const getEmotionLabel = (emotion) => {
  const map = { neutral: '中性', happy: '开心', sad: '悲伤', angry: '生气', surprise: '惊讶' }
  return map[emotion] || emotion
}

const getStatusType = (status) => {
  const map = { pending: 'warning', processing: 'primary', completed: 'success', failed: 'danger' }
  return map[status] || 'info'
}

const getStatusLabel = (status) => {
  const map = { pending: '等待中', processing: '处理中', completed: '已完成', failed: '失败' }
  return map[status] || status
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const playAudio = (row) => {
  ElMessage.info('播放音频功能（演示）')
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
