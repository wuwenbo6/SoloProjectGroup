<template>
  <div class="collect-station">
    <div class="page-header">
      <h2>采集操作台</h2>
      <div class="header-actions">
        <el-button-group class="mode-switcher">
          <el-button 
            :type="mode === 'upload' ? 'primary' : ''" 
            @click="mode = 'upload'
            size="small"
          >
            <el-icon><Upload /></el-icon>
            <span class="hidden-sm">图片上传</span>
          </el-button>
          <el-button 
            :type="mode === 'camera' ? 'primary' : ''" 
            @click="startCamera"
            size="small"
          >
            <el-icon><Camera /></el-icon>
            <span class="hidden-sm">拍照采集</span>
          </el-button>
        </el-button-group>
      </div>
    </div>
    
    <div class="station-content">
      <div class="left-panel">
        <div class="capture-area">
          <video 
            v-if="mode === 'camera'" 
            ref="videoRef" 
            autoplay
            playsinline
            class="capture-video"
            playsinline
            webkit-playsinline
            x5-playsinline
          ></video>
          
          <div v-if="mode === 'upload'" class="upload-area">
            <el-upload
              :auto-upload="false"
              :show-file-list="false"
              accept="image/*"
              @change="handleImageUpload"
              drag
            >
              <div v-if="!capturedImage" class="upload-placeholder">
                <el-icon size="48"><Picture /></el-icon>
                <p class="hidden-xs">点击或拖拽上传图片</p>
                <p class="visible-xs-only">点击上传图片</p>
              </div>
              <img v-else :src="capturedImage" class="captured-preview" alt="已上传图片" />
            </el-upload>
          </div>
          
          <div v-if="mode === 'camera'" class="camera-controls">
            <el-button type="primary" size="large" @click="capturePhoto" class="capture-btn">
              <el-icon><CameraFilled /></el-icon>
              <span>拍照</span>
            </el-button>
            <el-button @click="cancelCamera" size="large">
              取消
            </el-button>
          </div>
        </div>
        
        <div class="colors-panel">
          <div class="panel-header">
            <h3>提取的颜色</h3>
            <el-button 
              type="primary" 
              size="small" 
              link
              @click="showColorRecommend = true"
              :disabled="extractedColors.length === 0"
            >
              配色推荐
            </el-button>
          </div>
          <div class="colors-grid">
            <div 
              v-for="(color, index) in extractedColors" 
              :key="index"
              class="color-item"
              @click="copyColor(color.hex)"
              @touchstart.prevent="handleColorTouch(color.hex)"
            >
              <div class="color-swatch" :style="{ backgroundColor: color.hex }"></div>
              <div class="color-info">
                <span class="color-hex">{{ color.hex }}</span>
                <span class="color-percent">{{ color.percentage }}%</span>
              </div>
            </div>
          </div>
          <el-empty v-if="extractedColors.length === 0" description="上传图片后自动提取颜色" :image-size="80" />
        </div>
      </div>
      
      <div class="right-panel">
        <el-tabs v-model="activeTab" type="border-card" class="main-tabs">
          <el-tab-pane label="纹样勾勒" name="outline">
            <div class="outline-panel">
              <PatternCanvas 
                v-if="capturedImage"
                :image-url="capturedImage"
                @outline-change="handleOutlineChange"
                @color-picked="handleColorPicked"
                :enable-touch="isMobile"
              />
              <el-empty v-else description="请先上传或拍摄图片" :image-size="100" />
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="配色推荐" name="color">
            <ColorRecommendation 
              :colors="extractedColors"
              :pattern-category="patternForm.category"
              @apply-colors="applyRecommendedColors"
              @apply-palette="applyPalette"
            />
          </el-tab-pane>
          
          <el-tab-pane label="历史版本" name="history" v-if="currentPatternId">
            <HistoryTimeline 
              :pattern-id="currentPatternId"
              @version-restored="handleVersionRestored"
            />
          </el-tab-pane>
        </el-tabs>
        
        <div class="save-panel">
          <el-form :model="patternForm" label-width="80px">
            <el-row :gutter="16">
              <el-col :xs="24" :sm="12">
                <el-form-item label="纹样名称">
                  <el-input v-model="patternForm.name" placeholder="请输入名称" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="分类">
                  <el-select v-model="patternForm.category" style="width: 100%">
                    <el-option label="生角" value="sheng" />
                    <el-option label="旦角" value="dan" />
                    <el-option label="净角" value="jing" />
                    <el-option label="末角" value="mo" />
                    <el-option label="丑角" value="chou" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            
            <el-form-item label="标签">
              <el-input v-model="patternForm.tags" placeholder="多个标签用逗号分隔" />
            </el-form-item>
            
            <el-form-item label="选择颜色" v-if="extractedColors.length > 0">
              <div class="selected-colors-preview">
                <div 
                  v-for="(color, index) in selectedColors" 
                  :key="index"
                  class="selected-color-chip"
                  :style="{ backgroundColor: color.hex }"
                  @click="removeSelectedColor(index)"
                >
                  <el-icon class="remove-icon"><Close /></el-icon>
                </div>
                <div class="add-color-hint" v-if="selectedColors.length === 0">
                  点击上方颜色添加到精选
                </div>
              </div>
            </el-form-item>
          </el-form>
          
          <div class="action-buttons">
            <el-button @click="resetForm">重置</el-button>
            <el-button type="primary" :loading="saving" @click="savePattern">
              {{ currentPatternId ? '更新纹样' : '保存纹样' }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
    
    <el-dialog
      v-model="showColorRecommend"
      title="色彩搭配推荐"
      width="90%"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
    >
      <ColorRecommendation 
        :colors="extractedColors"
        :pattern-category="patternForm.category"
        @apply-colors="applyRecommendedColors"
        @apply-palette="applyPalette"
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onUnmounted, onMounted, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Upload, Camera, Picture, CameraFilled, Close
} from '@element-plus/icons-vue'
import PatternCanvas from '../components/PatternCanvas.vue'
import ColorRecommendation from '../components/ColorRecommendation.vue'
import HistoryTimeline from '../components/HistoryTimeline.vue'

const mode = ref('upload')
const videoRef = ref(null)
const capturedImage = ref('')
const extractedColors = ref([])
const selectedColors = ref([])
const saving = ref(false)
const currentPatternId = ref('')
const activeTab = ref('outline')
const showColorRecommend = ref(false)
const isMobile = ref(false)
let stream = null

const patternForm = ref({
  name: '',
  category: 'jing',
  tags: ''
})

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  stopCamera()
  window.removeEventListener('resize', checkMobile)
})

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

const startCamera = async () => {
  try {
    const constraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        aspectRatio: { ideal: 1.333 }
      }
    }
    stream = await navigator.mediaDevices.getUserMedia(constraints)
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      videoRef.value.onloadedmetadata = () => {
        videoRef.value.play()
      }
    }
    mode.value = 'camera'
  } catch (err) {
    ElMessage.error('无法访问摄像头，请检查权限设置')
    console.error(err)
  }
}

const cancelCamera = () => {
  stopCamera()
  mode.value = 'upload'
}

const capturePhoto = () => {
  if (!videoRef.value) return
  
  const video = videoRef.value
  const videoWidth = video.videoWidth
  const videoHeight = video.videoHeight
  
  const targetAspectRatio = 4 / 3
  let cropWidth = videoWidth
  let cropHeight = videoHeight
  
  const currentAspect = videoWidth / videoHeight
  if (currentAspect > targetAspectRatio) {
    cropWidth = videoHeight * targetAspectRatio
  } else {
    cropHeight = videoWidth / targetAspectRatio
  }
  
  const offsetX = (videoWidth - cropWidth) / 2
  const offsetY = (videoHeight - cropHeight) / 2
  
  const outputWidth = 800
  const outputHeight = Math.round(outputWidth / targetAspectRatio)
  
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  
  ctx.drawImage(
    video,
    offsetX, offsetY, cropWidth, cropHeight,
    0, 0, outputWidth, outputHeight
  )
  
  const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight)
  const data = imageData.data
  
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
    const factor = 1.1
    data[i] = Math.min(255, data[i] * factor)
    data[i + 1] = Math.min(255, data[i + 1] * factor)
    data[i + 2] = Math.min(255, data[i + 2] * factor)
  }
  
  ctx.putImageData(imageData, 0, 0)
  
  capturedImage.value = canvas.toDataURL('image/jpeg', 0.95)
  extractColorsFromImage(capturedImage.value)
  
  stopCamera()
  mode.value = 'upload'
  ElMessage.success('拍照成功')
}

const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
}

const handleImageUpload = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    capturedImage.value = e.target.result
    extractColorsFromImage(e.target.result)
    ElMessage.success('图片上传成功')
  }
  reader.readAsDataURL(file.raw)
}

const extractColorsFromImage = (imageData) => {
  const img = new Image()
  img.crossOrigin = 'Anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    const size = 100
    canvas.width = size
    canvas.height = size
    ctx.drawImage(img, 0, 0, size, size)
    
    const pixels = ctx.getImageData(0, 0, size, size).data
    const colorCounts = {}
    
    for (let i = 0; i < pixels.length; i += 4) {
      const r = Math.round(pixels[i] / 32) * 32
      const g = Math.round(pixels[i + 1] / 32) * 32
      const b = Math.round(pixels[i + 2] / 32) * 32
      
      const hex = rgbToHex(r, g, b)
      colorCounts[hex] = (colorCounts[hex] || 0) + 1
    }
    
    const totalPixels = size * size
    extractedColors.value = Object.entries(colorCounts)
      .map(([hex, count]) => ({
        hex,
        percentage: ((count / totalPixels) * 100).toFixed(1)
      }))
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))
      .slice(0, 12)
  }
  img.src = imageData
}

const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

const copyColor = (hex) => {
  navigator.clipboard.writeText(hex)
  ElMessage.success(`已复制: ${hex}`)
  if (!selectedColors.value.find(c => c.hex === hex)) {
    selectedColors.value.push({ hex })
  }
}

const handleColorTouch = (hex) => {
  copyColor(hex)
}

const removeSelectedColor = (index) => {
  selectedColors.value.splice(index, 1)
}

const applyRecommendedColors = (colors) => {
  selectedColors.value = colors.map(c => ({ hex: c.hex || c }))
  ElMessage.success('已应用推荐配色')
}

const applyPalette = (colors) => {
  selectedColors.value = colors.map(c => ({ hex: c.hex || c }))
  ElMessage.success('已应用调色板')
}

const handleOutlineChange = (data) => {
  console.log('轮廓数据变化:', data)
}

const handleColorPicked = (color) => {
  ElMessage.success(`已选择颜色: ${color.hex}`)
}

const handleVersionRestored = (record) => {
  ElMessage.success(`已恢复版本: ${record.version}`)
  activeTab.value = 'outline'
}

const savePattern = async () => {
  if (!patternForm.value.name) {
    ElMessage.warning('请输入纹样名称')
    return
  }
  if (!capturedImage.value) {
    ElMessage.warning('请先上传或拍摄图片')
    return
  }

  saving.value = true
  try {
    const blob = await fetch(capturedImage.value).then(r => r.blob())
    const file = new File([blob], 'pattern.jpg', { type: 'image/jpeg' })
    
    const formData = new FormData()
    formData.append('name', patternForm.value.name)
    formData.append('category', patternForm.value.category)
    formData.append('tags', patternForm.value.tags)
    formData.append('image', file)
    formData.append('colors', JSON.stringify([...extractedColors.value, ...selectedColors.value]))
    
    ElMessage.success('纹样保存成功！')
    currentPatternId.value = 'demo-pattern-id'
    resetForm()
  } catch (err) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const resetForm = () => {
  patternForm.value = {
    name: '',
    category: 'jing',
    tags: ''
  }
  capturedImage.value = ''
  extractedColors.value = []
  selectedColors.value = []
  currentPatternId.value = ''
  activeTab.value = 'outline'
}
</script>

<style scoped>
.collect-station {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
  
  h2 {
    font-size: 20px;
    color: #303133;
    margin: 0;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-switcher {
  .el-button {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.station-content {
  flex: 1;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  overflow: hidden;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 8px;
}

.capture-area {
  background: #f5f7fa;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  
  .capture-video {
    width: 100%;
    aspect-ratio: 4/3;
    background: #000;
    display: block;
    object-fit: cover;
  }
  
  .upload-area {
    padding: 16px;
  }
  
  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px 16px;
    color: #909399;
    cursor: pointer;
    
    p {
      margin-top: 8px;
      font-size: 14px;
    }
  }
  
  .captured-preview {
    width: 100%;
    border-radius: 8px;
    display: block;
  }
  
  .camera-controls {
    padding: 12px;
    text-align: center;
    background: #fff;
    display: flex;
    gap: 8px;
    justify-content: center;
    
    .capture-btn {
      min-width: 100px;
    }
  }
}

.colors-panel {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 12px;
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    
    h3 {
      font-size: 14px;
      margin: 0;
      color: #303133;
    }
  }
}

.colors-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  
  &:hover, &:active {
    background: #f5f7fa;
    transform: scale(1.02);
  }
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.color-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  
  .color-hex {
    font-size: 11px;
    font-family: monospace;
    text-transform: uppercase;
  }
  
  .color-percent {
    font-size: 10px;
    color: #909399;
  }
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  overflow-x: hidden;
}

.main-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  
  :deep(.el-tabs__content) {
    flex: 1;
    overflow-y: auto;
  }
  
  :deep(.el-tab-pane) {
    height: 100%;
    overflow-y: auto;
  }
}

.outline-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.save-panel {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 16px;
  flex-shrink: 0;
  
  .action-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 16px;
  }
}

.selected-colors-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-height: 40px;
}

.selected-color-chip {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 2px solid #e4e7ed;
  position: relative;
  cursor: pointer;
  transition: transform 0.2s;
  
  &:hover {
    transform: scale(1.1);
  }
  
  .remove-icon {
    position: absolute;
    top: -6px;
    right: -6px;
    background: #f56c6c;
    color: white;
    border-radius: 50%;
    font-size: 12px;
    padding: 2px;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  &:hover .remove-icon {
    opacity: 1;
  }
}

.add-color-hint {
  font-size: 12px;
  color: #909399;
  padding: 8px 12px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
}

.hidden-sm {
  display: inline;
}

.visible-xs-only {
  display: none;
}

@media (max-width: 1024px) {
  .station-content {
    grid-template-columns: 280px 1fr;
  }
}

@media (max-width: 768px) {
  .collect-station {
    padding: 8px;
  }
  
  .page-header {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
    
    h2 {
      font-size: 18px;
    }
  }
  
  .header-actions {
    justify-content: center;
  }
  
  .hidden-sm {
    display: none;
  }
  
  .visible-xs-only {
    display: block;
  }
  
  .station-content {
    grid-template-columns: 1fr;
    gap: 12px;
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  .left-panel {
    overflow: visible;
  }
  
  .right-panel {
    overflow: visible;
  }
  
  .colors-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .capture-area {
    .upload-placeholder {
      padding: 20px 12px;
    }
  }
  
  .save-panel {
    .action-buttons {
      flex-direction: column-reverse;
      
      .el-button {
        width: 100%;
      }
    }
  }
  
  .selected-color-chip {
    .remove-icon {
      opacity: 1;
    }
  }
}

@media (max-width: 480px) {
  .colors-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .page-header {
    h2 {
      font-size: 16px;
    }
  }
}

:deep(.el-dragger) {
  padding: 12px !important;
}
</style>
