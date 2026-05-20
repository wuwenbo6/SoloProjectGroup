<template>
  <div class="collection-page">
    <el-card class="upload-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>拓片采集上传</span>
          <div class="header-actions">
            <el-radio-group v-model="storageTier" size="small">
              <el-radio-button label="hot">热存储</el-radio-button>
              <el-radio-button label="cold">冷存储</el-radio-button>
              <el-radio-button label="archive">归档</el-radio-button>
            </el-radio-group>
            <el-button type="primary" :icon="Camera" @click="openCamera">拍照上传</el-button>
            <el-button :icon="Upload" @click="triggerFileInput">导入文件</el-button>
            <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="handleFileChange">
          </div>
        </div>
      </template>

      <div v-if="fileUploading" class="upload-progress">
        <el-progress
          :percentage="uploadProgress"
          :status="uploadStatus"
          :stroke-width="12"
          :text-inside="true"
        />
        <p class="progress-text">{{ uploadStatusText }}</p>
      </div>

      <div v-else-if="previewImage" class="preview-area">
        <div class="image-wrapper">
          <img :src="previewImage" alt="预览" class="preview-image">
        </div>
        <div class="preview-actions">
          <el-slider v-model="denoiseLevel" :marks="{0:'原图',50:'降噪',100:'强降噪'}" style="width: 200px" />
          <el-slider v-model="contrastLevel" :marks="{0:'原对比度',50:'增强',100:'强增强'}" style="width: 200px" />
          <el-button type="primary" @click="processImage">图像处理</el-button>
          <el-button @click="resetUpload">重新选择</el-button>
        </div>
      </div>

      <div v-else class="upload-placeholder">
        <div class="upload-icon-wrapper">
          <el-icon :size="80" color="#c0c4cc"><Upload /></el-icon>
        </div>
        <p class="upload-title">点击上方按钮上传拓片图像</p>
        <p class="upload-tip">支持拍照上传、扫描件导入、图片文件导入</p>
        <div class="feature-badges">
          <el-tag type="info" size="small">自动降噪</el-tag>
          <el-tag type="info" size="small">对比度增强</el-tag>
          <el-tag type="info" size="small">多版本存储</el-tag>
          <el-tag type="info" size="small">分片上传</el-tag>
        </div>
      </div>
    </el-card>

    <el-dialog v-model="formVisible" title="拓片信息" width="600px" class="info-dialog">
      <el-form :model="rubbingForm" :rules="formRules" ref="formRef" label-width="100px" size="default">
        <el-form-item label="标题" prop="title">
          <el-input v-model="rubbingForm.title" placeholder="请输入拓片标题" />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="rubbingForm.category" style="width: 100%" placeholder="请选择分类">
            <el-option label="碑刻" value="stele" />
            <el-option label="青铜器" value="bronze" />
            <el-option label="玉器" value="jade" />
            <el-option label="陶器" value="pottery" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="朝代">
              <el-input v-model="rubbingForm.dynasty" placeholder="如：西周" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="作者">
              <el-input v-model="rubbingForm.author" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="年代">
          <el-input v-model="rubbingForm.era" />
        </el-form-item>
        <el-form-item label="出土地点">
          <el-input v-model="rubbingForm.location" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="rubbingForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitRubbing">确认提交</el-button>
      </template>
    </el-dialog>

    <el-card class="list-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span>拓片列表</span>
            <el-badge v-if="stats.total > 0" :value="stats.total" class="total-badge" />
          </div>
          <div class="filters">
            <el-select v-model="filters.category" placeholder="分类" style="width: 120px" clearable size="small">
              <el-option label="碑刻" value="stele" />
              <el-option label="青铜器" value="bronze" />
              <el-option label="其他" value="other" />
            </el-select>
            <el-select v-model="filters.status" placeholder="状态" style="width: 120px" clearable size="small">
              <el-option label="已上传" value="uploaded" />
              <el-option label="处理中" value="processing" />
              <el-option label="已处理" value="processed" />
              <el-option label="释读中" value="annotating" />
              <el-option label="已完成" value="completed" />
            </el-select>
            <el-input
              v-model="filters.keyword"
              placeholder="搜索标题"
              style="width: 180px"
              size="small"
              clearable
              @input="debouncedSearch"
            />
          </div>
        </div>
      </template>

      <div ref="listContainer" class="rubbing-list-container">
        <div v-virtual-scroll="{ data: rubbings, itemHeight: 120 }" class="virtual-list">
          <div v-for="(item, index) in visibleItems" :key="item.id || index" class="rubbing-item">
            <div class="item-thumbnail" @click="viewDetail(item)">
              <img
                :src="getImageUrl(item.thumbnail || item.processedImage || item.originalImage)"
                :alt="item.title"
                loading="lazy"
                @error="handleImageError($event)"
              />
              <div class="storage-badge" v-if="item.storageTier">
                {{ getTierLabel(item.storageTier) }}
              </div>
            </div>
            <div class="item-info">
              <h4 class="item-title" @click="viewDetail(item)">{{ item.title }}</h4>
              <div class="item-meta">
                <el-tag size="small" type="info">{{ item.category || '未分类' }}</el-tag>
                <el-tag size="small" v-if="item.dynasty">{{ item.dynasty }}</el-tag>
                <el-tag size="small" :type="getStatusType(item.status)">
                  {{ getStatusLabel(item.status) }}
                </el-tag>
              </div>
              <p class="item-desc">{{ item.description || '暂无描述' }}</p>
              <div class="item-footer">
                <span class="upload-time">{{ formatTime(item.createdAt) }}</span>
                <div class="item-actions">
                  <el-button size="small" type="primary" @click="goToAnnotation(item)" v-if="canAnnotate(item)">
                    释读
                  </el-button>
                  <el-button size="small" @click="processImageRubbing(item)" v-if="item.status === 'uploaded'">
                    处理
                  </el-button>
                  <el-dropdown @command="(mode) => repairImage(item, mode)" v-if="canRepair(item)" trigger="click">
                    <el-button size="small">图像修复<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="auto">自动修复</el-dropdown-item>
                        <el-dropdown-item command="denoise">去噪优化</el-dropdown-item>
                        <el-dropdown-item command="contrast">对比度增强</el-dropdown-item>
                        <el-dropdown-item command="advanced">深度修复</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </div>
        </div>

        <el-empty v-if="rubbings.length === 0 && !loading" description="暂无拓片数据" class="empty-state" />
        <div v-if="loading" class="loading-state">
          <el-icon :size="40" class="is-loading"><Loading /></el-icon>
          <p>加载中...</p>
        </div>
      </div>

      <div class="pagination-wrapper" v-if="total > 0">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadRubbings"
          @current-change="loadRubbings"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Camera, Upload, ArrowDown, Loading } from '@element-plus/icons-vue'
import api from '@/services/api'

const router = useRouter()

const fileInput = ref(null)
const listContainer = ref(null)
const previewImage = ref(null)
const currentFile = ref(null)
const fileUploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const uploadStatusText = ref('')
const formVisible = ref(false)
const submitting = ref(false)
const denoiseLevel = ref(50)
const contrastLevel = ref(30)
const storageTier = ref('hot')
const loading = ref(false)

const rubbings = ref([])
const visibleItems = ref([])
const total = ref(0)
const stats = reactive({ total: 0, byCategory: {} })

const filters = reactive({
  category: '',
  status: '',
  keyword: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20
})

const rubbingForm = reactive({
  title: '',
  category: 'stele',
  dynasty: '',
  author: '',
  era: '',
  location: '',
  description: ''
})

const formRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }]
}

let searchDebounceTimer = null

const getImageUrl = (path) => {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  return import.meta.env.VITE_API_BASE_URL + path
}

const getTierLabel = (tier) => {
  const labels = { hot: '热存储', cold: '冷存储', archive: '归档' }
  return labels[tier] || tier
}

const getStatusType = (status) => {
  const types = {
    uploaded: 'info',
    processing: 'warning',
    processed: 'success',
    annotating: 'primary',
    completed: 'success'
  }
  return types[status] || 'info'
}

const getStatusLabel = (status) => {
  const labels = {
    uploaded: '已上传',
    processing: '处理中',
    processed: '已处理',
    annotating: '释读中',
    completed: '已完成'
  }
  return labels[status] || status
}

const formatTime = (time) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

const canAnnotate = (item) => item.status !== 'uploaded'
const canRepair = (item) => item.status !== 'uploaded' && item.status !== 'processing'

const triggerFileInput = () => fileInput.value?.click()

const handleFileChange = (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请上传图片文件')
    return
  }
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过50MB')
    return
  }
  currentFile.value = file
  previewImage.value = URL.createObjectURL(file)
  formVisible.value = true
}

const openCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    const video = document.createElement('video')
    video.srcObject = stream
    await video.play()
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    video.srcObject.getTracks().forEach(track => track.stop())
    canvas.toBlob(blob => {
      currentFile.value = blob
      previewImage.value = URL.createObjectURL(blob)
      formVisible.value = true
    }, 'image/jpeg', 0.95)
  } catch (err) {
    ElMessage.error('无法访问摄像头，请检查权限')
  }
}

const resetUpload = () => {
  previewImage.value = null
  currentFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

const submitRubbing = async () => {
  if (!currentFile.value) {
    ElMessage.warning('请先上传图片')
    return
  }

  submitting.value = true
  try {
    const formData = new FormData()
    Object.entries(rubbingForm).forEach(([key, value]) => {
      if (value) formData.append(key, value)
    })
    formData.append('tier', storageTier.value)
    formData.append('file', currentFile.value)

    await api.post('/rubbing/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
      }
    })

    ElMessage.success('上传成功')
    resetUpload()
    formVisible.value = false
    Object.assign(rubbingForm, { title: '', category: 'stele', dynasty: '', author: '', era: '', location: '', description: '' })
    loadRubbings()
  } catch (err) {
    ElMessage.error('上传失败: ' + (err.response?.data?.error || err.message))
  } finally {
    submitting.value = false
  }
}

const processImage = async () => {
  ElMessage.info('图像处理功能将在保存后自动应用')
}

const loadRubbings = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      category: filters.category || undefined,
      status: filters.status || undefined,
      keyword: filters.keyword || undefined
    }
    const res = await api.get('/rubbing/list', { params })
    rubbings.value = res.data.rubbings || []
    total.value = res.data.total || 0
    stats.total = total.value
  } catch (err) {
    console.error(err)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const debouncedSearch = () => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    pagination.page = 1
    loadRubbings()
  }, 300)
}

const viewDetail = (item) => {
  router.push(`/rubbing/${item.id}`)
}

const goToAnnotation = (item) => {
  router.push(`/annotation/${item.id}`)
}

const processImageRubbing = async (item) => {
  try {
    await api.post(`/rubbing/${item.id}/process`, {
      denoiseLevel: denoiseLevel.value,
      contrastLevel: contrastLevel.value
    })
    ElMessage.success('图像处理成功')
    loadRubbings()
  } catch (err) {
    ElMessage.error('处理失败')
  }
}

const repairImage = async (item, mode) => {
  try {
    await ElMessageBox.confirm(`确定使用${mode === 'auto' ? '自动修复' : mode}模式处理吗？`, '确认修复', {
      type: 'info'
    })
    await api.post(`/rubbing/${item.id}/repair`, { repairMode: mode })
    ElMessage.success('修复成功')
    loadRubbings()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('修复失败')
  }
}

const handleImageError = (e) => {
  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f5f7fa" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23909399" font-size="12"%3E无图%3C/text%3E%3C/svg%3E'
}

onMounted(() => {
  loadRubbings()
})

onUnmounted(() => {
  clearTimeout(searchDebounceTimer)
})
</script>

<style scoped>
.collection-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.total-badge {
  margin-left: 10px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.upload-progress {
  padding: 40px 20px;
  text-align: center;
}

.progress-text {
  margin-top: 15px;
  color: #606266;
}

.preview-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.image-wrapper {
  text-align: center;
  max-height: 400px;
  overflow: hidden;
  border-radius: 8px;
  background: #f5f7fa;
}

.preview-image {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
}

.preview-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

.upload-placeholder {
  text-align: center;
  padding: 60px 20px;
  border: 2px dashed #e4e7ed;
  border-radius: 8px;
  background: #fafafa;
}

.upload-icon-wrapper {
  margin-bottom: 20px;
}

.upload-title {
  font-size: 16px;
  color: #606266;
  margin-bottom: 10px;
}

.upload-tip {
  font-size: 14px;
  color: #909399;
  margin-bottom: 20px;
}

.feature-badges {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.rubbing-list-container {
  min-height: 200px;
  position: relative;
}

.virtual-list {
  overflow-y: auto;
  max-height: 70vh;
}

.rubbing-item {
  display: flex;
  gap: 15px;
  padding: 15px;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s;
}

.rubbing-item:hover {
  background: #f9fafc;
}

.item-thumbnail {
  width: 100px;
  height: 80px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #f5f7fa;
  position: relative;
  cursor: pointer;
}

.item-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.storage-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 2px 6px;
  background: rgba(64, 158, 255, 0.9);
  color: white;
  font-size: 10px;
  border-radius: 3px;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  cursor: pointer;
  transition: color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-title:hover {
  color: #409eff;
}

.item-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.item-desc {
  font-size: 13px;
  color: #909399;
  margin: 0 0 10px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.upload-time {
  font-size: 12px;
  color: #c0c4cc;
}

.item-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.empty-state,
.loading-state {
  padding: 60px 20px;
  text-align: center;
}

.pagination-wrapper {
  margin-top: 20px;
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

@media (max-width: 768px) {
  .collection-page {
    padding: 10px;
  }

  .card-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: center;
  }

  .filters {
    justify-content: center;
  }

  .rubbing-item {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .item-thumbnail {
    width: 120px;
    height: 90px;
  }

  .item-meta {
    justify-content: center;
  }

  .item-footer {
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .info-dialog :deep(.el-dialog) {
    width: 95% !important;
    margin: 5vh auto;
  }

  .preview-actions {
    flex-direction: column;
  }

  .preview-actions :deep(.el-slider) {
    width: 100% !important;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .collection-page {
    padding: 15px;
  }
}
</style>
