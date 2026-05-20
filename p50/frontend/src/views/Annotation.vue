<template>
  <div class="annotation-page">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>待标注语料</span>
              <el-select v-model="filterDialectId" placeholder="选择方言" size="small" style="width: 120px;">
                <el-option v-for="d in dialects" :key="d.id" :label="d.name" :value="d.id" />
              </el-select>
            </div>
          </template>
          
          <el-table :data="unannotatedCorpora" stripe style="width: 100%" size="small" @row-click="selectCorpus">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="dialect_id" label="方言" width="80" />
            <el-table-column prop="text" label="文本内容" show-overflow-tooltip />
          </el-table>
          
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="totalCorpora"
            style="margin-top: 15px; justify-content: center;"
            layout="total, prev, pager, next"
            @current-change="loadUnannotated"
          />
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card v-if="selectedCorpus">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>语料标注 - ID: {{ selectedCorpus.id }}</span>
              <el-tag v-if="hasAnnotations" type="success">已标注</el-tag>
              <el-tag v-else type="warning">未标注</el-tag>
            </div>
          </template>

          <el-descriptions :column="2" border size="small" style="margin-bottom: 20px;">
            <el-descriptions-item label="方言ID">{{ selectedCorpus.dialect_id }}</el-descriptions-item>
            <el-descriptions-item label="说话人">{{ selectedCorpus.speaker_id || '-' }}</el-descriptions-item>
            <el-descriptions-item label="文本内容" :span="2">{{ selectedCorpus.text }}</el-descriptions-item>
          </el-descriptions>

          <el-divider content-position="left">标注面板</el-divider>

          <el-form :model="annotationForm" label-width="100px">
            <el-form-item label="标注类型" required>
              <el-select v-model="annotationForm.annotation_type" style="width: 100%;">
                <el-option
                  v-for="at in annotationTypes"
                  :key="at.id"
                  :label="at.name"
                  :value="at.id"
                >
                  <span>{{ at.name }}</span>
                  <span style="color: #8492a6; font-size: 12px; margin-left: 8px;">{{ at.description }}</span>
                </el-option>
              </el-select>
            </el-form-item>

            <el-form-item label="标签" required>
              <el-select v-model="annotationForm.label" style="width: 100%" filterable>
                <el-option
                  v-for="label in filteredLabels"
                  :key="label.id"
                  :label="label.label_name"
                  :value="label.label_name"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="标注值">
              <el-input
                v-model="annotationForm.value"
                type="textarea"
                :rows="3"
                placeholder="输入详细标注内容..."
              />
            </el-form-item>

            <el-form-item label="置信度">
              <el-slider v-model="annotationForm.confidence" :min="0" :max="1" :step="0.1" />
            </el-form-item>

            <el-form-item label="标注人">
              <el-input v-model="annotationForm.annotator" placeholder="输入标注人姓名" />
            </el-form-item>

            <el-form-item label="备注">
              <el-input v-model="annotationForm.comment" type="textarea" :rows="2" placeholder="添加备注信息..." />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :icon="Check" @click="saveAnnotation" :loading="saving">
                保存标注
              </el-button>
              <el-button :icon="Refresh" @click="resetForm">重置</el-button>
            </el-form-item>
          </el-form>

          <el-divider content-position="left">已保存标注</el-divider>

          <el-timeline>
            <el-timeline-item
              v-for="ann in existingAnnotations"
              :key="ann.id"
              :timestamp="formatDate(ann.created_at)"
            >
              <el-card shadow="never" style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <el-tag size="small" style="margin-right: 8px;">{{ ann.annotation_type }}</el-tag>
                    <strong>{{ ann.label }}</strong>
                    <span v-if="ann.value" style="margin-left: 10px; color: #666;">{{ ann.value }}</span>
                  </div>
                  <el-button
                    v-if="!ann.is_verified"
                    type="success"
                    size="small"
                    @click="verifyAnnotation(ann.id)"
                  >
                    验证
                  </el-button>
                  <el-tag v-else type="success" size="small">已验证</el-tag>
                </div>
                <div v-if="ann.comment" style="margin-top: 5px; color: #999; font-size: 12px;">
                  备注: {{ ann.comment }}
                </div>
                <div style="margin-top: 5px; font-size: 12px; color: #999;">
                  置信度: {{ (ann.confidence * 100).toFixed(0) }}% | 标注人: {{ ann.annotator || '匿名' }}
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <el-empty v-else description="请从左侧选择待标注语料" style="padding: 50px;" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Refresh } from '@element-plus/icons-vue'
import axios from 'axios'

const unannotatedCorpora = ref([])
const selectedCorpus = ref(null)
const existingAnnotations = ref([])
const dialects = ref([])
const annotationTypes = ref([])
const labels = ref([])
const filterDialectId = ref(null)
const currentPage = ref(1)
const pageSize = ref(50)
const totalCorpora = ref(0)
const saving = ref(false)

const annotationForm = ref({
  corpus_id: null,
  annotation_type: '',
  label: '',
  value: '',
  confidence: 1.0,
  annotator: '',
  comment: ''
})

const hasAnnotations = computed(() => existingAnnotations.value.length > 0)

const filteredLabels = computed(() => {
  if (!annotationForm.value.annotation_type) {
    return labels.value
  }
  return labels.value.filter(l => l.label_type === annotationForm.value.annotation_type)
})

const loadDialects = async () => {
  try {
    const response = await axios.get('/api/knowledge/dialects')
    dialects.value = response.data.dialects || []
  } catch (error) {
    console.error('加载方言列表失败:', error)
  }
}

const loadAnnotationTypes = async () => {
  try {
    const response = await axios.get('/api/annotation/annotation-types')
    annotationTypes.value = response.data.annotation_types || []
  } catch (error) {
    console.error('加载标注类型失败:', error)
  }
}

const loadLabels = async () => {
  try {
    const response = await axios.get('/api/annotation/labels')
    labels.value = response.data.labels || []
  } catch (error) {
    console.error('加载标签失败:', error)
  }
}

const loadUnannotated = async () => {
  try {
    const response = await axios.get('/api/annotation/unannotated', {
      params: {
        dialect_id: filterDialectId.value,
        limit: pageSize.value
      }
    })
    unannotatedCorpora.value = response.data.corpora || []
    totalCorpora.value = response.data.total || 0
  } catch (error) {
    console.error('加载待标注语料失败:', error)
  }
}

const selectCorpus = async (row) => {
  selectedCorpus.value = row
  annotationForm.value.corpus_id = row.id
  await loadExistingAnnotations(row.id)
}

const loadExistingAnnotations = async (corpusId) => {
  try {
    const response = await axios.get(`/api/annotation/annotations/corpus/${corpusId}`)
    existingAnnotations.value = response.data.annotations || []
  } catch (error) {
    console.error('加载已有标注失败:', error)
    existingAnnotations.value = []
  }
}

const saveAnnotation = async () => {
  if (!annotationForm.value.annotation_type || !annotationForm.value.label) {
    ElMessage.warning('请填写标注类型和标签')
    return
  }

  saving.value = true
  try {
    await axios.post('/api/annotation/annotations', annotationForm.value)
    ElMessage.success('标注保存成功')
    await loadExistingAnnotations(selectedCorpus.value.id)
    resetForm()
  } catch (error) {
    ElMessage.error('保存失败: ' + (error.response?.data?.detail || error.message))
  } finally {
    saving.value = false
  }
}

const verifyAnnotation = async (annotationId) => {
  try {
    await axios.put(`/api/annotation/annotations/${annotationId}`, {
      is_verified: true,
      verified_by: annotationForm.value.annotator || 'system'
    })
    ElMessage.success('验证成功')
    await loadExistingAnnotations(selectedCorpus.value.id)
  } catch (error) {
    ElMessage.error('验证失败')
  }
}

const resetForm = () => {
  annotationForm.value = {
    corpus_id: selectedCorpus.value?.id || null,
    annotation_type: '',
    label: '',
    value: '',
    confidence: 1.0,
    annotator: annotationForm.value.annotator,
    comment: ''
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadDialects()
  loadAnnotationTypes()
  loadLabels()
  loadUnannotated()
})
</script>

<style scoped>
.annotation-page {
  padding: 0;
}

.el-table--striped .el-table__body tr.el-table__row--striped:hover td {
  cursor: pointer;
}

.el-timeline {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 10px;
}
</style>
