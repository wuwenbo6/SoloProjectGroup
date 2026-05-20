<template>
  <div class="upload-page">
    <el-card shadow="hover">
      <template #header>
        <span>上传古籍扫描图</span>
      </template>
      
      <el-form :model="form" label-width="100px">
        <el-form-item label="古籍名称">
          <el-input v-model="form.bookName" placeholder="请输入古籍名称" />
        </el-form-item>
        <el-form-item label="页码">
          <el-input-number v-model="form.pageNumber" :min="1" />
        </el-form-item>
        <el-form-item label="上传图片">
          <el-upload
              class="upload-demo"
              drag
              :auto-upload="false"
              :on-change="handleFileChange"
              :show-file-list="true"
              accept="image/*"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              拖放古籍扫描图到此处或 <em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持 jpg、png、bmp 等图片格式，建议分辨率 300dpi 以上
              </div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleUpload" :loading="uploading">
            开始上传并解析
          </el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="parseResult" shadow="hover" style="margin-top: 20px;">
      <template #header>
        <span>解析结果</span>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="页面ID">{{ parseResult.pageId }}</el-descriptions-item>
        <el-descriptions-item label="提取文字">
          <div class="extracted-text">{{ parseResult.extractedText }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="AI建议">{{ parseResult.aiSuggestions }}</el-descriptions-item>
        <el-descriptions-item label="异体字检测">{{ parseResult.variantCharacters }}</el-descriptions-item>
      </el-descriptions>
      <div style="margin-top: 20px; text-align: center;">
        <el-button type="primary" @click="goToRestoration">进入修复工作台</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { UploadFilled } from '@element-plus/icons-vue'
import { imageApi } from '@/api'

const router = useRouter()

const form = ref({
  bookName: '',
  pageNumber: 1
})

const uploading = ref(false)
const parseResult = ref(null)
const selectedFile = ref(null)

const handleFileChange = (file) => {
  selectedFile.value = file.raw
}

const handleUpload = async () => {
  if (!form.value.bookName) {
    return
  }
  if (!selectedFile.value) {
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('bookName', form.value.bookName)
    formData.append('pageNumber', form.value.pageNumber)
    formData.append('imageFile', selectedFile.value)

    const result = await imageApi.upload(formData)
    parseResult.value = result
  } catch (error) {
    console.error('上传失败', error)
  } finally {
    uploading.value = false
  }
}

const resetForm = () => {
  form.value = {
    bookName: '',
    pageNumber: 1
  }
  parseResult.value = null
  selectedFile.value = null
}

const goToRestoration = () => {
  if (parseResult.value) {
    router.push(`/restoration/${parseResult.value.pageId}`)
  }
}
</script>

<style scoped>
.upload-page {
  max-width: 800px;
  margin: 0 auto;
}

.upload-demo {
  width: 100%;
}

.extracted-text {
  font-family: '楷体', serif;
  font-size: 16px;
  line-height: 1.8;
  color: #333;
  background: #fdf6e3;
  padding: 15px;
  border-radius: 4px;
}
</style>
