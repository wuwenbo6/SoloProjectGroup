<template>
  <div class="pattern-canvas-container">
    <div class="canvas-toolbar">
      <el-button-group>
        <el-button 
          :type="currentTool === 'brush' ? 'primary' : ''" 
          @click="setTool('brush')"
          :disabled="isLocked && !hasLock"
        >
          <el-icon><Edit /></el-icon>
          画笔
        </el-button>
        <el-button 
          :type="currentTool === 'eraser' ? 'primary' : ''" 
          @click="setTool('eraser')"
          :disabled="isLocked && !hasLock"
        >
          <el-icon><Delete /></el-icon>
          橡皮擦
        </el-button>
        <el-button 
          :type="currentTool === 'picker' ? 'primary' : ''" 
          @click="setTool('picker')"
        >
          <el-icon><Pointer /></el-icon>
          取色器
        </el-button>
      </el-button-group>
      
      <el-divider direction="vertical" />
      
      <el-color-picker v-model="brushColor" show-alpha />
      
      <el-slider 
        v-model="brushSize" 
        :min="1" 
        :max="50" 
        class="size-slider"
      />
      
      <el-divider direction="vertical" />
      
      <el-button @click="clearCanvas" :disabled="isLocked && !hasLock">
        <el-icon><RefreshLeft /></el-icon>
        清除
      </el-button>
      <el-button @click="undo" :disabled="history.length === 0 || (isLocked && !hasLock)">
        <el-icon><Back /></el-icon>
        撤销
      </el-button>
      
      <el-divider direction="vertical" />
      
      <el-button type="success" @click="saveOutline" :loading="saving" :disabled="isLocked && !hasLock">
        <el-icon><Check /></el-icon>
        保存轮廓
      </el-button>
    </div>
    
    <div v-if="isLocked" class="lock-notice">
      <el-icon :size="16"><Lock /></el-icon>
      <span>当前由 {{ lockedBy }} 编辑中，您可以查看但不能修改</span>
    </div>
    
    <div v-if="hasConflict" class="conflict-notice">
      <el-icon :size="16" color="#f56c6c"><Warning /></el-icon>
      <span>检测到版本冲突，请刷新页面获取最新数据</span>
      <el-button size="small" type="danger" @click="$emit('refresh')">刷新</el-button>
    </div>
    
    <div class="canvas-wrapper" ref="canvasWrapper">
      <canvas 
        ref="backgroundCanvas" 
        class="background-canvas"
      ></canvas>
      <canvas 
        ref="drawingCanvas" 
        class="drawing-canvas"
        @mousedown="startDrawing"
        @mousemove="draw"
        @mouseup="stopDrawing"
        @mouseleave="stopDrawing"
      ></canvas>
      
      <div v-if="editorCount > 1" class="collaborator-badge">
        <el-icon><User /></el-icon>
        {{ editorCount }} 人正在编辑
      </div>
      
      <div class="remote-cursors">
        <div 
          v-for="cursor in remoteCursors" 
          :key="cursor.userId"
          class="remote-cursor"
          :style="{ left: cursor.x + 'px', top: cursor.y + 'px' }"
        >
          <span class="cursor-name">{{ cursor.userName }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import { Edit, Delete, Pointer, RefreshLeft, Back, User, Check, Lock, Warning } from '@element-plus/icons-vue'
import { io } from 'socket.io-client'
import { ElMessage } from 'element-plus'

const props = defineProps({
  imageUrl: String,
  patternId: String,
  outlineData: Array,
  initialVersion: {
    type: Number,
    default: 0
  },
  userId: {
    type: String,
    default: 'user-' + Math.random().toString(36).substr(2, 9)
  },
  userName: {
    type: String,
    default: '用户'
  }
})

const emit = defineEmits(['outline-change', 'color-picked', 'saved', 'conflict', 'refresh'])

const canvasWrapper = ref(null)
const backgroundCanvas = ref(null)
const drawingCanvas = ref(null)
let bgCtx = null
let drawCtx = null
let isDrawing = false
let lastX = 0
let lastY = 0

const currentTool = ref('brush')
const brushColor = ref('#ff0000')
const brushSize = ref(5)
const history = ref([])
const saving = ref(false)
const socket = ref(null)
const editorCount = ref(1)
const remoteCursors = ref([])
const isLocked = ref(false)
const hasLock = ref(false)
const lockedBy = ref('')
const hasConflict = ref(false)
const currentVersion = ref(props.initialVersion)

const drawingBuffer = ref([])
let bufferTimer = null

onMounted(() => {
  initCanvas()
  initSocket()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (socket.value) {
    socket.value.emit('leave-pattern', props.patternId)
    socket.value.disconnect()
  }
  window.removeEventListener('resize', handleResize)
  if (bufferTimer) clearTimeout(bufferTimer)
})

watch(() => props.imageUrl, () => {
  nextTick(() => {
    drawBackground()
  })
})

watch(() => props.outlineData, (newData) => {
  if (newData && newData.length > 0) {
    redrawFromData(newData)
  }
}, { deep: true })

watch(() => props.patternId, (newId) => {
  if (newId && socket.value) {
    socket.value.emit('join-pattern', { patternId: newId })
  }
})

const initCanvas = () => {
  const container = canvasWrapper.value
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  
  const width = rect.width
  const height = rect.height
  
  backgroundCanvas.value.width = width
  backgroundCanvas.value.height = height
  drawingCanvas.value.width = width
  drawingCanvas.value.height = height
  
  bgCtx = backgroundCanvas.value.getContext('2d')
  drawCtx = drawingCanvas.value.getContext('2d')
  
  drawCtx.lineCap = 'round'
  drawCtx.lineJoin = 'round'
  
  drawBackground()
  if (props.outlineData && props.outlineData.length > 0) {
    redrawFromData(props.outlineData)
  }
}

const handleResize = () => {
  const imageData = drawCtx.getImageData(
    0, 0, 
    drawingCanvas.value.width, 
    drawingCanvas.value.height
  )
  initCanvas()
  drawCtx.putImageData(imageData, 0, 0)
}

const drawBackground = () => {
  if (!props.imageUrl || !bgCtx) return
  
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = backgroundCanvas.value
    if (!canvas) return
    
    const scale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height
    )
    const x = (canvas.width - img.width * scale) / 2
    const y = (canvas.height - img.height * scale) / 2
    
    bgCtx.clearRect(0, 0, canvas.width, canvas.height)
    bgCtx.drawImage(img, x, y, img.width * scale, img.height * scale)
  }
  img.src = props.imageUrl
}

const initSocket = () => {
  socket.value = io({
    query: {
      userId: props.userId,
      userName: props.userName
    },
    transports: ['websocket', 'polling']
  })
  
  socket.value.on('connect', () => {
    console.log('Socket connected')
    if (props.patternId) {
      socket.value.emit('join-pattern', { patternId: props.patternId })
    }
  })
  
  socket.value.on('editor-count', (data) => {
    editorCount.value = data.count
    if (data.editors) {
      remoteCursors.value = data.editors
        .filter(e => e.userId !== props.userId)
        .map(e => ({ ...e, x: 0, y: 0 }))
    }
  })
  
  socket.value.on('lock-status', (data) => {
    isLocked.value = data.locked
    lockedBy.value = data.lockedBy || ''
  })
  
  socket.value.on('edit-locked', (data) => {
    isLocked.value = true
    lockedBy.value = data.lockedBy
  })
  
  socket.value.on('drawing', (data) => {
    if (data.drawerId !== props.userId) {
      applyRemoteStroke(data)
    }
  })
  
  socket.value.on('drawing-batch', (data) => {
    if (data.drawerId !== props.userId) {
      data.strokes.forEach(stroke => applyRemoteStroke(stroke))
    }
  })
  
  socket.value.on('outline-updated', (data) => {
    if (data.updatedBy !== props.userName) {
      currentVersion.value = data.newVersion
      if (data.outlineData) {
        redrawFromData(data.outlineData)
        ElMessage.info(`纹样已由 ${data.updatedBy} 更新`)
      }
    }
  })
  
  socket.value.on('outline-conflict', () => {
    hasConflict.value = true
    ElMessage.error('检测到版本冲突，请刷新页面后继续编辑')
  })
  
  socket.value.on('cursor-moved', (data) => {
    if (data.userId !== props.userId) {
      const cursor = remoteCursors.value.find(c => c.userId === data.userId)
      if (cursor) {
        cursor.x = data.x
        cursor.y = data.y
      }
    }
  })
}

const setTool = (tool) => {
  currentTool.value = tool
}

const getCanvasCoords = (e) => {
  if (!drawingCanvas.value) return { x: 0, y: 0 }
  const rect = drawingCanvas.value.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
}

const startDrawing = (e) => {
  if (isLocked.value && !hasLock.value) {
    ElMessage.warning('当前正在被他人编辑，请稍后再试')
    return
  }
  
  const { x, y } = getCanvasCoords(e)
  
  if (currentTool.value === 'picker') {
    pickColor(x, y)
    return
  }
  
  isDrawing = true
  lastX = x
  lastY = y
  
  saveHistory()
  
  drawCtx.beginPath()
  drawCtx.moveTo(x, y)
}

const draw = (e) => {
  if (!isDrawing) return
  
  const { x, y } = getCanvasCoords(e)
  
  drawCtx.beginPath()
  drawCtx.moveTo(lastX, lastY)
  drawCtx.lineTo(x, y)
  
  if (currentTool.value === 'eraser') {
    drawCtx.globalCompositeOperation = 'destination-out'
    drawCtx.lineWidth = brushSize.value * 2
  } else {
    drawCtx.globalCompositeOperation = 'source-over'
    drawCtx.strokeStyle = brushColor.value
    drawCtx.lineWidth = brushSize.value
  }
  
  drawCtx.stroke()
  
  const strokeData = {
    patternId: props.patternId,
    tool: currentTool.value,
    color: brushColor.value,
    size: brushSize.value,
    from: { x: lastX, y: lastY },
    to: { x, y }
  }
  
  drawingBuffer.value.push(strokeData)
  if (bufferTimer) clearTimeout(bufferTimer)
  bufferTimer = setTimeout(flushDrawingBuffer, 50)
  
  if (socket.value) {
    socket.value.emit('cursor-position', {
      patternId: props.patternId,
      x, y
    })
  }
  
  lastX = x
  lastY = y
}

const flushDrawingBuffer = () => {
  if (socket.value && drawingBuffer.value.length > 0) {
    socket.value.emit('drawing-batch', {
      patternId: props.patternId,
      strokes: drawingBuffer.value
    })
    drawingBuffer.value = []
  }
}

const stopDrawing = () => {
  if (isDrawing) {
    isDrawing = false
    emitOutlineData()
  }
}

const applyRemoteStroke = (data) => {
  if (!drawCtx) return
  
  drawCtx.beginPath()
  drawCtx.moveTo(data.from.x, data.from.y)
  drawCtx.lineTo(data.to.x, data.to.y)
  
  if (data.tool === 'eraser') {
    drawCtx.globalCompositeOperation = 'destination-out'
    drawCtx.lineWidth = data.size * 2
  } else {
    drawCtx.globalCompositeOperation = 'source-over'
    drawCtx.strokeStyle = data.color
    drawCtx.lineWidth = data.size
  }
  
  drawCtx.stroke()
  emitOutlineData()
}

const pickColor = (x, y) => {
  if (!bgCtx) return
  const pixel = bgCtx.getImageData(x, y, 1, 1).data
  const hex = rgbToHex(pixel[0], pixel[1], pixel[2])
  brushColor.value = hex
  currentTool.value = 'brush'
  
  emit('color-picked', {
    hex,
    rgb: { r: pixel[0], g: pixel[1], b: pixel[2] }
  })
}

const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

const saveHistory = () => {
  if (!drawingCanvas.value) return
  
  const imageData = drawCtx.getImageData(
    0, 0, 
    drawingCanvas.value.width, 
    drawingCanvas.value.height
  )
  history.value.push(imageData)
  if (history.value.length > 50) {
    history.value.shift()
  }
}

const undo = () => {
  if (history.value.length > 0 && drawCtx) {
    history.value.pop()
    if (history.value.length > 0) {
      const lastState = history.value[history.value.length - 1]
      drawCtx.putImageData(lastState, 0, 0)
    } else {
      drawCtx.clearRect(0, 0, drawingCanvas.value.width, drawingCanvas.value.height)
    }
    emitOutlineData()
  }
}

const clearCanvas = () => {
  if (isLocked.value && !hasLock.value) {
    ElMessage.warning('当前正在被他人编辑，请稍后再试')
    return
  }
  
  saveHistory()
  if (drawCtx && drawingCanvas.value) {
    drawCtx.clearRect(0, 0, drawingCanvas.value.width, drawingCanvas.value.height)
  }
  emitOutlineData()
}

const redrawFromData = (data) => {
  if (!drawCtx || !drawingCanvas.value) return
  
  const imageData = drawCtx.getImageData(
    0, 0, drawingCanvas.value.width, drawingCanvas.value.height
  )
  history.value.push(imageData)
  
  drawCtx.clearRect(0, 0, drawingCanvas.value.width, drawingCanvas.value.height)
  
  if (Array.isArray(data)) {
    data.forEach(stroke => {
      if (stroke.type === 'point') {
        drawCtx.beginPath()
        drawCtx.arc(stroke.x, stroke.y, stroke.size / 2, 0, Math.PI * 2)
        drawCtx.fillStyle = stroke.color
        drawCtx.fill()
      } else if (stroke.type === 'line') {
        drawCtx.beginPath()
        drawCtx.moveTo(stroke.from.x, stroke.from.y)
        drawCtx.lineTo(stroke.to.x, stroke.to.y)
        drawCtx.strokeStyle = stroke.color
        drawCtx.lineWidth = stroke.size
        drawCtx.stroke()
      }
    })
  }
}

const emitOutlineData = () => {
  const canvasData = drawingCanvas.value.toDataURL()
  emit('outline-change', { 
    imageData: canvasData,
    version: currentVersion.value
  })
}

const saveOutline = async () => {
  if (!socket.value || !props.patternId) {
    ElMessage.error('无法连接服务器')
    return
  }
  
  saving.value = true
  try {
    const imageData = drawingCanvas.value.toDataURL()
    
    socket.value.emit('save-outline', {
      patternId: props.patternId,
      outlineData: [
        { type: 'image', data: imageData }
      ],
      baseVersion: currentVersion.value
    })
    
    socket.value.once('outline-saved', (data) => {
      currentVersion.value = data.newVersion
      saving.value = false
      ElMessage.success('轮廓保存成功')
      emit('saved', { version: data.newVersion })
    })
    
    socket.value.once('outline-conflict', (data) => {
      hasConflict.value = true
      saving.value = false
      ElMessage.error(data.error || '保存冲突，请刷新后重试')
    })
  } catch (err) {
    saving.value = false
    ElMessage.error('保存失败')
  }
}

defineExpose({
  getCanvasData: () => drawingCanvas.value?.toDataURL(),
  clearCanvas,
  getCurrentVersion: () => currentVersion.value
})
</script>

<style scoped>
.pattern-canvas-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.size-slider {
  width: 120px;
  margin: 0 8px;
}

.lock-notice,
.conflict-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  margin-bottom: 12px;
  border-radius: 6px;
  font-size: 14px;
}

.lock-notice {
  background: #fff7e6;
  color: #e6a23c;
}

.conflict-notice {
  background: #fef0f0;
  color: #f56c6c;
  
  .el-button {
    margin-left: auto;
  }
}

.canvas-wrapper {
  position: relative;
  flex: 1;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  min-height: 400px;
}

.background-canvas,
.drawing-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.background-canvas {
  opacity: 0.6;
}

.drawing-canvas {
  cursor: crosshair;
}

.collaborator-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(64, 158, 255, 0.9);
  color: #fff;
  border-radius: 20px;
  font-size: 13px;
}

.remote-cursors {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.remote-cursor {
  position: absolute;
  pointer-events: none;
  z-index: 100;
  
  .cursor-name {
    position: absolute;
    left: 12px;
    top: 0;
    font-size: 11px;
    padding: 2px 6px;
    background: rgba(103, 194, 58, 0.9);
    color: #fff;
    border-radius: 3px;
    white-space: nowrap;
  }
}
</style>
