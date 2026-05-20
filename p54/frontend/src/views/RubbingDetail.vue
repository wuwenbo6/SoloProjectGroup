<template>
  <div class="rubbing-detail">
    <div class="detail-header">
      <el-button @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2>{{ rubbing?.title || '拓片详情' }}</h2>
      <div class="header-actions">
        <el-button type="primary" @click="goToAnnotation" v-if="rubbing?.status !== 'uploaded'">
          进入释读
        </el-button>
        <el-button @click="editRubbing">编辑信息</el-button>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <span>拓片图像</span>
          </template>
          <div class="image-viewer">
            <el-image
              :src="imageSrc"
              :preview-src-list="[imageSrc]"
              fit="contain"
              style="width: 100%; max-height: 600px"
            />
          </div>
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header>
            <span>释读进度</span>
          </template>
          <div class="progress-section">
            <el-progress
              :percentage="rubbing?.annotationProgress || 0"
              :stroke-width="20"
              :text-inside="true"
              status="success"
            />
            <div class="progress-stats">
              <span>已释读：{{ rubbing?.annotatedCharacters || 0 }} / {{ rubbing?.totalCharacters || 0 }} 字</span>
            </div>
          </div>
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header>
            <span>释读文字列表</span>
            <el-button type="primary" size="small" @click="exportAnnotations">导出</el-button>
          </template>
          <div class="annotations-grid">
            <div
              v-for="(item, index) in annotations"
              :key="item.id || index"
              class="annotation-card"
            >
              <div class="char-display">{{ item.character || '?' }}</div>
              <div class="char-meta">
                <el-tag :type="getAnnotationStatusType(item.status)" size="small">
                  {{ getAnnotationStatusLabel(item.status) }}
                </el-tag>
              </div>
              <div class="char-info" v-if="item.pinyin">
                <span>拼音：{{ item.pinyin }}</span>
              </div>
              <div class="char-info" v-if="item.meaning">
                <span>释义：{{ item.meaning }}</span>
              </div>
            </div>
          </div>
          <el-empty v-if="annotations.length === 0" description="暂无释读数据" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <span>基本信息</span>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="标题">{{ rubbing?.title }}</el-descriptions-item>
            <el-descriptions-item label="分类">{{ getCategoryLabel(rubbing?.category) }}</el-descriptions-item>
            <el-descriptions-item label="朝代">{{ rubbing?.dynasty || '未知' }}</el-descriptions-item>
            <el-descriptions-item label="作者">{{ rubbing?.author || '未知' }}</el-descriptions-item>
            <el-descriptions-item label="年代">{{ rubbing?.era || '未知' }}</el-descriptions-item>
            <el-descriptions-item label="出土地">{{ rubbing?.location || '未知' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getStatusType(rubbing?.status)">{{ getStatusLabel(rubbing?.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="来源类型">
              <el-tag>{{ getSourceTypeLabel(rubbing?.sourceType) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="上传者">{{ rubbing?.User?.realName || rubbing?.User?.username }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDate(rubbing?.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="标签">
              <el-tag v-for="(tag, index) in (rubbing?.tags || [])" :key="index" size="small" style="margin-right: 5px">
                {{ tag }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-top: 20px" v-if="rubbing?.description">
          <template #header>
            <span>描述</span>
          </template>
          <p class="description">{{ rubbing.description }}</p>
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header>
            <span>操作记录</span>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(log, index) in operationLogs"
              :key="index"
              :timestamp="formatDate(log.createdAt)"
              type="primary"
            >
              <div class="log-item">
                <strong>{{ log.action }}</strong>
                <p class="log-desc">{{ log.description }}</p>
                <span class="log-user">操作人：{{ log.User?.realName || log.User?.username }}</span>
              </div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-if="operationLogs.length === 0" description="暂无操作记录" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import api from '@/services/api'

const route = useRoute()
const router = useRouter()
const rubbing = ref(null)
const annotations = ref([])
const operationLogs = ref([])

const rubbingId = computed(() => route.params.id)

const imageSrc = computed(() => {
  return rubbing.value?.processedImage || rubbing.value?.originalImage || ''
})

async function loadRubbing() {
  try {
    const res = await api.get(`/rubbing/${rubbingId.value}`)
    rubbing.value = res.data
  } catch (err) {
    ElMessage.error('加载拓片信息失败')
  }
}

async function loadAnnotations() {
  try {
    const res = await api.get(`/annotation/rubbing/${rubbingId.value}`)
    annotations.value = res.data.annotations || []
  } catch (err) {
    console.error(err)
  }
}

function goToAnnotation() {
  router.push(`/annotation/${rubbingId.value}`)
}

function editRubbing() {
  ElMessage.info('编辑功能开发中')
}

function exportAnnotations() {
  ElMessage.info('导出功能开发中')
}

function getCategoryLabel(category) {
  const labels = { stele: '碑刻', bronze: '青铜', jade: '玉器', pottery: '陶器', other: '其他' }
  return labels[category] || category || '-'
}

function getStatusLabel(status) {
  const labels = { uploaded: '已上传', processing: '处理中', processed: '已处理', annotating: '释读中', completed: '已完成' }
  return labels[status] || status || '-'
}

function getStatusType(status) {
  const types = { uploaded: 'info', processing: 'warning', processed: 'warning', annotating: 'primary', completed: 'success' }
  return types[status] || 'info'
}

function getSourceTypeLabel(type) {
  const labels = { camera: '拍照上传', scan: '扫描导入', import: '文件导入' }
  return labels[type] || type || '-'
}

function getAnnotationStatusLabel(status) {
  const labels = { draft: '草稿', submitted: '已提交', reviewed: '已审核', finalized: '已定稿' }
  return labels[status] || status || '-'
}

function getAnnotationStatusType(status) {
  const types = { draft: 'info', submitted: 'warning', reviewed: 'primary', finalized: 'success' }
  return types[status] || 'info'
}

function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  loadRubbing()
  loadAnnotations()
})
</script>

<style scoped>
.rubbing-detail {
  padding: 20px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}

.detail-header h2 {
  margin: 0;
  flex: 1;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.image-viewer {
  text-align: center;
}

.progress-section {
  padding: 20px 0;
}

.progress-stats {
  margin-top: 15px;
  text-align: center;
  font-size: 14px;
  color: #606266;
}

.annotations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
}

.annotation-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
}

.char-display {
  font-size: 36px;
  font-weight: bold;
  margin-bottom: 10px;
  min-height: 50px;
}

.char-meta {
  margin-bottom: 8px;
}

.char-info {
  font-size: 12px;
  color: #606266;
  text-align: left;
  margin: 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.description {
  margin: 0;
  line-height: 1.8;
  color: #606266;
}

.log-item {
  padding: 5px 0;
}

.log-item p {
  margin: 5px 0;
  font-size: 14px;
  color: #606266;
}

.log-user {
  font-size: 12px;
  color: #909399;
}
</style>
