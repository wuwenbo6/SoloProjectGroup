<template>
  <div class="documents-page">
    <el-card class="documents-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-icon size="20"><List /></el-icon>
            <span>文档管理</span>
          </div>
          <el-button type="primary" @click="loadDocuments">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <el-empty
        v-if="!loading && documents.length === 0"
        description="暂无文档，请先上传文档"
      >
        <el-button type="primary" @click="goToUpload">
          <el-icon><Upload /></el-icon>
          上传文档
        </el-button>
      </el-empty>

      <div v-else class="documents-list">
        <el-table
          :data="documents"
          v-loading="loading"
          stripe
          style="width: 100%"
        >
          <el-table-column prop="filename" label="文件名" min-width="200">
            <template #default="scope">
              <span>
                <el-icon><Document /></el-icon>
                {{ scope.row.filename }}
              </span>
            </template>
          </el-table-column>

          <el-table-column prop="page_count" label="页数" width="100" align="center">
            <template #default="scope">
              <el-tag size="small">{{ scope.row.page_count || '-' }}</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="提取的实体" min-width="380">
            <template #default="scope">
              <el-space wrap>
                <el-popover
                  placement="left"
                  width="400"
                  v-for="(entity, idx) in scope.row.entities"
                  :key="idx"
                  trigger="click"
                >
                  <template #reference>
                    <el-tag
                      :type="getEntityTagType(entity.type)"
                      size="small"
                      effect="plain"
                      style="cursor: pointer;"
                    >
                      {{ getEntityLabel(entity.type) }}: {{ entity.value.slice(0, 15) }}{{ entity.value.length > 15 ? '...' : '' }}
                      <el-icon size="12" style="margin-left: 4px;"><EditPen /></el-icon>
                    </el-tag>
                  </template>
                  <div class="entity-feedback-form">
                    <h4>实体纠正反馈</h4>
                    <div class="feedback-type-buttons">
                      <el-radio-group v-model="getFeedbackState(scope.row.document_id, entity).feedbackType">
                        <el-radio-button label="false_positive">
                          <el-icon><Close /></el-icon> 误报
                        </el-radio-button>
                        <el-radio-button label="correction">
                          <el-icon><Edit /></el-icon> 纠正
                        </el-radio-button>
                        <el-radio-button label="add_entity">
                          <el-icon><Plus /></el-icon> 新增
                        </el-radio-button>
                      </el-radio-group>
                    </div>

                    <div class="feedback-form-content" v-if="getFeedbackState(scope.row.document_id, entity).feedbackType === 'correction'">
                      <el-input
                        v-model="getFeedbackState(scope.row.document_id, entity).correctedValue"
                        placeholder="请输入纠正后的实体值"
                        clearable
                      />
                      <el-select
                        v-model="getFeedbackState(scope.row.document_id, entity).correctedType"
                        placeholder="实体类型"
                        style="width: 100%; margin-top: 10px;"
                      >
                        <el-option label="日期" value="DATE" />
                        <el-option label="金额" value="AMOUNT" />
                        <el-option label="合同号" value="CONTRACT" />
                      </el-select>
                    </div>

                    <div class="feedback-form-content" v-if="getFeedbackState(scope.row.document_id, entity).feedbackType === 'add_entity'">
                      <el-input
                        v-model="getFeedbackState(scope.row.document_id, entity).correctedValue"
                        placeholder="请输入新增实体的值"
                        clearable
                      />
                      <el-select
                        v-model="getFeedbackState(scope.row.document_id, entity).correctedType"
                        placeholder="选择实体类型"
                        style="width: 100%; margin-top: 10px;"
                      >
                        <el-option label="日期" value="DATE" />
                        <el-option label="金额" value="AMOUNT" />
                        <el-option label="合同号" value="CONTRACT" />
                      </el-select>
                    </div>

                    <el-input
                      v-model="getFeedbackState(scope.row.document_id, entity).comment"
                      type="textarea"
                      :rows="2"
                      placeholder="备注说明（可选）"
                      style="margin-top: 10px;"
                    />

                    <div class="feedback-actions">
                      <el-button type="primary" size="small" @click="submitFeedback(scope.row, entity)">
                        <el-icon><Check /></el-icon> 提交反馈
                      </el-button>
                      <el-button size="small" @click="resetFeedback(scope.row.document_id, entity)">
                        重置
                      </el-button>
                    </div>
                  </div>
                </el-popover>

                <el-tag v-if="!scope.row.entities || scope.row.entities.length === 0" size="small" type="info">
                  无实体
                </el-tag>

                <el-button
                  v-if="scope.row.entities && scope.row.entities.length > 0"
                  type="primary"
                  size="small"
                  text
                  @click="showSuggestions(scope.row)"
                >
                  <el-icon><Tips /></el-icon> 建议
                </el-button>
              </el-space>
            </template>
          </el-table-column>

          <el-table-column prop="upload_time" label="上传时间" width="180" align="center">
            <template #default="scope">
              {{ formatDate(scope.row.upload_time) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="180" align="center" fixed="right">
            <template #default="scope">
              <el-button
                size="small"
                type="primary"
                @click="goToQA(scope.row.document_id)"
              >
                <el-icon><ChatDotRound /></el-icon>
                提问
              </el-button>
              <el-popconfirm
                title="确定要删除这个文档吗？"
                @confirm="deleteDoc(scope.row.document_id)"
              >
                <template #reference>
                  <el-button size="small" type="danger">
                    <el-icon><Delete /></el-icon>
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  List,
  Refresh,
  Upload,
  Document,
  ChatDotRound,
  Delete,
  EditPen,
  Close,
  Edit,
  Plus,
  Check,
  Tips
} from '@element-plus/icons-vue'
import {
  getDocuments,
  deleteDocument,
  submitFeedback as submitFeedbackAPI,
  getTrainingSuggestions
} from '@/api'

const router = useRouter()
const documents = ref([])
const loading = ref(false)
const feedbackStates = reactive({})

onMounted(() => {
  loadDocuments()
})

const loadDocuments = async () => {
  loading.value = true
  try {
    const response = await getDocuments()
    documents.value = response.data
  } catch (error) {
    console.error('加载文档列表失败:', error)
    ElMessage.error('加载文档列表失败')
  } finally {
    loading.value = false
  }
}

const getFeedbackState = (documentId, entity) => {
  const key = `${documentId}_${entity.type}_${entity.value}`
  if (!feedbackStates[key]) {
    feedbackStates[key] = {
      feedbackType: 'correction',
      correctedValue: entity.value,
      correctedType: entity.type,
      comment: ''
    }
  }
  return feedbackStates[key]
}

const resetFeedback = (documentId, entity) => {
  const key = `${documentId}_${entity.type}_${entity.value}`
  feedbackStates[key] = {
    feedbackType: 'correction',
    correctedValue: entity.value,
    correctedType: entity.type,
    comment: ''
  }
}

const submitFeedback = async (document, entity) => {
  const key = `${document.document_id}_${entity.type}_${entity.value}`
  const state = feedbackStates[key]

  if (state.feedbackType === 'correction' && !state.correctedValue) {
    ElMessage.warning('请输入纠正后的实体值')
    return
  }

  if (state.feedbackType === 'add_entity' && (!state.correctedValue || !state.correctedType)) {
    ElMessage.warning('请输入实体值和类型')
    return
  }

  try {
    const feedbackData = {
      document_id: document.document_id,
      original_entity: entity,
      feedback_type: state.feedbackType,
      comment: state.comment,
      page_num: 0
    }

    if (state.feedbackType === 'correction' || state.feedbackType === 'add_entity') {
      feedbackData.corrected_entity = {
        type: state.correctedType,
        value: state.correctedValue,
        confidence: 1.0,
        bbox: entity.bbox
      }
    }

    await submitFeedbackAPI(feedbackData)
    ElMessage.success('反馈提交成功！将用于模型微调')
    resetFeedback(document.document_id, entity)
  } catch (error) {
    console.error('提交反馈失败:', error)
    ElMessage.error('提交反馈失败')
  }
}

const showSuggestions = async (document) => {
  try {
    const response = await getTrainingSuggestions(document.document_id)
    const suggestions = response.data.suggestions

    if (suggestions.length === 0) {
      ElMessage.info('该文档暂无可优化建议')
      return
    }

    const messages = suggestions.map(s => s.message).join('\n')
    await ElMessageBox.alert(
      `发现 ${suggestions.length} 条优化建议：\n\n${messages}`,
      '模型优化建议',
      {
        confirmButtonText: '我知道了',
        type: 'info'
      }
    )
  } catch (error) {
    console.error('获取建议失败:', error)
    ElMessage.error('获取建议失败')
  }
}

const deleteDoc = async (documentId) => {
  try {
    await deleteDocument(documentId)
    ElMessage.success('删除成功')
    await loadDocuments()
  } catch (error) {
    console.error('删除失败:', error)
    ElMessage.error('删除失败')
  }
}

const goToUpload = () => {
  router.push('/upload')
}

const goToQA = (documentId) => {
  router.push('/')
  setTimeout(() => {
    ElMessage.info('已选择文档，请在问答页面输入问题')
  }, 300)
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getEntityLabel = (type) => {
  const labels = {
    'DATE': '日期',
    'AMOUNT': '金额',
    'CONTRACT': '合同号'
  }
  return labels[type] || type
}

const getEntityTagType = (type) => {
  const types = {
    'DATE': 'success',
    'AMOUNT': 'warning',
    'CONTRACT': 'primary'
  }
  return types[type] || 'info'
}
</script>

<style scoped>
.documents-page {
  height: 100%;
}

.documents-card {
  height: calc(100vh - 130px);
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
}

.documents-list {
  flex: 1;
  overflow: auto;
}

.entity-feedback-form {
  padding: 5px;
}

.entity-feedback-form h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 10px;
}

.feedback-type-buttons {
  margin-bottom: 15px;
}

.feedback-form-content {
  margin-bottom: 10px;
}

.feedback-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid #ebeef5;
}
</style>
