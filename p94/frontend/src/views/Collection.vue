<template>
  <div class="collection-page">
    <h2 class="page-title">皮影道具采集</h2>
    
    <el-card>
      <el-form :model="propForm" label-width="100px" :rules="rules" ref="formRef">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="道具名称" prop="name">
              <el-input v-model="propForm.name" placeholder="请输入道具名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="道具分类" prop="category">
              <el-select v-model="propForm.category" placeholder="请选择分类" style="width: 100%">
                <el-option label="人物" value="人物" />
                <el-option label="动物" value="动物" />
                <el-option label="场景" value="场景" />
                <el-option label="器物" value="器物" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="道具描述" prop="description">
          <el-input
            v-model="propForm.description"
            type="textarea"
            :rows="4"
            placeholder="请输入道具详细描述"
          />
        </el-form-item>

        <el-form-item label="道具图片">
          <el-upload
            class="upload-demo"
            :show-file-list="false"
            :before-upload="beforeUpload"
            :on-change="handleFileChange"
            :auto-upload="false"
            accept="image/*"
            :limit="1"
          >
            <div v-if="propForm.imageUrl" class="image-wrapper">
              <img :src="propForm.imageUrl" class="upload-image" />
            </div>
            <div v-else class="upload-placeholder">
              <el-icon class="uploader-icon"><Plus /></el-icon>
              <div class="upload-text">点击上传图片</div>
            </div>
          </el-upload>
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="制作材质">
              <el-input v-model="propForm.material" placeholder="如：驴皮、牛皮等" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="尺寸规格">
              <el-input v-model="propForm.size" placeholder="如：30cm x 20cm" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="来源地">
              <el-input v-model="propForm.origin" placeholder="请输入来源地" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="状态">
          <el-radio-group v-model="propForm.status">
            <el-radio :label="0">草稿</el-radio>
            <el-radio :label="1">已审核</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="submitForm" :loading="loading">保存道具</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { propApi } from '../api'

const formRef = ref(null)
const loading = ref(false)
const currentUser = ref(null)

const propForm = reactive({
  name: '',
  category: '',
  description: '',
  imageUrl: '',
  material: '',
  size: '',
  origin: '',
  collectorId: null,
  status: 0
})

const rules = {
  name: [{ required: true, message: '请输入道具名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择道具分类', trigger: 'change' }]
}

onMounted(() => {
  const userData = localStorage.getItem('user')
  if (userData) {
    currentUser.value = JSON.parse(userData)
    propForm.collectorId = currentUser.value.id
  }
})

const compressImage = (file, maxWidth = 800, maxHeight = 800) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }))
        }, file.type || 'image/jpeg', 0.85)
      }
    }
  })
}

const beforeUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    ElMessage.error('只能上传图片文件！')
    return false
  }
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB！')
    return false
  }
  return true
}

const handleFileChange = async (file) => {
  try {
    loading.value = true
    const compressedFile = await compressImage(file.raw, 1024, 1024)
    const res = await propApi.uploadImage(compressedFile)
    propForm.imageUrl = res.data
    ElMessage.success('图片上传成功')
  } catch (error) {
    console.error('上传失败:', error)
    ElMessage.error('图片上传失败，请重试')
  } finally {
    loading.value = false
  }
}

const submitForm = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        await propApi.create(propForm)
        ElMessage.success('道具保存成功')
        resetForm()
      } catch (error) {
        console.error('保存失败:', error)
      } finally {
        loading.value = false
      }
    }
  })
}

const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
  propForm.imageUrl = ''
}
</script>

<style scoped>
.collection-page {
  padding: 0;
}
.page-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  color: #333;
}
.upload-demo {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 220px;
  height: 220px;
  border: 2px dashed #d9d9d9;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  background: #fafafa;
  overflow: hidden;
}
.upload-demo:hover {
  border-color: #667eea;
  background: #f0f5ff;
}
.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.uploader-icon {
  font-size: 36px;
  color: #8c939d;
}
.upload-text {
  font-size: 12px;
  color: #999;
}
.image-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.upload-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

@media (max-width: 768px) {
  .page-title {
    font-size: 20px;
    margin-bottom: 15px;
  }
  .upload-demo {
    width: 100%;
    max-width: 300px;
    height: 180px;
  }
  .form-footer {
    flex-direction: column;
  }
  .form-footer .el-button {
    width: 100%;
  }
}
</style>
