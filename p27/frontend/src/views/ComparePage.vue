<template>
  <div class="compare-page">
    <el-card class="compare-card">
      <template #header>
        <div class="card-header">
          <el-icon size="20"><Comparison /></el-icon>
          <span>文档版本对比</span>
        </div>
      </template>

      <div class="document-selection">
        <el-row :gutter="20">
          <el-col :span="10">
            <div class="selection-label">
              <el-icon><Document /></el-icon>
              原始文档
            </div>
            <el-select
              v-model="originalDocumentId"
              placeholder="选择原始文档"
              style="width: 100%"
              @change="onDocumentChange"
            >
              <el-option
                v-for="doc in documents"
                :key="doc.document_id"
                :label="doc.filename"
                :value="doc.document_id"
              />
            </el-select>
          </el-col>
          <el-col :span="4" class="compare-icon-col">
            <el-icon class="compare-icon" size="40"><Switch /></el-icon>
          </el-col>
          <el-col :span="10">
            <div class="selection-label">
              <el-icon><Document /></el-icon>
              修订版文档
            </div>
            <el-select
              v-model="revisedDocumentId"
              placeholder="选择修订版文档"
              style="width: 100%"
              @change="onDocumentChange"
            >
              <el-option
                v-for="doc in documents"
                :key="doc.document_id"
                :label="doc.filename"
                :value="doc.document_id"
              />
            </el-select>
          </el-col>
        </el-row>

        <div class="action-buttons">
          <el-button
            type="primary"
            size="large"
            :loading="comparing"
            :disabled="!originalDocumentId || !revisedDocumentId"
            @click="startComparison"
          >
            <el-icon><Search /></el-icon>
            开始对比
          </el-button>
          <el-button
            type="success"
            size="large"
            :disabled="!diffResult"
            @click="exportReport('json')"
          >
            <el-icon><Download /></el-icon>
            导出JSON
          </el-button>
          <el-button
            type="warning"
            size="large"
            :disabled="!diffResult"
            @click="exportReport('html')"
          >
            <el-icon><Download /></el-icon>
            导出HTML报告
          </el-button>
        </div>
      </div>

      <div v-if="diffResult" class="comparison-results">
        <el-divider content-position="left">
          <span class="divider-title">对比概览</span>
        </el-divider>

        <el-row :gutter="20" class="stats-row">
          <el-col :span="6">
            <el-statistic title="文档相似度" :value="diffResult.similarity_score" suffix="%">
              <template #suffix>
                <span style="color: #67c23a">%</span>
              </template>
            </el-statistic>
          </el-col>
          <el-col :span="6">
            <el-statistic title="总变更数" :value="diffResult.total_changes">
              <template #suffix>
                <el-tag size="small" type="warning">处</el-tag>
              </template>
            </el-statistic>
          </el-col>
          <el-col :span="6">
            <el-statistic title="实体新增" :value="diffResult.entity_diffs.summary.added">
              <template #suffix>
                <el-tag size="small" type="success">个</el-tag>
              </template>
            </el-statistic>
          </el-col>
          <el-col :span="6">
            <el-statistic title="实体删除" :value="diffResult.entity_diffs.summary.deleted">
              <template #suffix>
                <el-tag size="small" type="danger">个</el-tag>
              </template>
            </el-statistic>
          </el-col>
        </el-row>

        <el-row :gutter="20" class="stats-row">
          <el-col :span="12">
            <div class="doc-info">
              <el-icon size="18"><Document /></el-icon>
              <strong>原始文档:</strong> {{ diffResult.original_document.filename }}
              <el-tag size="small">{{ diffResult.original_document.page_count }}页</el-tag>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="doc-info">
              <el-icon size="18"><Document /></el-icon>
              <strong>修订文档:</strong> {{ diffResult.revised_document.filename }}
              <el-tag size="small">{{ diffResult.revised_document.page_count }}页</el-tag>
            </div>
          </el-col>
        </el-row>

        <el-divider content-position="left">
          <span class="divider-title">实体变更详情</span>
        </el-divider>

        <div v-if="diffResult.entity_diffs.changes.length > 0" class="entity-changes">
          <el-timeline>
            <el-timeline-item
              v-for="(change, index) in diffResult.entity_diffs.changes"
              :key="index"
              :timestamp="change.type"
              :type="getChangeTypeColor(change.change_type)"
              :icon="getChangeIcon(change.change_type)"
            >
              <el-card shadow="hover" class="change-card">
                <div class="change-content">
                  <el-tag :type="getChangeTypeTag(change.change_type)" size="large">
                    {{ getChangeLabel(change.change_type) }}
                  </el-tag>

                  <div v-if="change.change_type === 'modified'" class="modified-values">
                    <div class="old-value">
                      <span class="label">原值:</span>
                      <span class="value diff-deleted-inline">{{ change.original_value }}</span>
                    </div>
                    <div class="new-value">
                      <span class="label">新值:</span>
                      <span class="value diff-inserted-inline">{{ change.revised_value }}</span>
                    </div>
                  </div>

                  <div v-else class="single-value">
                    <span :class="getChangeValueClass(change.change_type)">
                      {{ change.type }}: {{ change.value }}
                    </span>
                  </div>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </div>
        <el-empty v-else description="未检测到实体变更" />

        <el-divider content-position="left">
          <span class="divider-title">段落变更详情</span>
        </el-divider>

        <div class="paragraph-changes">
          <div
            v-for="(diff, index) in displayDiffs"
            :key="index"
            :class="['paragraph-diff', `diff-${diff.change_type}`]"
          >
            <div class="diff-header">
              <el-tag :type="getDiffTypeTag(diff.change_type)" size="small">
                {{ getDiffLabel(diff.change_type) }}
              </el-tag>
              <span v-if="diff.original_index !== null" class="index-info">
                原始段落 #{{ diff.original_index + 1 }}
              </span>
              <span v-if="diff.revised_index !== null" class="index-info">
                修订段落 #{{ diff.revised_index + 1 }}
              </span>
            </div>
            <div
              v-if="diff.change_type === 'modified'"
              class="diff-content"
              v-html="diff.content_html"
            />
            <div v-else class="diff-content">
              <p>{{ diff.content }}</p>
            </div>
          </div>
        </div>

        <div class="pagination-container" v-if="diffResult.paragraph_diffs.length > pageSize">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="diffResult.paragraph_diffs.length"
            layout="prev, pager, next"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Comparison,
  Document,
  Switch,
  Search,
  Download,
  Plus,
  Minus,
  Edit,
  CircleCheck
} from '@element-plus/icons-vue'
import {
  getDocuments,
  compareDocuments,
  exportDiffReport
} from '@/api'

const documents = ref([])
const originalDocumentId = ref('')
const revisedDocumentId = ref('')
const comparing = ref(false)
const diffResult = ref(null)
const currentPage = ref(1)
const pageSize = 20

const displayDiffs = computed(() => {
  if (!diffResult.value) return []
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return diffResult.value.paragraph_diffs.slice(start, end)
})

onMounted(async () => {
  await loadDocuments()
})

const loadDocuments = async () => {
  try {
    const response = await getDocuments()
    documents.value = response.data
  } catch (error) {
    ElMessage.error('加载文档列表失败')
  }
}

const onDocumentChange = () => {
  diffResult.value = null
}

const startComparison = async () => {
  if (!originalDocumentId.value || !revisedDocumentId.value) {
    ElMessage.warning('请选择两个文档进行对比')
    return
  }

  if (originalDocumentId.value === revisedDocumentId.value) {
    ElMessage.warning('请选择两个不同的文档进行对比')
    return
  }

  comparing.value = true
  try {
    const response = await compareDocuments(originalDocumentId.value, revisedDocumentId.value)
    diffResult.value = response.data
    currentPage.value = 1
    ElMessage.success('文档对比完成')
  } catch (error) {
    ElMessage.error('文档对比失败，请重试')
  } finally {
    comparing.value = false
  }
}

const exportReport = async (format) => {
  try {
    const response = await exportDiffReport(
      originalDocumentId.value,
      revisedDocumentId.value,
      format
    )

    if (format === 'html') {
      const blob = new Blob([response.data], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `diff_report_${Date.now()}.html`
      link.click()
      URL.revokeObjectURL(url)
    } else {
      const dataStr = JSON.stringify(response.data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `diff_report_${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
    }

    ElMessage.success('报告导出成功')
  } catch (error) {
    ElMessage.error('导出失败，请重试')
  }
}

const getChangeTypeColor = (changeType) => {
  const colors = {
    added: 'success',
    deleted: 'danger',
    modified: 'warning'
  }
  return colors[changeType] || 'info'
}

const getChangeIcon = (changeType) => {
  const icons = {
    added: Plus,
    deleted: Minus,
    modified: Edit
  }
  return icons[changeType] || CircleCheck
}

const getChangeLabel = (changeType) => {
  const labels = {
    added: '新增',
    deleted: '删除',
    modified: '修改',
    unchanged: '无变更'
  }
  return labels[changeType] || changeType
}

const getChangeTypeTag = (changeType) => {
  const tags = {
    added: 'success',
    deleted: 'danger',
    modified: 'warning'
  }
  return tags[changeType] || 'info'
}

const getChangeValueClass = (changeType) => {
  const classes = {
    added: 'diff-inserted-inline',
    deleted: 'diff-deleted-inline'
  }
  return classes[changeType] || ''
}

const getDiffTypeTag = (changeType) => {
  const tags = {
    inserted: 'success',
    deleted: 'danger',
    modified: 'warning',
    unchanged: 'info'
  }
  return tags[changeType] || 'info'
}

const getDiffLabel = (changeType) => {
  const labels = {
    inserted: '新增段落',
    deleted: '删除段落',
    modified: '修改段落',
    unchanged: '无变更段落'
  }
  return labels[changeType] || changeType
}

const handlePageChange = (page) => {
  currentPage.value = page
}
</script>

<style scoped>
.compare-page {
  height: 100%;
  overflow-y: auto;
}

.compare-card {
  min-height: calc(100vh - 130px);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
}

.document-selection {
  margin-bottom: 30px;
}

.selection-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-weight: 500;
  color: #606266;
}

.compare-icon-col {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 20px;
}

.compare-icon {
  color: #409eff;
}

.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 25px;
}

.divider-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.stats-row {
  margin-bottom: 30px;
}

.doc-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 6px;
}

.entity-changes {
  max-height: 500px;
  overflow-y: auto;
  padding: 10px;
}

.change-card {
  margin-bottom: 10px;
}

.modified-values {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.modified-values .label {
  display: inline-block;
  width: 50px;
  font-weight: 500;
  color: #606266;
}

.modified-values .value {
  padding: 2px 8px;
  border-radius: 4px;
}

.single-value {
  margin-top: 10px;
  font-size: 15px;
}

.paragraph-changes {
  max-height: 600px;
  overflow-y: auto;
  padding: 10px;
}

.paragraph-diff {
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #ebeef5;
}

.diff-header {
  padding: 10px 15px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.diff-inserted {
  background: #f0f9ff;
}

.diff-inserted .diff-header {
  background: #e6f7ff;
  border-bottom: 1px solid #91d5ff;
}

.diff-deleted {
  background: #fff1f0;
}

.diff-deleted .diff-header {
  background: #fff1f0;
  border-bottom: 1px solid #ffa39e;
}

.diff-modified {
  background: #fff7e6;
}

.diff-modified .diff-header {
  background: #fff7e6;
  border-bottom: 1px solid #ffd591;
}

.diff-unchanged {
  background: #f5f7fa;
  opacity: 0.7;
}

.diff-unchanged .diff-header {
  background: #e4e7ed;
  border-bottom: 1px solid #c0c4cc;
}

.diff-content {
  padding: 15px;
  line-height: 1.8;
}

.diff-content p {
  margin: 0;
  word-break: break-word;
}

.index-info {
  font-size: 12px;
  color: #909399;
}

.pagination-container {
  display: flex;
  justify-content: center;
  padding: 20px;
}

:deep(.diff-deleted-inline) {
  background: #ffcdd2;
  color: #c62828;
  text-decoration: line-through;
  padding: 2px 6px;
  border-radius: 4px;
}

:deep(.diff-inserted-inline) {
  background: #c8e6c9;
  color: #2e7d32;
  padding: 2px 6px;
  border-radius: 4px;
}

:deep(.el-timeline-item__timestamp) {
  font-weight: 600;
  color: #409eff;
}
</style>
