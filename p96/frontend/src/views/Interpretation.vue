<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-title">文字释读</div>
      <div class="header-actions">
        <el-button @click="$router.push('/collection')">返回</el-button>
        <el-button @click="$router.push('/comparison')">对比页面</el-button>
      </div>
    </div>
    <div class="page-content">
      <el-row :gutter="20" style="height: 100%;">
        <el-col :span="18" style="height: 100%;">
          <div class="canvas-container">
            <div class="toolbar">
              <el-button size="small" type="primary" @click="startOCR" :loading="ocrLoading">
                <el-icon><Search /></el-icon>
                文字识别
              </el-button>
              <el-button size="small" @click="toggleDrawMode" :type="isDrawing ? 'success' : ''">
                {{ isDrawing ? '绘制中' : '开始标注' }}
              </el-button>
              <el-button size="small" @click="clearSelection">取消选择</el-button>
              <el-button size="small" type="success" @click="saveAnnotations">
                <el-icon><Document /></el-icon>
                保存标注
              </el-button>
              <el-button size="small" @click="showEnhancePanel = !showEnhancePanel" :type="showEnhancePanel ? 'warning' : ''">
                图像增强
              </el-button>
              <el-dropdown @command="handleExport">
                <el-button size="small" type="info">
                  导出
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="csv">CSV (Excel)</el-dropdown-item>
                    <el-dropdown-item command="json">JSON</el-dropdown-item>
                    <el-dropdown-item command="txt">TXT 文本</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div v-if="showEnhancePanel" class="enhance-panel">
              <div class="enhance-presets">
                <el-button
                  v-for="(preset, key) in presets"
                  :key="key"
                  size="small"
                  @click="applyPreset(key)"
                  :type="currentPreset === key ? 'primary' : ''"
                >
                  {{ presetNames[key] }}
                </el-button>
              </div>
              <div class="enhance-sliders">
                <el-slider v-model="enhanceParams.brightness" :min="-100" :max="100" show-input label="亮度" />
                <el-slider v-model="enhanceParams.contrast" :min="-100" :max="100" show-input label="对比度" />
                <el-slider v-model="enhanceParams.sharpness" :min="0" :max="2" :step="0.1" show-input label="锐度" />
                <el-slider v-model="enhanceParams.threshold" :min="0" :max="255" show-input label="二值化" />
                <el-slider v-model="enhanceParams.denoise" :min="0" :max="5" :step="0.5" show-input label="降噪" />
              </div>
              <div class="enhance-actions">
                <el-button size="small" @click="resetEnhance">重置</el-button>
                <el-button size="small" type="primary" @click="applyEnhance">应用效果</el-button>
              </div>
            </div>
            <div class="canvas-area" v-loading="loading">
              <div v-if="!rubbing" class="empty-tip">
                <el-empty description="拓片加载失败" />
              </div>
              <div v-else ref="imageContainer" class="image-container" @mouseup="handleMouseUp" @mousemove="handleMouseMove" @mousedown="handleMouseDown">
                <img ref="imageRef" :src="rubbing.imageUrl" class="rubbing-image" @load="onImageLoad" />
                <div
                  v-for="(ann, index) in annotations"
                  :key="ann.id || index"
                  class="annotation-box"
                  :class="{ selected: selectedAnnotation?.id === ann.id }"
                  :style="getAnnotationStyle(ann)"
                  @click.stop="selectAnnotation(ann)"
                >
                  <div class="annotation-text">{{ ann.text }}</div>
                  <div v-if="ann.confidence" class="confidence-badge">
                    {{ Math.round(ann.confidence * 100) }}%
                  </div>
                </div>
                <div
                  v-if="isDrawing && drawingBox"
                  class="drawing-box"
                  :style="getDrawingBoxStyle()"
                />
              </div>
            </div>
          </div>
        </el-col>
        <el-col :span="6" style="height: 100%;">
          <div class="sidebar">
            <h3 style="margin-bottom: 16px;">标注列表</h3>
            <el-list border style="max-height: 400px; overflow: auto; margin-bottom: 20px;">
              <el-list-item
                v-for="(ann, index) in annotations"
                :key="ann.id || index"
                @click="selectAnnotation(ann)"
                style="cursor: pointer;"
                :class="{ 'is-active': selectedAnnotation?.id === ann.id }"
              >
                <div style="font-size: 14px;">
                  <div style="font-weight: 500;">{{ ann.text || '未命名' }}</div>
                  <div style="font-size: 12px; color: #909399;">
                    位置: ({{ Math.round(ann.x) }}, {{ Math.round(ann.y) }})
                  </div>
                </div>
              </el-list-item>
            </el-list>
            <div v-if="selectedAnnotation" style="margin-top: 20px;">
              <h4>编辑标注</h4>
              <el-form label-width="60px">
                <el-form-item label="文字">
                  <el-input v-model="selectedAnnotation.text" type="textarea" :rows="2">
                    <template #append>
                      <el-button @click="lookupWord(selectedAnnotation.text)" :loading="lookupLoading" size="small">查</el-button>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item label="位置">
                  <el-input-number v-model="selectedAnnotation.x" :precision="0" size="small" style="width: 100px; margin-right: 10px;" />
                  <el-input-number v-model="selectedAnnotation.y" :precision="0" size="small" style="width: 100px;" />
                </el-form-item>
                <el-form-item label="大小">
                  <el-input-number v-model="selectedAnnotation.width" :precision="0" size="small" style="width: 100px; margin-right: 10px;" />
                  <el-input-number v-model="selectedAnnotation.height" :precision="0" size="small" style="width: 100px;" />
                </el-form-item>
                <el-form-item>
                  <el-button size="small" type="danger" @click="deleteAnnotation">删除</el-button>
                </el-form-item>
              </el-form>
            </div>
            <div style="margin-top: 20px;">
              <h4>文字释义查询</h4>
              <el-input v-model="searchWord" placeholder="输入要查询的字" clearable style="margin-bottom: 10px;">
                <template #append>
                  <el-button @click="searchDictionary" :loading="lookupLoading">查询</el-button>
                </template>
              </el-input>
              <div v-if="dictionaryResult" class="dictionary-card">
                <div class="dict-header">
                  <span class="dict-character">{{ dictionaryResult.character }}</span>
                  <span class="dict-pinyin">[{{ dictionaryResult.pinyin }}]</span>
                </div>
                <div class="dict-info">
                  <div class="dict-item">
                    <span class="label">部首：</span>
                    <span>{{ dictionaryResult.radical }}</span>
                  </div>
                  <div class="dict-item">
                    <span class="label">笔画：</span>
                    <span>{{ dictionaryResult.strokeCount }}</span>
                  </div>
                  <div v-if="dictionaryResult.traditional" class="dict-item">
                    <span class="label">繁体：</span>
                    <span>{{ dictionaryResult.traditional }}</span>
                  </div>
                </div>
                <div class="dict-definition">
                  <div class="label">释义：</div>
                  <p>{{ dictionaryResult.definition }}</p>
                </div>
                <div v-if="dictionaryResult.examples" class="dict-examples">
                  <div class="label">例词：</div>
                  <p>{{ dictionaryResult.examples }}</p>
                </div>
              </div>
              <div v-else-if="searchWord && !lookupLoading" class="empty-dict">
                <el-empty description="未找到该字的释义" :image-size="80" />
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Document, ArrowDown } from '@element-plus/icons-vue'
import { rubbingApi, interpretationApi, dictionaryApi } from '@/api'
import type { Rubbing, Annotation } from '@/types'
import { enhanceImage, createPresets, presetNames, type EnhanceParams } from '@/utils/imageEnhancer'
import { exportToCSV, exportToJSON, exportToTXT } from '@/utils/exporter'

const route = useRoute()
const loading = ref(false)
const ocrLoading = ref(false)
const rubbing = ref<Rubbing | null>(null)
const originalImageUrl = ref<string>('')
const annotations = ref<Annotation[]>([])
const selectedAnnotation = ref<Annotation | null>(null)
const imageContainer = ref<HTMLElement>()
const imageRef = ref<HTMLImageElement>()
const isDrawing = ref(false)
const drawingBox = ref<{ startX: number; startY: number; endX: number; endY: number } | null>(null)
const imageDisplayInfo = ref({ width: 0, height: 0, offsetX: 0, offsetY: 0 })

const showEnhancePanel = ref(false)
const presets = createPresets()
const currentPreset = ref('original')
const enhanceParams = reactive<EnhanceParams>({
  brightness: 0,
  contrast: 0,
  sharpness: 0,
  threshold: 0,
  denoise: 0
})

const searchWord = ref('')
const lookupLoading = ref(false)
const dictionaryResult = ref<any>(null)

const rubbingId = computed(() => Number(route.params.id))

const relativeToAbsolute = (relX: number, relY: number, relW: number, relH: number) => {
  const info = imageDisplayInfo.value
  return {
    x: relX * info.width + info.offsetX,
    y: relY * info.height + info.offsetY,
    width: relW * info.width,
    height: relH * info.height
  }
}

const absoluteToRelative = (absX: number, absY: number, absW: number, absH: number) => {
  const info = imageDisplayInfo.value
  return {
    x: (absX - info.offsetX) / info.width,
    y: (absY - info.offsetY) / info.height,
    width: absW / info.width,
    height: absH / info.height
  }
}

const updateImageDisplayInfo = () => {
  if (!imageRef.value || !imageContainer.value) return
  
  const containerRect = imageContainer.value.getBoundingClientRect()
  const img = imageRef.value
  
  const containerWidth = containerRect.width - 40
  const containerHeight = containerRect.height - 40
  
  const scale = Math.min(containerWidth / img.naturalWidth, containerHeight / img.naturalHeight)
  
  const displayWidth = img.naturalWidth * scale
  const displayHeight = img.naturalHeight * scale
  
  imageDisplayInfo.value = {
    width: displayWidth,
    height: displayHeight,
    offsetX: (containerWidth - displayWidth) / 2 + 20,
    offsetY: (containerHeight - displayHeight) / 2 + 20
  }
}

const loadRubbing = async () => {
  loading.value = true
  try {
    const res: any = await rubbingApi.getById(rubbingId.value)
    rubbing.value = res
    originalImageUrl.value = res.imageUrl
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const applyPreset = (key: string) => {
  currentPreset.value = key
  const preset = presets[key]
  Object.assign(enhanceParams, preset)
}

const resetEnhance = () => {
  currentPreset.value = 'original'
  Object.assign(enhanceParams, presets.original)
  if (rubbing.value && originalImageUrl.value) {
    rubbing.value.imageUrl = originalImageUrl.value
  }
}

const applyEnhance = async () => {
  if (!imageRef.value || !rubbing.value) return
  
  loading.value = true
  try {
    const img = imageRef.value
    await new Promise((resolve) => {
      if (img.complete) resolve(true)
      else img.onload = resolve
    })
    
    const enhancedUrl = enhanceImage(img, enhanceParams)
    rubbing.value.imageUrl = enhancedUrl
    
    ElMessage.success('图像增强已应用')
  } catch (error) {
    console.error(error)
    ElMessage.error('图像增强失败')
  } finally {
    loading.value = false
  }
}

const handleExport = (format: string) => {
  if (annotations.value.length === 0) {
    ElMessage.warning('没有可导出的标注数据')
    return
  }
  
  const title = rubbing.value?.title || '拓片释读记录'
  try {
    switch (format) {
      case 'csv':
        exportToCSV(annotations.value, title)
        break
      case 'json':
        exportToJSON(annotations.value, title)
        break
      case 'txt':
        exportToTXT(annotations.value, title)
        break
    }
    ElMessage.success('导出成功')
  } catch (error) {
    console.error(error)
    ElMessage.error('导出失败')
  }
}

const searchDictionary = async () => {
  if (!searchWord.value.trim()) {
    ElMessage.warning('请输入要查询的文字')
    return
  }
  
  lookupLoading.value = true
  dictionaryResult.value = null
  try {
    const result = await dictionaryApi.lookup(searchWord.value.trim().charAt(0))
    dictionaryResult.value = result
  } catch (error) {
    console.error(error)
  } finally {
    lookupLoading.value = false
  }
}

const lookupWord = async (text: string) => {
  if (!text || !text.trim()) {
    ElMessage.warning('请先输入标注文字')
    return
  }
  
  searchWord.value = text.trim().charAt(0)
  await searchDictionary()
}

const loadAnnotations = async () => {
  try {
    const res: any = await interpretationApi.getAnnotations(rubbingId.value)
    annotations.value = res || []
  } catch (error) {
    console.error(error)
  }
}

const onImageLoad = () => {
  updateImageDisplayInfo()
  window.addEventListener('resize', updateImageDisplayInfo)
}

const getAnnotationStyle = (ann: Annotation) => {
  const abs = relativeToAbsolute(ann.x, ann.y, ann.width, ann.height)
  return {
    left: abs.x + 'px',
    top: abs.y + 'px',
    width: abs.width + 'px',
    height: abs.height + 'px'
  }
}

const getDrawingBoxStyle = () => {
  if (!drawingBox.value) return {}
  const box = drawingBox.value
  const relStart = absoluteToRelative(box.startX, box.startY, 0, 0)
  const relEnd = absoluteToRelative(box.endX, box.endY, 0, 0)
  const abs = relativeToAbsolute(
    Math.min(relStart.x, relEnd.x),
    Math.min(relStart.y, relEnd.y),
    Math.abs(relEnd.x - relStart.x),
    Math.abs(relEnd.y - relStart.y)
  )
  return {
    left: abs.x + 'px',
    top: abs.y + 'px',
    width: abs.width + 'px',
    height: abs.height + 'px'
  }
}

const selectAnnotation = (ann: Annotation) => {
  if (!isDrawing.value) {
    selectedAnnotation.value = ann
  }
}

const toggleDrawMode = () => {
  isDrawing.value = !isDrawing.value
  if (!isDrawing.value) {
    drawingBox.value = null
  }
}

const clearSelection = () => {
  selectedAnnotation.value = null
  isDrawing.value = false
  drawingBox.value = null
}

const handleMouseDown = (e: MouseEvent) => {
  if (!isDrawing.value || !imageContainer.value) return
  const rect = imageContainer.value.getBoundingClientRect()
  drawingBox.value = {
    startX: e.clientX - rect.left,
    startY: e.clientY - rect.top,
    endX: e.clientX - rect.left,
    endY: e.clientY - rect.top
  }
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isDrawing.value || !drawingBox.value || !imageContainer.value) return
  const rect = imageContainer.value.getBoundingClientRect()
  drawingBox.value.endX = e.clientX - rect.left
  drawingBox.value.endY = e.clientY - rect.top
}

const handleMouseUp = () => {
  if (!isDrawing.value || !drawingBox.value) return
  const box = drawingBox.value
  const relStart = absoluteToRelative(box.startX, box.startY, 0, 0)
  const relEnd = absoluteToRelative(box.endX, box.endY, 0, 0)
  
  const relX = Math.max(0, Math.min(1, Math.min(relStart.x, relEnd.x)))
  const relY = Math.max(0, Math.min(1, Math.min(relStart.y, relEnd.y)))
  const relW = Math.max(0.01, Math.abs(relEnd.x - relStart.x))
  const relH = Math.max(0.01, Math.abs(relEnd.y - relStart.y))
  
  if (relW > 0.01 && relH > 0.01) {
    const newAnnotation: Annotation = {
      rubbingId: rubbingId.value,
      userId: 1,
      x: relX,
      y: relY,
      width: relW,
      height: relH,
      text: '',
      confidence: 1.0
    }
    annotations.value.push(newAnnotation)
    selectedAnnotation.value = newAnnotation
  }
  drawingBox.value = null
  isDrawing.value = false
}

onMounted(() => {
  loadRubbing()
  loadAnnotations()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateImageDisplayInfo)
})

const startOCR = async () => {
  ocrLoading.value = true
  try {
    const res: any = await interpretationApi.recognize(rubbingId.value)
    annotations.value = res.annotations || []
    ElMessage.success('文字识别完成')
  } catch (error) {
    ElMessage.error('文字识别失败')
  } finally {
    ocrLoading.value = false
  }
}

const saveAnnotations = async () => {
  try {
    await interpretationApi.saveAnnotation({
      rubbingId: rubbingId.value,
      annotations: annotations.value
    })
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const deleteAnnotation = () => {
  if (!selectedAnnotation.value) return
  const index = annotations.value.findIndex(a => a.id === selectedAnnotation.value?.id)
  if (index > -1) {
    annotations.value.splice(index, 1)
    selectedAnnotation.value = null
  }
}
</script>

<style scoped lang="scss">
.canvas-area {
  height: calc(100% - 57px);
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

.image-container {
  position: relative;
  display: inline-block;
  min-width: 100%;
  min-height: 100%;
  padding: 20px;
}

.rubbing-image {
  max-width: 100%;
  display: block;
}

.annotation-text {
  font-size: 12px;
  color: #303133;
  padding: 2px 4px;
  background: rgba(255, 255, 255, 0.95);
  position: absolute;
  bottom: -24px;
  left: 0;
  white-space: nowrap;
  border-radius: 2px;
  border: 1px solid #dcdfe6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.confidence-badge {
  position: absolute;
  top: -18px;
  right: 0;
  font-size: 10px;
  padding: 1px 4px;
  background: #67c23a;
  color: white;
  border-radius: 2px;
}

.drawing-box {
  position: absolute;
  border: 2px dashed #409eff;
  background: rgba(64, 158, 255, 0.1);
  pointer-events: none;
  z-index: 100;
}

:deep(.el-list-item.is-active) {
  background-color: #ecf5ff !important;
  color: #409eff;
}

.enhance-panel {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 16px;
}

.enhance-presets {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.enhance-sliders {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.enhance-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.dictionary-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e4e7ed;
}

.dict-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.dict-character {
  font-size: 32px;
  font-weight: 600;
  color: #303133;
}

.dict-pinyin {
  font-size: 16px;
  color: #409eff;
}

.dict-info {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}

.dict-item {
  font-size: 13px;
  color: #606266;
}

.dict-item .label {
  color: #909399;
}

.dict-definition,
.dict-examples {
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.6;
}

.dict-definition .label,
.dict-examples .label {
  font-weight: 500;
  color: #606266;
  margin-bottom: 4px;
}

.dict-definition p,
.dict-examples p {
  margin: 0;
  color: #303133;
}

.empty-dict {
  padding: 20px 0;
  text-align: center;
}
</style>
