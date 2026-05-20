<template>
  <div class="review-page">
    <el-card class="page-header-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <h2>释读审核中心</h2>
            <el-badge :value="stats.pending" class="pending-badge">待审核</el-badge>
          </div>
        </div>
      </template>

      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-value">{{ stats.total || 0 }}</div>
            <div class="stat-label">总审核数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card pending">
            <div class="stat-value">{{ stats.pending || 0 }}</div>
            <div class="stat-label">待审核</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card approved">
            <div class="stat-value">{{ stats.approved || 0 }}</div>
            <div class="stat-label">已通过</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card urgent">
            <div class="stat-value">{{ urgentCount }}</div>
            <div class="stat-label">高优先级</div>
          </div>
        </el-col>
      </el-row>

      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="状态">
          <el-select
            v-model="filters.status"
            placeholder="审核状态"
            clearable
            style="width: 120px"
            @change="loadReviews"
          >
            <el-option label="待审核" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已驳回" value="rejected" />
            <el-option label="需修改" value="needs_revision" />
          </el-select>
        </el-form-item>

        <el-form-item label="优先级">
          <el-select
            v-model="filters.priority"
            placeholder="优先级"
            clearable
            style="width: 120px"
            @change="loadReviews"
          >
            <el-option label="高" value="high" />
            <el-option label="普通" value="normal" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="isAdminOrExpert">
          <el-checkbox v-model="showOnlyMy" @change="loadReviews">
            只看我提交的
          </el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="loadReviews" :loading="loading">
            刷新
          </el-button>
          <el-button
            v-if="isAdminOrExpert && selectedIds.length > 0"
            type="success"
            @click="batchApprove"
            :loading="batchLoading"
          >
            批量通过 ({{ selectedIds.length }})
          </el-button>
          <el-button
            v-if="isAdminOrExpert && selectedIds.length > 0"
            type="danger"
            @click="batchReject"
            :loading="batchLoading"
          >
            批量驳回 ({{ selectedIds.length }})
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table
        :data="reviews"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        stripe
      >
        <el-table-column type="selection" width="55" v-if="isAdminOrExpert" />
        <el-table-column label="序号" width="70" type="index" />
        <el-table-column label="文字" width="100">
          <template #default="{ row }">
            <span class="char-text">{{ row.Annotation?.character || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="拼音" prop="Annotation.pinyin" width="100" />
        <el-table-column label="释义" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.Annotation?.meaning || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="getPriorityType(row.priority)" size="small">
              {{ getPriorityLabel(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="审核人" width="100" v-if="isAdminOrExpert">
          <template #default="{ row }">
            {{ row.Reviewer?.realName || row.Reviewer?.username || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="viewDetail(row)">查看</el-button>
            <el-button
              v-if="isAdminOrExpert && row.status === 'pending'"
              type="primary"
              size="small"
              @click="approveReview(row)"
              :loading="processingId === row.id"
            >
              通过
            </el-button>
            <el-button
              v-if="isAdminOrExpert && row.status === 'pending'"
              type="danger"
              size="small"
              @click="rejectReview(row)"
              :loading="processingId === row.id"
            >
              驳回
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadReviews"
        @current-change="loadReviews"
        class="pagination"
      />
    </el-card>

    <el-dialog
      v-model="showDetail"
      title="审核详情"
      width="800px"
      :close-on-click-modal="false"
    >
      <div v-if="currentReview" class="review-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="文字">
            <span class="char-large">{{ currentReview.Annotation?.character || '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentReview.status)">
              {{ getStatusLabel(currentReview.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="拼音">
            {{ currentReview.Annotation?.pinyin || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="部首">
            {{ currentReview.Annotation?.radical || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="释义" :span="2">
            {{ currentReview.Annotation?.meaning || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间" :span="2">
            {{ formatDate(currentReview.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="原始数据" :span="2">
            <pre class="original-data">{{ JSON.stringify(currentReview.originalData, null, 2) }}</pre>
          </el-descriptions-item>
          <el-descriptions-item v-if="currentReview.suggestedData" label="建议修改" :span="2">
            <pre class="suggested-data">{{ JSON.stringify(currentReview.suggestedData, null, 2) }}</pre>
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="currentReview.status === 'pending' && isAdminOrExpert" class="review-actions">
          <el-form :model="reviewForm" label-width="100px">
            <el-form-item label="审核结果">
              <el-radio-group v-model="reviewForm.status">
                <el-radio value="approved">通过</el-radio>
                <el-radio value="rejected">驳回</el-radio>
                <el-radio value="needs_revision">需修改</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="审核意见">
              <el-input
                v-model="reviewForm.comments"
                type="textarea"
                :rows="4"
                placeholder="请输入审核意见..."
              />
            </el-form-item>
            <el-form-item label="建议修改">
              <el-input
                v-model="reviewForm.suggestedCharacter"
                placeholder="建议的文字（可选）"
                style="width: 200px; margin-right: 10px"
              />
              <el-input
                v-model="reviewForm.suggestedPinyin"
                placeholder="建议的拼音（可选）"
                style="width: 200px"
              />
            </el-form-item>
          </el-form>
        </div>

        <div v-if="currentReview.status !== 'pending'" class="review-result">
          <h4>审核结果</h4>
          <p><strong>审核时间:</strong> {{ formatDate(currentReview.reviewedAt) }}</p>
          <p v-if="currentReview.comments"><strong>审核意见:</strong> {{ currentReview.comments }}</p>
        </div>
      </div>

      <template #footer>
        <el-button @click="showDetail = false">关闭</el-button>
        <el-button
          v-if="currentReview?.status === 'pending' && isAdminOrExpert"
          type="primary"
          @click="submitReview"
          :loading="processingId === currentReview?.id"
          :disabled="!reviewForm.status"
        >
          提交审核
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/services/api'
import { useAuthStore } from '@/store'

const authStore = useAuthStore()

const loading = ref(false)
const batchLoading = ref(false)
const processingId = ref(null)
const reviews = ref([])
const selectedIds = ref([])
const showDetail = ref(false)
const currentReview = ref(null)

const filters = reactive({
  status: '',
  priority: ''
})
const showOnlyMy = ref(false)

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const stats = ref({
  total: 0,
  pending: 0,
  approved: 0,
  byStatus: [],
  byPriority: []
})

const reviewForm = reactive({
  status: '',
  comments: '',
  suggestedCharacter: '',
  suggestedPinyin: ''
})

const isAdminOrExpert = computed(() => {
  return ['admin', 'expert'].includes(authStore.user?.role)
})

const urgentCount = computed(() => {
  return reviews.value.filter(r => r.priority === 'high' && r.status === 'pending').length
})

function getStatusType(status) {
  const types = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    needs_revision: 'info'
  }
  return types[status] || 'info'
}

function getStatusLabel(status) {
  const labels = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已驳回',
    needs_revision: '需修改'
  }
  return labels[status] || status
}

function getPriorityType(priority) {
  const types = { high: 'danger', normal: 'warning', low: 'info' }
  return types[priority] || 'info'
}

function getPriorityLabel(priority) {
  const labels = { high: '高', normal: '普通', low: '低' }
  return labels[priority] || priority
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

async function loadStats() {
  try {
    const res = await api.get('/review/stats/summary')
    stats.value = res.data
  } catch (err) {
    console.error('加载统计数据失败:', err)
  }
}

async function loadReviews() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...filters
    }
    if (showOnlyMy.value) {
      params.myReviews = true
    }
    const res = await api.get('/review/list', { params })
    reviews.value = res.data.reviews || []
    pagination.total = res.data.total || 0
  } catch (err) {
    console.error('加载审核列表失败:', err)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

function handleSelectionChange(selection) {
  selectedIds.value = selection.map(item => item.id)
}

function viewDetail(review) {
  currentReview.value = review
  reviewForm.status = ''
  reviewForm.comments = ''
  reviewForm.suggestedCharacter = ''
  reviewForm.suggestedPinyin = ''
  showDetail.value = true
}

async function submitReview() {
  if (!reviewForm.status) {
    ElMessage.warning('请选择审核结果')
    return
  }

  processingId.value = currentReview.value.id
  try {
    const suggestedData = {}
    if (reviewForm.suggestedCharacter) {
      suggestedData.character = reviewForm.suggestedCharacter
    }
    if (reviewForm.suggestedPinyin) {
      suggestedData.pinyin = reviewForm.suggestedPinyin
    }

    await api.post(`/review/${currentReview.value.id}/review`, {
      status: reviewForm.status,
      comments: reviewForm.comments,
      suggestedData: Object.keys(suggestedData).length ? suggestedData : null
    })

    ElMessage.success('审核完成')
    showDetail.value = false
    loadReviews()
    loadStats()
  } catch (err) {
    ElMessage.error('审核失败: ' + (err.response?.data?.error || err.message))
  } finally {
    processingId.value = null
  }
}

async function approveReview(review) {
  try {
    await ElMessageBox.confirm('确定通过该释读吗？', '确认审核', {
      type: 'success'
    })
    processingId.value = review.id

    await api.post(`/review/${review.id}/review`, {
      status: 'approved',
      comments: '审核通过'
    })

    ElMessage.success('审核通过')
    loadReviews()
    loadStats()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('操作失败')
    }
  } finally {
    processingId.value = null
  }
}

async function rejectReview(review) {
  try {
    await ElMessageBox.confirm('确定驳回该释读吗？', '确认审核', {
      type: 'warning'
    })
    processingId.value = review.id

    await api.post(`/review/${review.id}/review`, {
      status: 'rejected',
      comments: '审核驳回'
    })

    ElMessage.success('已驳回')
    loadReviews()
    loadStats()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('操作失败')
    }
  } finally {
    processingId.value = null
  }
}

async function batchApprove() {
  try {
    await ElMessageBox.confirm(`确定通过 ${selectedIds.value.length} 条释读吗？`, '批量审核', {
      type: 'success'
    })
    batchLoading.value = true

    await api.post('/review/batch/review', {
      reviewIds: selectedIds.value,
      status: 'approved',
      comments: '批量审核通过'
    })

    ElMessage.success('批量审核完成')
    loadReviews()
    loadStats()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('操作失败')
    }
  } finally {
    batchLoading.value = false
  }
}

async function batchReject() {
  try {
    await ElMessageBox.confirm(`确定驳回 ${selectedIds.value.length} 条释读吗？`, '批量审核', {
      type: 'warning'
    })
    batchLoading.value = true

    await api.post('/review/batch/review', {
      reviewIds: selectedIds.value,
      status: 'rejected',
      comments: '批量审核驳回'
    })

    ElMessage.success('批量驳回完成')
    loadReviews()
    loadStats()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('操作失败')
    }
  } finally {
    batchLoading.value = false
  }
}

onMounted(() => {
  loadStats()
  loadReviews()
})
</script>

<style scoped>
.review-page {
  padding: 20px;
}

.page-header-card {
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-left h2 {
  margin: 0;
}

.pending-badge :deep(.el-badge__content) {
  background: #f56c6c;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  background: #f5f7fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.stat-card.pending {
  background: #fdf6ec;
}

.stat-card.approved {
  background: #f0f9eb;
}

.stat-card.urgent {
  background: #fef0f0;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.filter-form {
  padding-top: 15px;
  border-top: 1px solid #ebeef5;
}

.char-text {
  font-size: 18px;
  font-weight: bold;
  color: #409eff;
}

.char-large {
  font-size: 36px;
  font-weight: bold;
  color: #409eff;
}

.pagination {
  text-align: center;
  margin-top: 20px;
}

.review-detail {
  padding: 10px 0;
}

.original-data, .suggested-data {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  margin: 0;
  font-size: 12px;
  max-height: 150px;
  overflow-y: auto;
}

.suggested-data {
  background: #f0f9eb;
}

.review-actions {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.review-result {
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
}

.review-result h4 {
  margin: 0 0 15px 0;
  color: #303133;
}

.review-result p {
  margin: 8px 0;
}
</style>
