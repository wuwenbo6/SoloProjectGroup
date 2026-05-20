<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-title">拓片采集操作台</div>
      <div class="header-actions">
        <el-button type="primary" @click="showUploadDialog = true">
          <el-icon><Upload /></el-icon>
          上传拓片
        </el-button>
        <el-button @click="handleLogout">退出</el-button>
      </div>
    </div>
    <div class="page-content">
      <el-row :gutter="20" style="height: 100%;">
        <el-col :span="6" style="height: 100%;">
          <div class="sidebar">
            <h3 style="margin-bottom: 16px;">拓片列表</h3>
            <el-list border>
              <el-list-item
                v-for="item in rubbingList"
                :key="item.id"
                @click="selectRubbing(item)"
                style="cursor: pointer; padding: 12px;"
                :class="{ 'is-active': selectedRubbing?.id === item.id }"
              >
                <div style="display: flex; align-items: center; gap: 12px;">
                  <img :src="item.thumbnailUrl" style="width: 50px; height: 50px; object-fit: cover;" />
                  <div>
                    <div style="font-weight: 500;">{{ item.name }}</div>
                    <div style="font-size: 12px; color: #909399;">{{ getStatusText(item.status) }}</div>
                  </div>
                </div>
              </el-list-item>
            </el-list>
          </div>
        </el-col>
        <el-col :span="18" style="height: 100%;">
          <div class="canvas-container">
            <div class="toolbar">
              <el-button size="small" @click="goToInterpretation" :disabled="!selectedRubbing">
                进入释读
              </el-button>
              <el-button size="small" type="danger" @click="deleteRubbing" :disabled="!selectedRubbing">
                删除
              </el-button>
            </div>
            <div class="canvas-area" v-loading="loading">
              <div v-if="!selectedRubbing" class="empty-tip">
                <el-empty description="请选择或上传拓片" />
              </div>
              <img v-else :src="selectedRubbing.imageUrl" class="rubbing-image" />
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <el-dialog v-model="showUploadDialog" title="上传拓片" width="500px">
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :show-file-list="true"
        accept="image/*"
        :limit="1"
        :on-change="handleFileChange"
      >
        <el-button type="primary">选择文件</el-button>
        <template #tip>
          <div class="el-upload__tip">
            支持 jpg、png 格式，建议分辨率 300dpi 以上
          </div>
        </template>
      </el-upload>
      <el-form :model="uploadForm" label-width="80px" style="margin-top: 20px;">
        <el-form-item label="拓片名称">
          <el-input v-model="uploadForm.name" placeholder="请输入拓片名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="uploadForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpload" :loading="uploading">上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import { rubbingApi } from '@/api'
import { useUserStore } from '@/store/user'
import { processImage, type ProcessedImage } from '@/utils/imageProcessor'
import type { Rubbing } from '@/types'

const router = useRouter()
const userStore = useUserStore()
const uploadRef = ref()
const loading = ref(false)
const uploading = ref(false)
const showUploadDialog = ref(false)
const rubbingList = ref<Rubbing[]>([])
const selectedRubbing = ref<Rubbing | null>(null)
const selectedFile = ref<File | null>(null)
const processedImage = ref<ProcessedImage | null>(null)
const previewImageUrl = ref('')

const uploadForm = ref({
  name: '',
  description: ''
})

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    UPLOADED: '已上传',
    PROCESSING: '处理中',
    INTERPRETED: '已释读'
  }
  return map[status] || status
}

const loadRubbingList = async () => {
  loading.value = true
  try {
    const res: any = await rubbingApi.list()
    rubbingList.value = res.list || []
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const selectRubbing = (item: Rubbing) => {
  selectedRubbing.value = item
}

const handleFileChange = async (file: any) => {
  selectedFile.value = file.raw
  if (file.raw) {
    uploading.value = true
    try {
      processedImage.value = await processImage(file.raw)
      previewImageUrl.value = processedImage.value.thumbnail
    } catch (error) {
      ElMessage.error('图片处理失败，请重新选择')
      selectedFile.value = null
      uploadRef.value?.clearFiles()
    } finally {
      uploading.value = false
    }
  }
}

const handleUpload = async () => {
  if (!selectedFile.value || !processedImage.value) {
    ElMessage.warning('请选择文件')
    return
  }
  if (!uploadForm.value.name) {
    ElMessage.warning('请输入拓片名称')
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', processedImage.value.file)
    formData.append('name', uploadForm.value.name)
    formData.append('description', uploadForm.value.description || '')
    formData.append('width', processedImage.value.width.toString())
    formData.append('height', processedImage.value.height.toString())

    await rubbingApi.upload(formData)
    ElMessage.success('上传成功')
    showUploadDialog.value = false
    uploadForm.value = { name: '', description: '' }
    selectedFile.value = null
    processedImage.value = null
    previewImageUrl.value = ''
    uploadRef.value?.clearFiles()
    loadRubbingList()
  } catch (error) {
    console.error(error)
  } finally {
    uploading.value = false
  }
}

const goToInterpretation = () => {
  if (selectedRubbing.value) {
    router.push(`/interpretation/${selectedRubbing.value.id}`)
  }
}

const deleteRubbing = async () => {
  if (!selectedRubbing.value) return
  try {
    await ElMessageBox.confirm('确定要删除该拓片吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await rubbingApi.delete(selectedRubbing.value.id)
    ElMessage.success('删除成功')
    selectedRubbing.value = null
    loadRubbingList()
  } catch {
  }
}

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}

onMounted(() => {
  loadRubbingList()
})
</script>

<style scoped lang="scss">
.canvas-area {
  height: calc(100% - 57px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background: #f5f7fa;
}

.empty-tip {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rubbing-image {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  image-rendering: high-quality;
  -webkit-font-smoothing: antialiased;
}

:deep(.el-list-item.is-active) {
  background-color: #ecf5ff !important;
  color: #409eff;
}
</style>
