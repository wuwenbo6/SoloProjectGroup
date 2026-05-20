<template>
  <div class="monitor-container">
    <div class="monitor-header">
      <h1>拓片采集监控操作台</h1>
      <div class="header-actions">
        <el-button type="primary" :icon="VideoPlay" @click="handleStart" :disabled="isCapturing">
          开始采集
        </el-button>
        <el-button type="danger" :icon="VideoPause" @click="handleStop" :disabled="!isCapturing">
          停止采集
        </el-button>
      </div>
    </div>

    <div class="monitor-content">
      <div class="left-panel">
        <div class="panel-card">
          <h3><el-icon><Picture /></el-icon> 实时采集预览</h3>
          <div class="image-preview">
            <img v-if="previewImage" :src="previewImage" alt="采集预览" @click="openImageViewer(previewImage)" class="clickable-preview" />
            <div v-else class="placeholder">
              <el-icon size="60"><Camera /></el-icon>
              <p>等待图像采集...</p>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <h3><el-icon><MagicStick /></el-icon> 图像增强预览</h3>
          <ImageEnhancement />
        </div>

        <div class="panel-card">
          <h3><el-icon><Reading /></el-icon> 采集日志</h3>
          <div class="log-container">
            <div v-for="log in realtimeLogs" :key="log.id" class="log-item">
              <span class="log-time">[{{ log.time }}]</span>
              <span :class="'log-type-' + log.type">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="center-panel">
        <div class="panel-card">
          <h3><el-icon><Odometer /></el-icon> 采集进度</h3>
          <div class="progress-section">
            <el-progress
              :percentage="progressPercent"
              :status="progressStatus"
              :stroke-width="20"
            />
            <div class="progress-info">
              <span>当前: {{ progress.current }}/{{ progress.total }}</span>
              <span>预计剩余: {{ progress.estimatedTime }}s</span>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <h3><el-icon><TrendCharts /></el-icon> 图像质量分析</h3>
          <div class="quality-grid">
            <div class="quality-item">
              <div class="quality-label">清晰度</div>
              <el-progress :percentage="imageQuality.sharpness" color="#409eff" />
              <div class="quality-value">{{ imageQuality.sharpness }}%</div>
            </div>
            <div class="quality-item">
              <div class="quality-label">对比度</div>
              <el-progress :percentage="imageQuality.contrast" color="#67c23a" />
              <div class="quality-value">{{ imageQuality.contrast }}%</div>
            </div>
            <div class="quality-item">
              <div class="quality-label">信噪比</div>
              <el-progress :percentage="100 - imageQuality.noise" color="#e6a23c" />
              <div class="quality-value">{{ 100 - imageQuality.noise }}%</div>
            </div>
            <div class="quality-item">
              <div class="quality-label">综合评分</div>
              <div class="quality-score">{{ imageQuality.score }}</div>
            </div>
          </div>
          <div class="resolution-info">
            <span>分辨率: {{ imageQuality.resolution.width }} x {{ imageQuality.resolution.height }}</span>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div class="panel-card">
          <h3><el-icon="Setting" /> 拓片采集参数</h3>
          <div class="params-form">
            <el-form label-width="100px">
              <el-form-item label="分辨率">
                <el-select v-model="parameters.resolution" size="small">
                  <el-option label="300 DPI" value="300 DPI" />
                  <el-option label="400 DPI" value="400 DPI" />
                  <el-option label="600 DPI" value="600 DPI" />
                  <el-option label="1200 DPI" value="1200 DPI" />
                </el-select>
              </el-form-item>
              <el-form-item label="色彩深度">
                <el-select v-model="parameters.colorDepth" size="small">
                  <el-option label="8位灰度" value="8位" />
                  <el-option label="24位彩色" value="24位" />
                  <el-option label="48位真彩" value="48位" />
                </el-select>
              </el-form-item>
              <el-form-item label="扫描模式">
                <el-select v-model="parameters.scanMode" size="small">
                  <el-option label="灰度" value="灰度" />
                  <el-option label="彩色" value="彩色" />
                  <el-option label="二值化" value="二值化" />
                </el-select>
              </el-form-item>
              <el-form-item label="亮度">
                <el-slider v-model="parameters.brightness" :min="0" :max="100" />
                <span class="param-value">{{ parameters.brightness }}</span>
              </el-form-item>
              <el-form-item label="对比度">
                <el-slider v-model="parameters.contrast" :min="0" :max="100" />
                <span class="param-value">{{ parameters.contrast }}</span>
              </el-form-item>
              <el-form-item label="阈值">
                <el-slider v-model="parameters.threshold" :min="0" :max="255" />
                <span class="param-value">{{ parameters.threshold }}</span>
              </el-form-item>
              <el-form-item label="锐化强度">
                <el-slider v-model="parameters.sharpness" :min="0" :max="100" />
                <span class="param-value">{{ parameters.sharpness }}</span>
              </el-form-item>
              <el-form-item label="去噪级别">
                <el-slider v-model="parameters.noiseLevel" :min="0" :max="10" />
                <span class="param-value">{{ parameters.noiseLevel }}</span>
              </el-form-item>
            </el-form>
            <el-button type="primary" size="small" style="width: 100%" @click="handleApplyParams">应用参数</el-button>
          </div>
        </div>

        <div class="panel-card">
          <h3><el-icon><DataAnalysis /></el-icon> 状态概览</h3>
          <div class="status-grid">
            <div class="status-item">
              <el-icon size="30" color="#409eff"><Monitor /></el-icon>
              <span class="status-label">设备状态</span>
              <span :class="'status-value status-' + deviceStatus">{{ deviceStatusText }}</span>
            </div>
            <div class="status-item">
              <el-icon size="30" color="#67c23a"><Files /></el-icon>
              <span class="status-label">今日采集</span>
              <span class="status-value">{{ todayCount }}</span>
            </div>
            <div class="status-item">
              <el-icon size="30" color="#e6a23c"><Coin /></el-icon>
              <span class="status-label">归档数量</span>
              <span class="status-value">{{ archiveCount }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-drawer v-model="showAlerts" title="参数预警通知" direction="rt" size="400px">
      <div class="alert-header">
        <el-button type="danger" size="small" @click="clearAlerts">清空全部</el-button>
      </div>
      <div class="alert-list">
        <div v-if="alerts.length === 0" class="empty-alert">
          <el-icon size="40"><CircleCheckFilled /></el-icon>
          <p>暂无预警</p>
        </div>
        <div v-for="(alert, index) in alerts" :key="index" :class="['alert-item', 'alert-' + alert.type.toLowerCase()]">
          <div class="alert-icon">
            <el-icon v-if="alert.type === 'ERROR'"><WarningFilled /></el-icon>
            <el-icon v-else><CircleCheckFilled /></el-icon>
          </div>
          <div class="alert-content">
            <div class="alert-message">{{ alert.message }}</div>
            <div class="alert-time">{{ alert.timestamp }}</div>
          </div>
        </div>
      </div>
    </el-drawer>

    <el-dialog v-model="viewerVisible" title="图像查看" width="80%" top="5vh">
      <div class="image-viewer">
        <img :src="currentViewImage" alt="查看图像" class="viewer-image" />
      </div>
      <template #footer>
        <el-button @click="viewerVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRubbingStore } from '@/stores/rubbing'
import websocket from '@/utils/websocket'
import ImageEnhancement from '@/components/ImageEnhancement.vue'
import {
  VideoPlay,
  VideoPause,
  Picture,
  Camera,
  Reading,
  Odometer,
  TrendCharts,
  Setting,
  DataAnalysis,
  Monitor,
  Files,
  Coin,
  MagicStick,
  WarningFilled,
  CircleCheckFilled
} from '@element-plus/icons-vue'

const router = useRouter()
const store = useRubbingStore()

const isCapturing = ref(false)
const previewImage = ref(null)
const deviceStatus = ref('online')
const todayCount = ref(15)
const archiveCount = ref(128)
const mockTimer = ref(null)
const wsConnected = ref(false)
const alerts = ref([])
const showAlerts = ref(false)
const viewerVisible = ref(false)
const currentViewImage = ref(null)

const { progress, imageQuality, parameters, realtimeLogs } = store

const progressPercent = computed(() => {
  return progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
})

const progressStatus = computed(() => {
  if (!isCapturing.value) return ''
  return progressPercent.value >= 100 ? 'success' : ''
})

const deviceStatusText = computed(() => {
  const map = { online: '在线', offline: '离线', busy: '忙碌' }
  return map[deviceStatus.value] || '未知'
})

const initWebSocket = async () => {
  try {
    await websocket.connect()
    wsConnected.value = true
    store.addLog({ type: 'info', message: '实时数据连接成功' })
    
    websocket.subscribe('/topic/progress', (data) => {
      store.updateProgress(data)
    })
    
    websocket.subscribe('/topic/quality', (data) => {
      store.updateImageQuality(data)
    })
    
    websocket.subscribe('/topic/logs', (data) => {
      store.addLog(data)
    })
    
    websocket.subscribe('/topic/image', (data) => {
      if (data.imageData) {
        previewImage.value = data.imageData
      }
    })
    
    websocket.subscribe('/topic/device/status', (data) => {
      deviceStatus.value = data.status
      if (data.status === 'offline') {
        store.addLog({ type: 'error', message: '设备连接断开，正在尝试重连...' })
      } else if (data.status === 'online') {
        store.addLog({ type: 'success', message: '设备连接恢复' })
      }
    })
    
    websocket.subscribe('/topic/alerts', (data) => {
      if (data.alerts) {
        data.alerts.forEach(alert => {
          alerts.value.unshift(alert)
          if (alerts.value.length > 20) {
            alerts.value.pop()
          }
        })
        showAlerts.value = true
      }
    })
  } catch (error) {
    console.error('WebSocket连接失败:', error)
    store.addLog({ type: 'warning', message: '实时数据连接失败，将使用本地模拟' })
  }
}

const handleStart = async () => {
  try {
    const res = await store.startCapture()
    isCapturing.value = true
    deviceStatus.value = 'busy'
    store.addLog({ type: 'info', message: '开始图像采集...' })
    
    if (!wsConnected.value) {
      startMockData()
    }
  } catch (error) {
    store.addLog({ type: 'error', message: '启动采集失败: ' + error.message })
  }
}

const handleStop = async () => {
  try {
    await store.stopCapture()
    isCapturing.value = false
    deviceStatus.value = 'online'
    store.addLog({ type: 'warning', message: '采集中断' })
    stopMockData()
  } catch (error) {
    store.addLog({ type: 'error', message: '停止采集失败: ' + error.message })
  }
}

const startMockData = () => {
  store.updateProgress({ current: 0, total: 100, estimatedTime: 60, status: 'SCANNING' })
  mockTimer.value = setInterval(() => {
    if (progress.current < progress.total) {
      const increment = Math.random() * 3 + 1
      store.updateProgress({
        current: Math.min(progress.current + increment, progress.total),
        estimatedTime: Math.max(0, progress.estimatedTime - 1),
        status: 'SCANNING'
      })
      
      store.updateImageQuality({
        resolution: { width: 4000 + Math.floor(Math.random() * 500), height: 6000 + Math.floor(Math.random() * 500) },
        sharpness: 85 + Math.floor(Math.random() * 15),
        contrast: 80 + Math.floor(Math.random() * 20),
        noise: 5 + Math.floor(Math.random() * 10),
        score: 88 + Math.floor(Math.random() * 12)
      })

      if (Math.random() > 0.7) {
        store.addLog({
          type: Math.random() > 0.8 ? 'warning' : 'info',
          message: `处理第 ${Math.floor(progress.current)} 帧数据`
        })
      }
    } else {
      store.updateProgress({ status: 'COMPLETED' })
      store.addLog({ type: 'success', message: '采集完成！' })
      handleStop()
    }
  }, 100)
}

const stopMockData = () => {
  if (mockTimer.value) {
    clearInterval(mockTimer.value)
    mockTimer.value = null
  }
}

const handleApplyParams = async () => {
  try {
    store.addLog({ type: 'info', message: '正在应用采集参数...' })
    await store.saveParameters(parameters.value)
    store.addLog({ type: 'success', message: '参数应用成功' })
  } catch (error) {
    store.addLog({ type: 'error', message: '参数应用失败: ' + error.message })
  }
}

onMounted(() => {
  initWebSocket()
})

const openImageViewer = (image) => {
  currentViewImage.value = image
  viewerVisible.value = true
}

const closeAlerts = () => {
  showAlerts.value = false
}

const clearAlerts = () => {
  alerts.value = []
}

watch([() => parameters.brightness, () => parameters.contrast, () => parameters.sharpness], () => {
  checkParameterThresholds()
}, { deep: true })

const checkParameterThresholds = () => {
  const warnings = []
  
  if (parameters.brightness < 20 || parameters.brightness > 80) {
    warnings.push({
      type: 'ERROR',
      param: '亮度',
      value: parameters.brightness,
      message: `亮度参数异常: ${parameters.brightness} (建议范围: 20-80)`
    })
  } else if (parameters.brightness < 30 || parameters.brightness > 70) {
    warnings.push({
      type: 'WARNING',
      param: '亮度',
      value: parameters.brightness,
      message: `亮度参数警告: ${parameters.brightness}`
    })
  }
  
  if (parameters.contrast < 20 || parameters.contrast > 80) {
    warnings.push({
      type: 'ERROR',
      param: '对比度',
      value: parameters.contrast,
      message: `对比度参数异常: ${parameters.contrast} (建议范围: 20-80)`
    })
  }
  
  if (warnings.length > 0) {
    warnings.forEach(w => {
      alerts.value.unshift({ ...w, timestamp: new Date().toLocaleTimeString() })
    })
    if (alerts.value.length > 20) {
      alerts.value.splice(20)
    }
    showAlerts.value = true
  }
}

onUnmounted(() => {
  stopMockData()
  websocket.disconnect()
})
</script>

<style scoped>
.monitor-container {
  padding: 20px;
  min-height: 100vh;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.monitor-header h1 {
  font-size: 28px;
  color: #303133;
}

.monitor-content {
  display: grid;
  grid-template-columns: 360px 1fr 320px;
  gap: 20px;
}

.panel-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.panel-card h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: #303133;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.image-preview {
  width: 100%;
  height: 280px;
  background: #f5f7fa;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.placeholder {
  text-align: center;
  color: #909399;
}

.placeholder p {
  margin-top: 12px;
}

.log-container {
  height: 200px;
  overflow-y: auto;
  font-size: 12px;
}

.log-item {
  padding: 6px 0;
  border-bottom: 1px solid #f5f7fa;
}

.log-time {
  color: #909399;
  margin-right: 8px;
}

.log-type-info {
  color: #409eff;
}

.log-type-success {
  color: #67c23a;
}

.log-type-warning {
  color: #e6a23c;
}

.log-type-error {
  color: #f56c6c;
}

.progress-section {
  padding: 10px 0;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  color: #606266;
}

.quality-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.quality-item {
  text-align: center;
}

.quality-label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
}

.quality-value {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.quality-score {
  font-size: 36px;
  font-weight: bold;
  color: #409eff;
  margin-top: 20px;
}

.resolution-info {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  text-align: center;
  color: #606266;
}

.params-form {
  font-size: 14px;
}

.param-value {
  display: inline-block;
  width: 40px;
  text-align: right;
  color: #409eff;
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-size: 14px;
  color: #909399;
}

.status-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.status-online {
  color: #67c23a;
}

.status-offline {
  color: #f56c6c;
}

.status-busy {
  color: #e6a23c;
}

.clickable-preview {
  cursor: pointer;
  transition: transform 0.2s;
}

.clickable-preview:hover {
  transform: scale(1.02);
}

.alert-header {
  padding: 0 20px 15px;
  border-bottom: 1px solid #ebeef5;
}

.alert-list {
  padding: 15px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.empty-alert {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #909399;
}

.alert-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  margin-bottom: 10px;
  border-radius: 6px;
  background: #f5f7fa;
}

.alert-error {
  background: #fef0f0;
  border-left: 3px solid #f56c6c;
}

.alert-warning {
  background: #fdf6ec;
  border-left: 3px solid #e6a23c;
}

.alert-icon {
  flex-shrink: 0;
  color: #f56c6c;
}

.alert-warning .alert-icon {
  color: #e6a23c;
}

.alert-content {
  flex: 1;
}

.alert-message {
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
}

.alert-time {
  font-size: 12px;
  color: #909399;
}

.image-viewer {
  text-align: center;
  max-height: 70vh;
  overflow: auto;
}

.viewer-image {
  max-width: 100%;
  max-height: 100%;
}
</style>
