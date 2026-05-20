<template>
  <div class="file-manager">
    <el-upload
      drag
      :auto-upload="false"
      :on-change="handleFileChange"
      accept=".sgy,.segy"
      class="upload-area"
    >
      <el-icon class="el-icon--upload"><upload-filled /></el-icon>
      <div class="el-upload__text">
        拖拽SEG-Y文件到此处或 <em>点击上传</em>
      </div>
    </el-upload>

    <el-input
      v-model="fileDescription"
      placeholder="文件描述（可选）"
      class="description-input"
      type="textarea"
      :rows="2"
    />

    <el-button
      type="primary"
      :loading="store.loading"
      :disabled="!selectedFile"
      @click="uploadFile"
      class="upload-btn"
    >
      上传文件
    </el-button>

    <el-divider>文件列表</el-divider>

    <div class="file-list">
      <el-card
        v-for="file in store.files"
        :key="file.id"
        class="file-card"
        :class="{ 'is-active': store.currentFile?.id === file.id }"
        shadow="hover"
      >
        <div class="file-info" @click="selectFile(file.id)">
          <el-icon class="file-icon"><Document /></el-icon>
          <div class="file-details">
            <div class="file-name">{{ file.filename }}</div>
            <div class="file-meta">
              <span>{{ (file.file_size / 1024 / 1024).toFixed(2) }} MB</span>
              <span>{{ file.inline_count }} × {{ file.crossline_count }} × {{ file.sample_count }}</span>
            </div>
          </div>
        </div>
        <div class="file-actions">
          <el-checkbox
            :model-value="store.selectedFiles.includes(file.id)"
            @change="store.toggleFileSelection(file.id)"
          />
          <el-button
            type="danger"
            size="small"
            icon="Delete"
            circle
            @click.stop="deleteFile(file.id)"
          />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useSeismicStore } from '../stores/seismic'
import { ElMessage, ElMessageBox } from 'element-plus'

const emit = defineEmits(['file-selected'])

const store = useSeismicStore()
const selectedFile = ref(null)
const fileDescription = ref('')

const handleFileChange = (file) => {
  selectedFile.value = file.raw
}

const uploadFile = async () => {
  if (!selectedFile.value) return
  
  try {
    await store.uploadFile(selectedFile.value, fileDescription.value)
    ElMessage.success('文件上传成功')
    selectedFile.value = null
    fileDescription.value = ''
  } catch (error) {
    ElMessage.error('文件上传失败')
  }
}

const selectFile = (fileId) => {
  emit('file-selected', fileId)
}

const deleteFile = async (fileId) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除此文件吗？',
      '删除确认',
      { type: 'warning' }
    )
    await store.deleteFile(fileId)
    ElMessage.success('文件删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}
</script>

<style scoped>
.file-manager {
  padding: 10px;
}

.upload-area {
  margin-bottom: 10px;
}

.description-input {
  margin-bottom: 10px;
}

.upload-btn {
  width: 100%;
  margin-bottom: 10px;
}

.file-list {
  max-height: 400px;
  overflow-y: auto;
}

.file-card {
  margin-bottom: 10px;
  cursor: pointer;
}

.file-card.is-active {
  border: 2px solid #409eff;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-icon {
  font-size: 32px;
  color: #409eff;
}

.file-details {
  flex: 1;
  overflow: hidden;
}

.file-name {
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  font-size: 12px;
  color: #909399;
  display: flex;
  gap: 10px;
}

.file-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
}
</style>
