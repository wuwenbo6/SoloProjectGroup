<template>
  <div class="image-enhancement">
    <div class="enhancement-controls">
      <el-select v-model="enhanceType" size="small" style="width: 120px; margin-right: 10px;">
        <el-option label="锐化增强" value="sharpen" />
        <el-option label="对比度增强" value="contrast" />
        <el-option label="去噪处理" value="denoise" />
        <el-option label="边缘增强" value="edge" />
        <el-option label="亮度调整" value="brightness" />
        <el-option label="直方图均衡" value="histogram" />
      </el-select>
      <el-slider
        v-model="intensity"
        :min="0"
        :max="100"
        style="width: 150px; margin-right: 10px;"
      />
      <el-button type="primary" size="small" :loading="loading" @click="handleEnhance">
        应用增强
      </el-button>
    </div>

    <div class="comparison-view">
      <div class="image-pane">
        <div class="pane-header">原图</div>
        <div class="pane-content">
          <img v-if="originalImage" :src="originalImage" alt="原图" @click="openViewer(originalImage)" class="clickable-image" />
          <div v-else class="image-placeholder">
            <el-icon size="40"><Picture /></el-icon>
            <span>等待图像...</span>
          </div>
        </div>
      </div>
      <div class="image-pane">
        <div class="pane-header">增强后</div>
        <div class="pane-content">
          <img v-if="enhancedImage" :src="enhancedImage" alt="增强后" @click="openViewer(enhancedImage)" class="clickable-image" />
          <div v-else class="image-placeholder">
            <el-icon size="40"><MagicStick /></el-icon>
            <span>点击应用增强</span>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="viewerVisible" title="图像查看" width="80%" top="5vh">
      <div class="viewer-container">
        <img :src="currentViewImage" alt="查看图像" class="viewer-image" />
      </div>
      <div class="viewer-tools">
        <el-button-group>
          <el-button size="small" @click="zoomIn">
            <el-icon><ZoomIn /></el-icon> 放大
          </el-button>
          <el-button size="small" @click="zoomOut">
            <el-icon><ZoomOut /></el-icon> 缩小
          </el-button>
          <el-button size="small" @click="resetZoom">
            <el-icon><Refresh /></el-icon> 重置
          </el-button>
        </el-button-group>
        <el-button size="small" type="primary" @click="toggleAnnotation">
          <el-icon><EditPen /></el-icon> {{ isAnnotating ? '取消标注' : '添加标注' }}
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRubbingStore } from '@/stores/rubbing'
import {
  Picture,
  MagicStick,
  ZoomIn,
  ZoomOut,
  Refresh,
  EditPen
} from '@element-plus/icons-vue'

const store = useRubbingStore()

const enhanceType = ref('sharpen')
const intensity = ref(50)
const loading = ref(false)
const originalImage = ref(null)
const enhancedImage = ref(null)
const viewerVisible = ref(false)
const currentViewImage = ref(null)
const isAnnotating = ref(false)
const zoomLevel = ref(1)

const handleEnhance = async () => {
  loading.value = true
  try {
    const res = await store.enhanceImage(enhanceType.value, intensity.value)
    originalImage.value = res.data.original
    enhancedImage.value = res.data.enhanced
    ElMessage.success('图像增强完成')
  } catch (error) {
    ElMessage.error('图像增强失败')
  } finally {
    loading.value = false
  }
}

const openViewer = (image) => {
  currentViewImage.value = image
  zoomLevel.value = 1
  viewerVisible.value = true
}

const zoomIn = () => {
  zoomLevel.value = Math.min(3, zoomLevel.value + 0.25)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(0.25, zoomLevel.value - 0.25)
}

const resetZoom = () => {
  zoomLevel.value = 1
}

const toggleAnnotation = () => {
  isAnnotating.value = !isAnnotating.value
  if (isAnnotating.value) {
    ElMessage.info('点击图像添加标注')
  }
}
</script>

<style scoped>
.image-enhancement {
  width: 100%;
}

.enhancement-controls {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 6px;
}

.comparison-view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.image-pane {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  overflow: hidden;
}

.pane-header {
  padding: 8px 12px;
  background: #f5f7fa;
  font-weight: 500;
  text-align: center;
  border-bottom: 1px solid #dcdfe6;
}

.pane-content {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  overflow: hidden;
}

.pane-content img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.clickable-image {
  cursor: pointer;
  transition: transform 0.2s;
}

.clickable-image:hover {
  transform: scale(1.02);
}

.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #909399;
}

.viewer-container {
  text-align: center;
  overflow: auto;
  max-height: 60vh;
}

.viewer-image {
  max-width: 100%;
  transition: transform 0.3s;
}

.viewer-tools {
  display: flex;
  justify-content: space-between;
  padding: 15px;
  border-top: 1px solid #ebeef5;
  margin-top: 15px;
}
</style>
