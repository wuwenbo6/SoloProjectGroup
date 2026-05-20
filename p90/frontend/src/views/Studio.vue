<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { patternApi } from '../api'
import { getRecommendedPalettes, getHarmonyColors } from '../utils/colorRecommender'

const patternName = ref('')
const patternTags = ref('')
const patternDescription = ref('')
const uploadedImage = ref(null)
const imagePreview = ref(null)
const isDrawing = ref(false)
const brushSize = ref(5)
const brushColor = ref('#C41E3A')
const isUploading = ref(false)
const canvasRef = ref(null)
const showColorPanel = ref(false)
const showHistoryPanel = ref(false)

const history = ref([])
const historyIndex = ref(-1)
const MAX_HISTORY = 50

const currentPalette = ref(null)
const harmonyFilter = ref('all')

const harmonyColors = computed(() => {
  const colors = getHarmonyColors(brushColor.value)
  if (harmonyFilter.value === 'all') {
    return [
      { name: '互补色', colors: [colors.complementary] },
      { name: '邻近色', colors: colors.analogous },
      { name: '三角色', colors: colors.triadic }
    ]
  }
  return []
})

const recommendedPalettes = computed(() => {
  return getRecommendedPalettes(brushColor.value)
})

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = 500

const saveToHistory = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const imageData = canvas.toDataURL()
  
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  
  history.value.push({
    imageData,
    timestamp: Date.now(),
    description: `绘制操作`
  })
  
  if (history.value.length > MAX_HISTORY) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

const undo = () => {
  if (!canUndo.value) return
  
  historyIndex.value--
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  const img = new Image()
  img.onload = () => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.drawImage(img, 0, 0)
  }
  img.src = history.value[historyIndex.value].imageData
  ElMessage.info('已撤销')
}

const redo = () => {
  if (!canRedo.value) return
  
  historyIndex.value++
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  const img = new Image()
  img.onload = () => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.drawImage(img, 0, 0)
  }
  img.src = history.value[historyIndex.value].imageData
  ElMessage.info('已重做')
}

const jumpToHistory = (index) => {
  if (index < 0 || index >= history.value.length) return
  
  historyIndex.value = index
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  const img = new Image()
  img.onload = () => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.drawImage(img, 0, 0)
  }
  img.src = history.value[index].imageData
}

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    uploadedImage.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      imagePreview.value = e.target.result
      drawImageToCanvas(e.target.result)
    }
    reader.readAsDataURL(file)
  }
}

const drawImageToCanvas = (imageSrc) => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  const img = new Image()
  
  img.onload = () => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    const imgRatio = img.width / img.height
    const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT
    
    let drawWidth, drawHeight, offsetX, offsetY
    
    if (imgRatio > canvasRatio) {
      drawWidth = CANVAS_WIDTH
      drawHeight = CANVAS_WIDTH / imgRatio
      offsetX = 0
      offsetY = (CANVAS_HEIGHT - drawHeight) / 2
    } else {
      drawHeight = CANVAS_HEIGHT
      drawWidth = CANVAS_HEIGHT * imgRatio
      offsetX = (CANVAS_WIDTH - drawWidth) / 2
      offsetY = 0
    }
    
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
    saveToHistory()
  }
  
  img.src = imageSrc
}

const initCanvas = () => {
  const canvas = canvasRef.value
  if (canvas) {
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    saveToHistory()
  }
}

const startDrawing = (e) => {
  isDrawing.value = true
  draw(e)
}

const draw = (e) => {
  if (!isDrawing.value) return
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  const rect = canvas.getBoundingClientRect()
  const scaleX = CANVAS_WIDTH / rect.width
  const scaleY = CANVAS_HEIGHT / rect.height
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY

  ctx.beginPath()
  ctx.arc(x, y, brushSize.value, 0, Math.PI * 2)
  ctx.fillStyle = brushColor.value
  ctx.fill()
}

const stopDrawing = () => {
  if (isDrawing.value) {
    isDrawing.value = false
    saveToHistory()
  }
}

const clearCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  imagePreview.value = null
  uploadedImage.value = null
  saveToHistory()
  ElMessage.success('画布已清空')
}

const selectPalette = (palette) => {
  currentPalette.value = palette
  brushColor.value = palette.colors[0]
  ElMessage.success(`已应用「${palette.name}」配色方案`)
}

const selectColor = (color) => {
  brushColor.value = color
}

const savePattern = async () => {
  if (!patternName.value) {
    ElMessage.warning('请输入纹样名称')
    return
  }

  isUploading.value = true
  try {
    const canvas = canvasRef.value
    if (!canvas) throw new Error('画布未初始化')
    
    const imageData = canvas.toDataURL('image/png', 0.9)
    
    const patternData = {
      name: patternName.value,
      tags: patternTags.value.split(',').map(t => t.trim()).filter(t => t),
      description: patternDescription.value,
      imageData: imageData,
      userId: 1,
      authorName: '当前用户',
      colorPalette: currentPalette.value?.name || ''
    }

    await patternApi.create(patternData)
    ElMessage.success('纹样保存成功！')
    
    patternName.value = ''
    patternTags.value = ''
    patternDescription.value = ''
    currentPalette.value = null
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    isUploading.value = false
  }
}

const exportPattern = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const link = document.createElement('a')
  link.download = `${patternName.value || 'pattern'}.png`
  link.href = canvas.toDataURL('image/png', 0.9)
  link.click()
  ElMessage.success('纹样已导出')
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

onMounted(() => {
  initCanvas()
})

watch(brushColor, () => {
  harmonyFilter.value = 'all'
})
</script>

<template>
  <div class="studio-page">
    <div class="page-header">
      <h1 class="page-title">脸谱纹样采集操作台</h1>
      <p class="page-desc">专业脸谱纹样设计工具，支持色彩推荐与历史回溯</p>
    </div>

    <div class="studio-content">
      <div class="canvas-section card">
        <div class="section-header">
          <h3>绘制区域</h3>
          <div class="header-tools">
            <button 
              class="tool-btn" 
              :class="{ active: showColorPanel }"
              @click="showColorPanel = !showColorPanel"
            >
              🎨 色彩推荐
            </button>
            <button 
              class="tool-btn"
              :class="{ active: showHistoryPanel }"
              @click="showHistoryPanel = !showHistoryPanel"
            >
              📜 历史记录
            </button>
            <button 
              class="tool-btn" 
              :class="{ disabled: !canUndo }"
              @click="undo"
              title="撤销 (Ctrl+Z)"
            >
              ↩️ 撤销
            </button>
            <button 
              class="tool-btn" 
              :class="{ disabled: !canRedo }"
              @click="redo"
              title="重做 (Ctrl+Y)"
            >
              ↪️ 重做
            </button>
          </div>
        </div>

        <div class="canvas-tools">
          <div class="tool-group">
            <label>画笔大小:</label>
            <input type="range" v-model="brushSize" min="1" max="50" class="size-slider">
            <span class="size-value">{{ brushSize }}px</span>
          </div>
          <div class="tool-group">
            <label>当前颜色:</label>
            <div class="current-color" :style="{ backgroundColor: brushColor }"></div>
            <input type="color" v-model="brushColor" class="color-picker-input">
          </div>
          <button class="btn-secondary" @click="clearCanvas">清空画布</button>
        </div>

        <div class="canvas-wrapper">
          <canvas
            ref="canvasRef"
            :width="CANVAS_WIDTH"
            :height="CANVAS_HEIGHT"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
          ></canvas>
        </div>

        <div class="upload-section">
          <label class="upload-btn btn-secondary">
            <span>📁 上传底图</span>
            <input type="file" accept="image/*" hidden @change="handleFileUpload">
          </label>
          <div v-if="imagePreview" class="preview-thumb">
            <img :src="imagePreview" alt="preview">
          </div>
        </div>
      </div>

      <div class="sidebar">
        <div class="info-section card">
          <div class="section-header">
            <h3>纹样信息</h3>
          </div>
          <div class="form-group">
            <label>纹样名称 *</label>
            <input
              v-model="patternName"
              type="text"
              class="input-field"
              placeholder="请输入纹样名称"
            >
          </div>
          <div class="form-group">
            <label>标签 (逗号分隔)</label>
            <input
              v-model="patternTags"
              type="text"
              class="input-field"
              placeholder="例如: 京剧, 关羽, 红脸"
            >
          </div>
          <div class="form-group">
            <label>纹样描述</label>
            <textarea
              v-model="patternDescription"
              class="input-field textarea"
              rows="4"
              placeholder="请描述这个脸谱纹样的特点..."
            ></textarea>
          </div>
          <div class="action-buttons">
            <button class="btn-primary" @click="savePattern" :disabled="isUploading">
              {{ isUploading ? '保存中...' : '💾 保存纹样' }}
            </button>
            <button class="btn-secondary" @click="exportPattern">
              📥 导出图片
            </button>
          </div>
        </div>

        <div v-if="showColorPanel" class="color-panel card">
          <div class="section-header">
            <h3>🎨 色彩搭配推荐</h3>
          </div>
          
          <div class="harmony-section">
            <h4>色彩和谐</h4>
            <div class="harmony-groups">
              <div v-for="group in harmonyColors" :key="group.name" class="harmony-group">
                <span class="harmony-name">{{ group.name }}</span>
                <div class="harmony-colors">
                  <div 
                    v-for="color in group.colors" 
                    :key="color"
                    class="color-swatch"
                    :style="{ backgroundColor: color }"
                    @click="selectColor(color)"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div class="palette-section">
            <h4>传统脸谱配色方案</h4>
            <div class="palette-list">
              <div 
                v-for="palette in recommendedPalettes" 
                :key="palette.name"
                class="palette-item"
                :class="{ active: currentPalette?.name === palette.name }"
                @click="selectPalette(palette)"
              >
                <div class="palette-name">{{ palette.name }}</div>
                <div class="palette-desc">{{ palette.description }}</div>
                <div class="palette-colors">
                  <div 
                    v-for="color in palette.colors" 
                    :key="color"
                    class="color-dot"
                    :style="{ backgroundColor: color }"
                  ></div>
                </div>
                <div class="palette-tags">
                  <span v-for="tag in palette.tags" :key="tag" class="tag-sm">{{ tag }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="showHistoryPanel" class="history-panel card">
          <div class="section-header">
            <h3>📜 历史记录</h3>
            <span class="history-count">{{ history.length }} 条记录</span>
          </div>
          <div class="history-list">
            <div 
              v-for="(item, index) in history.slice().reverse()" 
              :key="item.timestamp"
              class="history-item"
              :class="{ active: index === history.length - 1 - historyIndex }"
              @click="jumpToHistory(history.length - 1 - index)"
            >
              <div class="history-thumb">
                <img :src="item.imageData" alt="history">
              </div>
              <div class="history-info">
                <span class="history-time">{{ formatTime(item.timestamp) }}</span>
                <span class="history-desc">{{ item.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.studio-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
}

.page-header {
  margin-bottom: 30px;
}

.page-title {
  font-size: 32px;
  color: white;
  margin-bottom: 8px;
}

.page-desc {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.studio-content {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.section-header h3 {
  color: white;
  font-size: 18px;
  margin: 0;
}

.header-tools {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tool-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.tool-btn:hover,
.tool-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.tool-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.canvas-section {
  padding: 24px;
}

.canvas-tools {
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

.size-slider {
  width: 80px;
}

.size-value {
  min-width: 40px;
  color: white;
}

.current-color {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid white;
  cursor: pointer;
}

.color-picker-input {
  width: 40px;
  height: 32px;
  padding: 0;
  border: none;
  cursor: pointer;
  background: transparent;
}

.canvas-wrapper {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

#drawCanvas {
  border: 2px solid var(--border-color);
  border-radius: 12px;
  cursor: crosshair;
  background: white;
  max-width: 100%;
}

.upload-section {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.upload-btn {
  display: inline-block;
  cursor: pointer;
}

.preview-thumb img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-section {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  margin-bottom: 8px;
}

.form-group .input-field {
  width: 100%;
}

.textarea {
  resize: vertical;
  min-height: 100px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

.action-buttons button {
  width: 100%;
}

.action-buttons button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.color-panel,
.history-panel {
  padding: 20px;
  max-height: 500px;
  overflow-y: auto;
}

.harmony-section h4,
.palette-section h4 {
  color: white;
  font-size: 15px;
  margin: 0 0 12px 0;
}

.harmony-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.harmony-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.harmony-name {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  min-width: 60px;
}

.harmony-colors {
  display: flex;
  gap: 6px;
  flex: 1;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.2s, border-color 0.2s;
}

.color-swatch:hover {
  transform: scale(1.1);
  border-color: white;
}

.palette-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.palette-item {
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.palette-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.palette-item.active {
  border-color: var(--primary-color);
  background: rgba(233, 69, 96, 0.1);
}

.palette-name {
  color: white;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.palette-desc {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin-bottom: 8px;
}

.palette-colors {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.color-dot {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.palette-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag-sm {
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 10px;
  font-size: 11px;
}

.history-count {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.history-item.active {
  border-color: var(--primary-color);
}

.history-thumb img {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.history-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.history-time {
  color: white;
  font-size: 13px;
  font-weight: 500;
}

.history-desc {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

@media (max-width: 768px) {
  .studio-page {
    padding: 0 10px;
  }

  .studio-content {
    grid-template-columns: 1fr;
  }

  .page-title {
    font-size: 24px;
  }

  .canvas-tools {
    gap: 10px;
  }

  .header-tools {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }

  .sidebar {
    order: 2;
  }
}
</style>
