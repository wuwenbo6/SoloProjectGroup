<template>
  <div class="upload-page">
    <el-card class="upload-card">
      <template #header>
        <div class="card-header">
          <el-icon size="20"><Upload /></el-icon>
          <span>文档上传</span>
        </div>
      </template>

      <div class="upload-area">
        <el-upload
          drag
          :auto-upload="false"
          :show-file-list="false"
          accept=".pdf,.png,.jpg,.jpeg,.tiff"
          :on-change="handleFileChange"
          :limit="1"
        >
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">
            拖拽文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持 PDF、PNG、JPG、JPEG、TIFF 格式，单个文件最大 100MB
            </div>
          </template>
        </el-upload>
      </div>

      <div v-if="selectedFile" class="file-info">
        <el-descriptions title="文件信息" :column="2" border>
          <el-descriptions-item label="文件名">
            <el-icon><Document /></el-icon>
            {{ selectedFile.name }}
          </el-descriptions-item>
          <el-descriptions-item label="文件大小">
            {{ formatFileSize(selectedFile.size) }}
          </el-descriptions-item>
          <el-descriptions-item label="文件类型">
            {{ selectedFile.type || '未知' }}
          </el-descriptions-item>
          <el-descriptions-item label="上传状态">
            <el-tag :type="uploadStatus.type">{{ uploadStatus.text }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div v-if="uploadProgress > 0 && uploadProgress < 100" class="progress-area">
        <el-progress :percentage="uploadProgress" :stroke-width="20" status="success" />
      </div>

      <div v-if="uploadResult" class="result-area">
        <el-alert
          :title="uploadResult.success ? '上传成功' : '上传失败'"
          :type="uploadResult.success ? 'success' : 'error'"
          :closable="false"
        >
          <template #default>
            <p v-if="uploadResult.success">
              文档ID: {{ uploadResult.document_id }}
            </p>
            <p v-else>
              错误信息: {{ uploadResult.message }}
            </p>

            <div v-if="uploadResult.entities && uploadResult.entities.length > 0">
              <el-divider content-position="left">提取的实体信息</el-divider>
              <el-space wrap>
                <el-tag
                  v-for="(entity, idx) in uploadResult.entities"
                  :key="idx"
                  :type="getEntityTagType(entity.type)"
                  size="large"
                >
                  {{ getEntityLabel(entity.type) }}: {{ entity.value }}
                </el-tag>
              </el-space>
            </div>
          </template>
        </el-alert>
      </div>

      <div class="action-area">
        <el-button
          type="primary"
          size="large"
          :loading="uploading"
          :disabled="!selectedFile || uploadProgress > 0"
          @click="startUpload"
        >
          <el-icon v-if="!uploading"><Upload /></el-icon>
          {{ uploading ? '正在处理...' : '开始上传并解析' }}
        </el-button>
        <el-button size="large" @click="resetUpload" :disabled="uploading">
          重置
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload, UploadFilled, Document } from '@element-plus/icons-vue'
import { uploadDocument } from '@/api'

const selectedFile = ref(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadResult = ref(null)
const uploadStatus = ref({
  type: 'info',
  text: '待上传'
})

const handleFileChange = (file) => {
  selectedFile.value = file.raw
  uploadResult.value = null
  uploadProgress.value = 0
  uploadStatus.value = {
    type: 'primary',
    text: '等待上传'
  }
}

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const startUpload = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  uploadStatus.value = {
    type: 'warning',
    text: '正在处理...'
  }

  try {
    const response = await uploadDocument(
      selectedFile.value,
      (progressEvent) => {
        uploadProgress.value = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
      }
    )

    uploadResult.value = response.data
    uploadStatus.value = {
      type: 'success',
      text: '处理完成'
    }

    ElMessage.success('文档上传并解析成功！')
  } catch (error) {
    console.error('上传失败:', error)
    uploadResult.value = {
      success: false,
      message: error.response?.data?.detail || error.message || '未知错误'
    }
    uploadStatus.value = {
      type: 'danger',
      text: '处理失败'
    }
    ElMessage.error('上传失败，请稍后重试')
  } finally {
    uploading.value = false
  }
}

const resetUpload = () => {
  selectedFile.value = null
  uploadProgress.value = 0
  uploadResult.value = null
  uploadStatus.value = {
    type: 'info',
    text: '待上传'
  }
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
.upload-page {
  height: 100%;
}

.upload-card {
  height: calc(100vh - 130px);
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
}

.upload-area {
  margin-bottom: 30px;
}

:deep(.el-upload-dragger) {
  width: 100%;
  padding: 60px 0;
}

.file-info {
  margin-bottom: 30px;
}

.progress-area {
  margin-bottom: 30px;
}

.result-area {
  margin-bottom: 30px;
}

.action-area {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: auto;
  padding-top: 20px;
}
</style>
