<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon total">
              <el-icon size="32"><DocumentCopy /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">拓片总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon processing">
              <el-icon size="32"><Loading /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.processing }}</div>
              <div class="stat-label">处理中</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon ready">
              <el-icon size="32"><Edit /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.ready }}</div>
              <div class="stat-label">待释读</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon completed">
              <el-icon size="32"><SuccessFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.completed }}</div>
              <div class="stat-label">已完成</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="list-card">
      <template #header>
        <div class="card-header">
          <span>我的拓片</span>
          <el-button type="primary" @click="goToCapture">
            <el-icon><Plus /></el-icon>
            上传新拓片
          </el-button>
        </div>
      </template>

      <el-table :data="rubbings" v-loading="loading" stripe>
        <el-table-column prop="title" label="标题" min-width="200">
          <template #default="{ row }">
            <div class="title-cell" @click="goToDetail(row._id)">
              <el-icon><Picture /></el-icon>
              <span>{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="dynasty" label="朝代" width="120" />
        <el-table-column label="进度" width="150">
          <template #default="{ row }">
            <el-progress :percentage="row.progress || 0" :stroke-width="12" />
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="goToDetail(row._id)">查看</el-button>
            <el-button
              size="small"
              type="primary"
              @click="goToInterpret(row._id)"
              :disabled="row.status === 'uploaded' || row.status === 'processing'"
            >
              释读
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > 0"
        v-model:current-page="page"
        v-model:page-size="limit"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @current-change="loadRubbings"
        @size-change="loadRubbings"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { rubbingAPI } from '@/api'
import { ElMessage } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const rubbings = ref([])
const page = ref(1)
const limit = ref(10)
const total = ref(0)

const stats = computed(() => {
  const result = { total: 0, processing: 0, ready: 0, completed: 0 }
  rubbings.value.forEach(r => {
    result.total++
    if (r.status === 'processing') result.processing++
    else if (r.status === 'ready') result.ready++
    else if (r.status === 'completed') result.completed++
  })
  return result
})

const loadRubbings = async () => {
  loading.value = true
  try {
    const response = await rubbingAPI.list({ page: page.value, limit: limit.value })
    rubbings.value = response.data.rubbings
    total.value = response.data.pagination.total
  } catch (error) {
    ElMessage.error('加载拓片列表失败')
  } finally {
    loading.value = false
  }
}

const getStatusType = (status) => {
  const map = {
    uploaded: 'info',
    processing: 'warning',
    ready: 'primary',
    completed: 'success'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    uploaded: '已上传',
    processing: '处理中',
    ready: '待释读',
    completed: '已完成'
  }
  return map[status] || status
}

const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN')
}

const goToCapture = () => {
  router.push('/capture')
}

const goToDetail = (id) => {
  router.push(`/rubbings/${id}`)
}

const goToInterpret = (id) => {
  router.push(`/rubbings/${id}/interpret`)
}

onMounted(() => {
  loadRubbings()
})
</script>

<style scoped>
.dashboard {
  padding: 0;
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
  gap: 16px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.stat-icon.total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.processing {
  background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
}

.stat-icon.ready {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.completed {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.list-card {
  border: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #409eff;
}

.title-cell:hover {
  color: #66b1ff;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}
</style>
