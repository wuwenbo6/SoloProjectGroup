<template>
  <div class="video-uploader">
    <el-upload
      ref="uploadRef"
      class="upload-demo"
      drag
      :action="uploadUrl"
      :headers="headers"
      :on-preview="handlePreview"
      :on-remove="handleRemove"
      :on-success="handleSuccess"
      :on-error="handleError"
      :before-upload="beforeUpload"
      :file-list="fileList"
      :accept="acceptedFormats"
      :limit="1"
    >
      <el-icon class="el-icon--upload"><upload-filled /></el-icon>
      <div class="el-upload__text">
        拖拽视频文件到此处，或 <em>点击上传</em>
      </div>
      <template #tip>
        <div class="el-upload__tip">
          <p>支持格式：{{ supportedVideoFormats.join(', ') }}</p>
          <p>最大文件：500MB</p>
        </div>
      </template>
    </el-upload>

    <el-progress v-if="showProgress" :percentage="uploadProgress" :status="uploadStatus" style="margin-top: 15px;" />

    <div v-if="videoUrl" class="video-preview">
      <h4>上传成功：</h4>
      <video :src="videoUrl" controls style="max-width: 100%; height: auto;">
        您的浏览器不支持视频播放
      </video>
      <p class="video-url">视频地址：{{ videoUrl }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { getSupportedFormats, uploadVideo } from '@/api/upload'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'success'])

const authStore = useAuthStore()
const uploadRef = ref()
const fileList = ref([])
const showProgress = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const videoUrl = ref('')
const supportedFormats = ref({ video: [], image: [] })

const uploadUrl = computed(() => {
  return '/api/upload/video'
})

const headers = computed(() => ({
  'Authorization': `Bearer ${authStore.token}`
}))

const acceptedFormats = computed(() => {
  return supportedFormats.value.video.map(ext => `.${ext}`).join(',')
})

const supportedVideoFormats = computed(() => {
  return supportedFormats.value.video.map(ext => ext.toUpperCase())
})

onMounted(() => {
  loadSupportedFormats()
})

const loadSupportedFormats = async () => {
  try {
    const res = await getSupportedFormats()
    supportedFormats.value = res.data
  } catch (error) {
    console.error('加载支持格式失败', error)
    supportedFormats.value = {
      video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', '3gp'],
      image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
    }
  }
}

const beforeUpload = async (file) => {
  const extension = file.name.split('.').pop().toLowerCase()
  
  if (!supportedFormats.value.video.includes(extension)) {
    ElMessage.error(`不支持的视频格式：${extension}，请上传：${supportedVideoFormats.value.join(', ')}`)
    return false
  }

  const maxSize = 500 * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error('视频大小不能超过500MB')
    return false
  }

  showProgress.value = true
  uploadProgress.value = 0
  uploadStatus.value = ''

  try {
    const res = await uploadVideo(file, (progressEvent) => {
      uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
    })
    
    if (res.data.success) {
      videoUrl.value = res.data.url
      emit('update:modelValue', res.data.url)
      emit('success', res.data)
      uploadStatus.value = 'success'
      ElMessage.success('视频上传成功')
    } else {
      uploadStatus.value = 'exception'
      ElMessage.error(res.data.message || '上传失败')
    }
  } catch (error) {
    uploadStatus.value = 'exception'
    ElMessage.error('上传失败：' + (error.response?.data?.message || error.message))
  }

  return false
}

const handlePreview = (file) => {
  console.log('预览文件：', file)
}

const handleRemove = (file) => {
  videoUrl.value = ''
  emit('update:modelValue', '')
  showProgress.value = false
}

const handleSuccess = (response, file) => {
  console.log('上传成功', response)
}

const handleError = (error, file) => {
  console.error('上传错误', error)
  uploadStatus.value = 'exception'
}
</script>

<style scoped>
.video-uploader {
  padding: 20px;
}

.upload-demo {
  max-width: 600px;
}

.video-preview {
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

.video-preview h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.video-url {
  margin-top: 10px;
  padding: 8px;
  background: white;
  border-radius: 4px;
  word-break: break-all;
  color: #666;
  font-size: 12px;
}
</style>
