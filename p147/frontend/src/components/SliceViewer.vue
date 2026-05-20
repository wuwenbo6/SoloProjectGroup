<template>
  <div class="slice-viewer">
    <div class="slice-controls">
      <el-radio-group v-model="sliceType" size="small">
        <el-radio-button label="inline">Inline</el-radio-button>
        <el-radio-button label="crossline">Crossline</el-radio-button>
        <el-radio-button label="timeslice">Time Slice</el-radio-button>
      </el-radio-group>
    </div>

    <div class="slider-control">
      <el-slider
        v-model="sliceIndex"
        :min="0"
        :max="maxIndex"
        :step="1"
        show-input
        size="small"
      />
      <span class="slice-info">Slice: {{ sliceIndex }} / {{ maxIndex }}</span>
    </div>

    <div class="canvas-container" ref="canvasRef">
      <canvas ref="canvasEl"></canvas>
      <div v-if="loading" class="loading-overlay">
        <el-icon class="is-loading"><Loading /></el-icon>
      </div>
    </div>

    <div class="colorbar-container">
      <div class="colorbar" ref="colorbarRef"></div>
      <div class="colorbar-labels">
        <span>{{ minValue?.toFixed(2) }}</span>
        <span>{{ maxValue?.toFixed(2) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useSeismicStore } from '../stores/seismic'
import * as THREE from 'three'

const props = defineProps({
  fileId: {
    type: Number,
    required: true
  }
})

const store = useSeismicStore()
const canvasRef = ref(null)
const canvasEl = ref(null)
const colorbarRef = ref(null)

const sliceType = ref('inline')
const sliceIndex = ref(0)
const maxIndex = ref(100)
const minValue = ref(0)
const maxValue = ref(0)
const loading = ref(false)

let sliceData = null
let colorMapData = null

const getMaxIndex = () => {
  if (!store.currentFile) return 100
  
  switch (sliceType.value) {
    case 'inline':
      return store.currentFile.inline_count - 1
    case 'crossline':
      return store.currentFile.crossline_count - 1
    case 'timeslice':
      return store.currentFile.sample_count - 1
    default:
      return 100
  }
}

const loadSlice = async () => {
  if (!props.fileId) return
  
  loading.value = true
  try {
    const data = await store.getSlice(props.fileId, sliceType.value, sliceIndex.value)
    sliceData = data
    
    minValue.value = Math.min(...data.data)
    maxValue.value = Math.max(...data.data)
    
    renderSlice()
  } catch (error) {
    console.error('加载切片失败:', error)
  } finally {
    loading.value = false
  }
}

const createColorMap = (value) => {
  const normalized = (value - minValue.value) / (maxValue.value - minValue.value || 1)
  
  if (normalized < 0.5) {
    const t = normalized * 2
    return {
      r: Math.floor(0),
      g: Math.floor(t * 255),
      b: Math.floor((1 - t) * 255)
    }
  } else {
    const t = (normalized - 0.5) * 2
    return {
      r: Math.floor(t * 255),
      g: Math.floor((1 - t) * 255),
      b: Math.floor(0)
    }
  }
}

const renderSlice = () => {
  if (!canvasEl.value || !sliceData) return
  
  const canvas = canvasEl.value
  const ctx = canvas.getContext('2d')
  
  const shape = sliceData.shape
  const data = sliceData.data
  
  const maxDim = Math.max(...shape)
  const scale = Math.min(canvasRef.value.clientWidth, canvasRef.value.clientHeight) / maxDim
  
  canvas.width = shape[0] * scale
  canvas.height = shape[1] * scale
  
  const imageData = ctx.createImageData(shape[0], shape[1])
  
  for (let y = 0; y < shape[1]; y++) {
    for (let x = 0; x < shape[0]; x++) {
      const value = data[y * shape[0] + x]
      const color = createColorMap(value)
      
      const idx = ((shape[1] - 1 - y) * shape[0] + x) * 4
      imageData.data[idx] = color.r
      imageData.data[idx + 1] = color.g
      imageData.data[idx + 2] = color.b
      imageData.data[idx + 3] = 255
    }
  }
  
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = shape[0]
  tempCanvas.height = shape[1]
  const tempCtx = tempCanvas.getContext('2d')
  tempCtx.putImageData(imageData, 0, 0)
  
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
}

const renderColorbar = () => {
  if (!colorbarRef.value) return
  
  const canvas = document.createElement('canvas')
  canvas.width = 20
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  
  const range = maxValue.value - minValue.value
  for (let i = 0; i < 256; i++) {
    const value = minValue.value + (range * i / 255)
    const oldMin = minValue.value
    const oldMax = maxValue.value
    minValue.value = minValue.value
    maxValue.value = maxValue.value
    
    const color = createColorMap(value)
    
    minValue.value = oldMin
    maxValue.value = oldMax
    
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`
    ctx.fillRect(0, 255 - i, 20, 1)
  }
  
  colorbarRef.value.innerHTML = ''
  colorbarRef.value.appendChild(canvas)
}

watch([sliceType, sliceIndex], () => {
  maxIndex.value = getMaxIndex()
  if (sliceIndex.value > maxIndex.value) {
    sliceIndex.value = maxIndex.value
  }
  loadSlice()
})

watch(() => props.fileId, () => {
  maxIndex.value = getMaxIndex()
  sliceIndex.value = Math.floor(maxIndex.value / 2)
  loadSlice()
}, { immediate: true })

watch([minValue, maxValue], () => {
  renderColorbar()
})
</script>

<style scoped>
.slice-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 10px;
}

.slice-controls {
  display: flex;
  justify-content: center;
}

.slider-control {
  display: flex;
  align-items: center;
  gap: 15px;
}

.slider-control .el-slider {
  flex: 1;
}

.slice-info {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}

.canvas-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f7fa;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

canvas {
  max-width: 100%;
  max-height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
}

.loading-overlay .el-icon {
  font-size: 32px;
  color: #409eff;
}

.colorbar-container {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
}

.colorbar {
  width: 20px;
  height: 256px;
  border: 1px solid #dcdfe6;
}

.colorbar-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 256px;
  font-size: 12px;
  color: #606266;
}
</style>
