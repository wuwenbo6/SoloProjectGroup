<template>
  <div class="upload-page">
    <div class="page-header">
      <h1>竹编工艺采集操作台</h1>
      <p>记录您的工艺作品，传承非遗文化</p>
    </div>

    <el-row :gutter="20">
      <el-col :xs="24" :sm="24" :md="16">
        <el-card class="form-card">
          <template #header>
            <div class="card-header">
              <span>采集表单</span>
              <el-button-group size="small">
                <el-button :icon="Refresh" @click="resetForm">重置</el-button>
                <el-button :icon="Collection" @click="showHistory = true">历史版本</el-button>
              </el-button-group>
            </div>
          </template>
          <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="作品名称" prop="title">
          <el-input v-model="form.title" placeholder="请输入作品名称" style="width: 500px;" />
        </el-form-item>

        <el-form-item label="作品分类" prop="category">
          <el-select v-model="form.category" placeholder="请选择分类" style="width: 250px;">
            <el-option label="日用器具" value="日用器具" />
            <el-option label="装饰摆件" value="装饰摆件" />
            <el-option label="茶具套装" value="茶具套装" />
            <el-option label="收纳用品" value="收纳用品" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>

        <el-form-item label="作品图片" prop="images">
          <el-upload
            v-model:file-list="fileList"
            list-type="picture-card"
            :auto-upload="false"
            :on-preview="handlePreview"
            :on-remove="handleRemove"
            :before-upload="beforeUpload"
            :on-change="handleChange"
            :limit="5"
            accept="image/jpeg,image/png,image/jpg"
            action="#"
          >
            <el-icon><Plus /></el-icon>
          </el-upload>
          <div class="upload-tip">
            <el-icon><InfoFilled /></el-icon>
            建议上传高清图片，最多5张，支持JPG、PNG格式，将自动压缩优化
          </div>
        </el-form-item>

        <el-form-item label="作品描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="5"
            placeholder="请详细描述您的作品，包括创作理念、工艺特点等..."
            style="width: 600px;"
          />
        </el-form-item>

        <el-form-item label="工艺流程">
          <div class="craft-steps">
            <div v-for="(step, index) in form.steps" :key="index" class="step-item">
              <el-tag type="success">步骤 {{ index + 1 }}</el-tag>
              <el-input
                v-model="step.title"
                placeholder="步骤名称"
                style="width: 200px; margin: 0 10px;"
              />
              <el-input
                v-model="step.desc"
                placeholder="步骤描述"
                style="flex: 1;"
              />
              <el-button type="danger" :icon="Delete" circle @click="removeStep(index)" />
            </div>
            <el-button type="primary" :icon="Plus" @click="addStep">
              添加工艺步骤
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="创作材料">
          <el-input
            v-model="form.materials"
            placeholder="请输入使用的材料，如：毛竹、藤条等"
            style="width: 500px;"
          />
        </el-form-item>

        <el-form-item label="创作时间">
          <el-date-picker
            v-model="form.createDate"
            type="date"
            placeholder="选择创作日期"
            style="width: 250px;"
          />
        </el-form-item>

        <el-form-item label="工艺传承">
          <el-switch
            v-model="form.isHeritage"
            active-text="是传统工艺"
            inactive-text="现代创新"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" size="large" :loading="submitting" @click="submitForm">
            提交作品
          </el-button>
          <el-button size="large" @click="saveDraft">
            保存草稿
          </el-button>
        </el-form-item>
      </el-form>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="8">
        <el-card class="similar-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><Search /></el-icon> 相似工艺推荐</span>
            </div>
          </template>
          <div class="similar-list">
            <div 
              v-for="item in similarCrafts" 
              :key="item.id" 
              class="similar-item"
              @click="useAsReference(item)"
            >
              <img :src="item.image" class="similar-thumb" />
              <div class="similar-info">
                <div class="similar-title">{{ item.title }}</div>
                <div class="similar-category">{{ item.category }}</div>
                <div class="similar-similarity">相似度: {{ item.similarity }}%</div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="previewVisible" title="图片预览" width="600px">
      <img w-full :src="previewUrl" alt="预览图片" />
    </el-dialog>

    <el-drawer
      v-model="showHistory"
      title="采集记录回溯"
      size="500px"
    >
      <div class="history-list">
        <div 
          v-for="(record, index) in historyRecords" 
          :key="record.id"
          class="history-item"
          :class="{ active: currentHistoryIndex === index }"
          @click="viewHistory(record, index)"
        >
          <div class="history-header">
            <el-tag :type="record.status === 'draft' ? 'warning' : 'success'" size="small">
              {{ record.status === 'draft' ? '草稿' : '已提交' }}
            </el-tag>
            <span class="history-time">{{ record.time }}</span>
          </div>
          <div class="history-title">{{ record.title }}</div>
          <div class="history-actions">
            <el-button size="small" type="primary" @click.stop="restoreVersion(record)">
              恢复此版本
            </el-button>
            <el-button size="small" type="danger" @click.stop="deleteHistory(record.id)">
              删除
            </el-button>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { craftApi } from '../api'

const formRef = ref(null)
const previewVisible = ref(false)
const previewUrl = ref('')
const submitting = ref(false)
const fileList = ref([])
const showHistory = ref(false)
const currentHistoryIndex = ref(-1)

const form = reactive({
  title: '',
  category: '',
  description: '',
  materials: '',
  createDate: '',
  isHeritage: false,
  image: '',
  images: [],
  steps: [
    { title: '选材', desc: '精选优质竹材' },
    { title: '破竹', desc: '劈削成均匀竹篾' }
  ]
})

const historyRecords = ref([
  {
    id: 1,
    title: '竹编花篮初稿',
    status: 'draft',
    time: '2024-01-15 10:30',
    data: { title: '竹编花篮初稿', category: '日用器具', description: '初步构思' }
  },
  {
    id: 2,
    title: '竹编花篮修订版',
    status: 'draft',
    time: '2024-01-15 14:20',
    data: { title: '竹编花篮修订版', category: '日用器具', description: '添加详细步骤' }
  },
  {
    id: 3,
    title: '传统竹编花篮',
    status: 'submitted',
    time: '2024-01-16 09:00',
    data: { title: '传统竹编花篮', category: '日用器具', description: '最终版本' }
  }
])

const similarCrafts = ref([
  {
    id: 1,
    title: '经典圆竹篮',
    category: '日用器具',
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200',
    similarity: 85
  },
  {
    id: 2,
    title: '竹编收纳筐',
    category: '收纳用品',
    image: 'https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=200',
    similarity: 72
  },
  {
    id: 3,
    title: '传统工艺竹篮',
    category: '装饰摆件',
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200',
    similarity: 68
  }
])

const saveDraft = () => {
  const newRecord = {
    id: Date.now(),
    title: form.title || '未命名草稿',
    status: 'draft',
    time: new Date().toLocaleString(),
    data: JSON.parse(JSON.stringify(form))
  }
  historyRecords.value.unshift(newRecord)
  ElMessage.success('草稿已保存！')
}

const viewHistory = (record, index) => {
  currentHistoryIndex.value = index
}

const restoreVersion = (record) => {
  ElMessageBox.confirm(
    '确定要恢复此版本吗？当前未保存的内容将被覆盖。',
    '版本恢复确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    Object.assign(form, record.data)
    ElMessage.success('版本已恢复！')
  }).catch(() => {})
}

const deleteHistory = (id) => {
  ElMessageBox.confirm(
    '确定要删除此记录吗？',
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const index = historyRecords.value.findIndex(r => r.id === id)
    if (index > -1) {
      historyRecords.value.splice(index, 1)
    }
    ElMessage.success('记录已删除！')
  }).catch(() => {})
}

const useAsReference = (item) => {
  ElMessage.info(`已将「${item.title}」设为参考作品`)
}

const calculateSimilarity = () => {
  if (form.category || form.title) {
    similarCrafts.value.forEach((item, index) => {
      item.similarity = Math.max(50, 90 - index * 8 + Math.floor(Math.random() * 10))
    })
  }
}

watch([() => form.category, () => form.title], () => {
  calculateSimilarity()
})

onMounted(() => {
  calculateSimilarity()
})

const rules = {
  title: [
    { required: true, message: '请输入作品名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  category: [
    { required: true, message: '请选择作品分类', trigger: 'change' }
  ],
  description: [
    { required: true, message: '请输入作品描述', trigger: 'blur' },
    { min: 10, message: '描述至少10个字符', trigger: 'blur' }
  ]
}

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        const maxWidth = 1200
        const maxHeight = 1200
        let width = img.width
        let height = img.height
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }
        
        canvas.width = width
        canvas.height = height
        
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, width, height)
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85)
        resolve(compressedDataUrl)
      }
    }
  })
}

const beforeUpload = async (file) => {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    ElMessage.error('只能上传图片文件！')
    return false
  }
  
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    ElMessage.error('图片大小不能超过10MB！')
    return false
  }
  
  try {
    const compressedUrl = await compressImage(file)
    file.url = compressedUrl
    return true
  } catch (error) {
    ElMessage.error('图片处理失败，请重试！')
    return false
  }
}

const handlePreview = (uploadFile) => {
  previewUrl.value = uploadFile.url
  previewVisible.value = true
}

const handleRemove = (uploadFile, uploadFiles) => {
  const index = form.images.findIndex(img => img === uploadFile.url)
  if (index > -1) {
    form.images.splice(index, 1)
  }
}

const handleChange = (uploadFile, uploadFiles) => {
  fileList.value = uploadFiles
  form.images = uploadFiles.map(f => f.url).filter(Boolean)
  if (form.images.length > 0) {
    form.image = form.images[0]
  }
}

const addStep = () => {
  form.steps.push({ title: '', desc: '' })
}

const removeStep = (index) => {
  if (form.steps.length > 1) {
    form.steps.splice(index, 1)
  } else {
    ElMessage.warning('至少保留一个工艺步骤')
  }
}

const submitForm = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      
      try {
        const submitData = {
          ...form,
          craftSteps: JSON.stringify(form.steps),
          images: JSON.stringify(form.images)
        }
        
        console.log('提交的表单数据:', submitData)
        
        ElMessage.success('作品提交成功！等待审核中...')
        setTimeout(() => {
          resetForm()
        }, 1000)
      } catch (error) {
        ElMessage.error('提交失败，请重试！')
      } finally {
        submitting.value = false
      }
    }
  })
}

const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
  fileList.value = []
  form.steps = [
    { title: '选材', desc: '精选优质竹材' },
    { title: '破竹', desc: '劈削成均匀竹篾' }
  ]
}
</script>

<style scoped>
.upload-page {
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h1 {
  font-size: 32px;
  color: #2d5016;
  margin-bottom: 10px;
}

.page-header p {
  font-size: 16px;
  color: #666;
}

.form-card {
  padding: 30px;
}

.upload-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 14px;
  color: #888;
}

.craft-steps {
  width: 100%;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

:deep(.el-upload-list--picture-card .el-upload-list__item-thumbnail) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #f5f5f5;
}

:deep(.el-upload--picture-card) {
  width: 148px;
  height: 148px;
}

:deep(.el-dialog__body img) {
  width: 100%;
  height: auto;
  max-height: 500px;
  object-fit: contain;
  display: block;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.similar-card {
  height: 100%;
}

.similar-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.similar-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.similar-item:hover {
  background: #e9ecef;
  transform: translateX(5px);
}

.similar-thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
}

.similar-info {
  flex: 1;
}

.similar-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.similar-category {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.similar-similarity {
  font-size: 12px;
  color: #409eff;
  font-weight: 600;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.history-item:hover {
  background: #e9ecef;
}

.history-item.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-time {
  font-size: 12px;
  color: #999;
}

.history-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.history-actions {
  display: flex;
  gap: 10px;
}

@media (max-width: 768px) {
  .step-item {
    flex-wrap: wrap;
  }
  
  .step-item .el-input {
    width: 100% !important;
  }
  
  .form-card {
    padding: 15px;
  }
  
  .page-header h1 {
    font-size: 24px;
  }
  
  :deep(.el-form-item__label) {
    width: 80px !important;
  }
  
  .similar-card {
    margin-top: 20px;
  }
}
</style>
