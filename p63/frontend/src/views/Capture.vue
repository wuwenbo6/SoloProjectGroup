<template>
  <div class="capture-page">
    <el-card class="upload-card">
      <template #header>
        <div class="card-header">
          <span>拓片采集操作台</span>
        </div>
      </template>

      <el-upload
        ref="uploadRef"
        class="upload-demo"
        drag
        :auto-upload="false"
        :show-file-list="false"
        :on-change="handleFileChange"
        accept="image/*"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          将拓片图片拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 jpg、png、gif 格式，建议上传高清扫描件
          </div>
        </template>
      </el-upload>

      <div v-if="previewImage" class="preview-section">
        <h3>图片预览</h3>
        <div class="preview-container">
          <img :src="previewImage" alt="预览图" class="preview-image" />
        </div>

        <div class="processing-tools">
          <h4>图像处理工具</h4>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-button
                type="primary"
                :icon="MagicStick"
                :loading="processing"
                @click="processImage('denoise')"
              >
                降噪处理
              </el-button>
            </el-col>
            <el-col :span="8">
              <el-button
                type="success"
                :icon="Picture"
                :loading="processing"
                @click="processImage('contrast')"
              >
                对比度增强
              </el-button>
            </el-col>
            <el-col :span="8">
              <el-button
                type="warning"
                :icon="Aim"
                :loading="recognizing"
                @click="startRecognition"
                :disabled="!rubbingId"
              >
                文字识别
              </el-button>
            </el-col>
          </el-row>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="rubbingForm"
        :rules="rules"
        label-width="100px"
        class="rubbing-form"
      >
        <el-form-item label="标题" prop="title">
          <el-input v-model="rubbingForm.title" placeholder="请输入拓片标题" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="rubbingForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入拓片描述"
          />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="朝代">
              <el-input v-model="rubbingForm.dynasty" placeholder="如：唐代" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="出土地点">
              <el-input v-model="rubbingForm.location" placeholder="如：西安" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="材质">
              <el-input v-model="rubbingForm.material" placeholder="如：石碑" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="标签">
          <el-input
            v-model="rubbingForm.tags"
            placeholder="多个标签用逗号分隔，如：楷书, 碑刻, 唐代"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            保存拓片
          </el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { rubbingAPI } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const uploadRef = ref()
const formRef = ref()
const previewImage = ref('')
const selectedFile = ref(null)
const submitting = ref(false)
const processing = ref(false)
const recognizing = ref(false)
const rubbingId = ref('')

const rubbingForm = reactive({
  title: '',
  description: '',
  dynasty: '',
  location: '',
  material: '',
  tags: ''
})

const rules = {
  title: [
    { required: true, message: '请输入拓片标题', trigger: 'blur' },
    { min: 2, max: 100, message: '标题长度在 2 到 100 个字符', trigger: 'blur' }
  ]
}

const handleFileChange = (file) => {
  selectedFile.value = file.raw
  const reader = new FileReader()
  reader.onload = (e) => {
    previewImage.value = e.target.result
  }
  reader.readAsDataURL(file.raw)
}

const handleSubmit = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先上传拓片图片')
    return
  }

  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        const formData = new FormData()
        formData.append('image', selectedFile.value)
        formData.append('title', rubbingForm.title)
        formData.append('description', rubbingForm.description)
        formData.append('dynasty', rubbingForm.dynasty)
        formData.append('location', rubbingForm.location)
        formData.append('material', rubbingForm.material)
        formData.append('tags', rubbingForm.tags)

        const response = await rubbingAPI.create(formData)
        rubbingId.value = response.data.rubbing._id
        ElMessage.success('拓片保存成功')
        
        await ElMessageBox.confirm(
          '拓片已保存，是否立即进行图像处理和文字识别？',
          '提示',
          {
            confirmButtonText: '立即处理',
            cancelButtonText: '稍后处理'
          }
        )
        
        await processImage('denoise')
        await startRecognition()
        router.push(`/rubbings/${rubbingId.value}/interpret`)
      } catch (error) {
        ElMessage.error(error.response?.data?.message || '保存失败')
      } finally {
        submitting.value = false
      }
    }
  })
}

const processImage = async (type) => {
  if (!rubbingId.value) {
    ElMessage.warning('请先保存拓片')
    return
  }

  processing.value = true
  try {
    const operations = [{ type }]
    if (type === 'contrast') {
      operations[0].contrast = 1.5
    }
    await rubbingAPI.processImage(rubbingId.value, operations)
    ElMessage.success('图像处理完成')
  } catch (error) {
    ElMessage.error('图像处理失败')
  } finally {
    processing.value = false
  }
}

const startRecognition = async () => {
  if (!rubbingId.value) {
    ElMessage.warning('请先保存拓片')
    return
  }

  recognizing.value = true
  try {
    await rubbingAPI.recognizeCharacters(rubbingId.value)
    ElMessage.success('文字识别完成')
  } catch (error) {
    ElMessage.error('文字识别失败')
  } finally {
    recognizing.value = false
  }
}

const resetForm = () => {
  Object.assign(rubbingForm, {
    title: '',
    description: '',
    dynasty: '',
    location: '',
    material: '',
    tags: ''
  })
  previewImage.value = ''
  selectedFile.value = null
  rubbingId.value = ''
}
</script>

<style scoped>
.capture-page {
  max-width: 1000px;
  margin: 0 auto;
}

.upload-card {
  border: none;
}

.card-header {
  font-size: 16px;
  font-weight: 500;
}

.upload-demo {
  margin-bottom: 30px;
}

.preview-section {
  margin-bottom: 30px;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
}

.preview-section h3 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #333;
}

.preview-container {
  text-align: center;
  margin-bottom: 20px;
}

.preview-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.processing-tools {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e8e8e8;
}

.processing-tools h4 {
  margin: 0 0 16px;
  font-size: 14px;
  color: #666;
}

.rubbing-form {
  padding-top: 20px;
  border-top: 1px solid #e8e8e8;
}
</style>
