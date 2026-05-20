<template>
  <div class="dashboard">
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon size="32" color="#38bdf8"><Monitor /></el-icon>
          <h1>竹编缺陷检测监控操作台</h1>
        </div>
        <div class="header-right">
          <el-tag :type="detectionStatus ? 'success' : 'danger'" size="large">
            {{ detectionStatus ? '检测中' : '已停止' }}
          </el-tag>
          <el-button :type="detectionStatus ? 'danger' : 'success'" @click="toggleDetection">
            {{ detectionStatus ? '停止检测' : '开始检测' }}
          </el-button>
          <el-menu mode="horizontal" :default-active="activeMenu" class="nav-menu" @select="handleMenuSelect">
            <el-menu-item index="dashboard">实时监控</el-menu-item>
            <el-menu-item index="history">历史数据</el-menu-item>
            <el-menu-item index="settings">参数设置</el-menu-item>
          </el-menu>
        </div>
      </el-header>
      
      <el-main class="main-content">
        <el-row :gutter="20">
          <el-col :span="16">
            <el-card class="detection-card">
              <template #header>
                <div class="card-header">
                  <el-icon><Picture /></el-icon>
                  <span>实时检测画面</span>
                  <div class="header-actions">
                    <el-button size="small" @click="zoomIn">
                      <el-icon><ZoomIn /></el-icon>
                    </el-button>
                    <el-button size="small" @click="zoomOut">
                      <el-icon><ZoomOut /></el-icon>
                    </el-button>
                    <el-button size="small" @click="resetZoom">
                      <el-icon><Refresh /></el-icon>
                    </el-button>
                  </div>
                </div>
              </template>
              <div class="detection-image-container">
                <div 
                  class="detection-image" 
                  :style="{ transform: `scale(${zoomLevel})` }"
                  @mousemove="handleMouseMove"
                  @mouseleave="handleMouseLeave"
                >
                  <div class="image-placeholder">
                    <el-icon size="80" color="#475569"><Camera /></el-icon>
                    <p>实时检测画面</p>
                    <div class="bamboo-pattern"></div>
                  </div>
                  <div 
                    v-for="defect in currentDefects" 
                    :key="defect.id"
                    class="defect-marker"
                    :class="{ 'active': selectedDefect?.id === defect.id }"
                    :style="{
                      left: defect.positionX + '%',
                      top: defect.positionY + '%',
                      borderColor: getDefectColor(defect.level)
                    }"
                    @mouseenter="showDefectDetail(defect)"
                    @mouseleave="hideDefectDetail"
                    @click="selectDefect(defect)"
                  >
                    <div class="defect-label" :class="'level-' + defect.level">
                      {{ getDefectLevelText(defect.level) }}
                    </div>
                    <div class="defect-pulse" :style="{ backgroundColor: getDefectColor(defect.level) }"></div>
                  </div>
                </div>
                <div v-if="hoverDefect" class="defect-detail">
                  <h4>{{ hoverDefect.type }}</h4>
                  <el-tag :type="getLevelTagType(hoverDefect.level)" size="small" style="margin-bottom: 10px;">
                    {{ getDefectLevelText(hoverDefect.level) }}
                  </el-tag>
                  <p>位置: ({{ hoverDefect.positionX.toFixed(1) }}%, {{ hoverDefect.positionY.toFixed(1) }}%)</p>
                  <p>置信度: {{ (hoverDefect.confidence * 100).toFixed(1) }}%</p>
                  <p>尺寸: {{ hoverDefect.size }}mm</p>
                  <p v-if="hoverDefect.severityScore">严重度: {{ hoverDefect.severityScore }}</p>
                  <p v-if="hoverDefect.description" class="defect-description">{{ hoverDefect.description }}</p>
                  <el-button size="small" type="primary" @click="selectDefect(hoverDefect)" style="margin-top: 10px;">
                    查看详情
                  </el-button>
                </div>
              </div>
            </el-card>
          </el-col>
          
          <el-col :span="8">
            <el-card class="stats-card">
              <template #header>
                <div class="card-header">
                  <el-icon><DataAnalysis /></el-icon>
                  <span>检测统计</span>
                </div>
              </template>
              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-value total">{{ statistics.totalCount || 0 }}</div>
                  <div class="stat-label">总检测数</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value pass">{{ statistics.passCount || 0 }}</div>
                  <div class="stat-label">合格数</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value warning">{{ statistics.warningCount || 0 }}</div>
                  <div class="stat-label">预警数</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value error">{{ statistics.defectCount || 0 }}</div>
                  <div class="stat-label">缺陷数</div>
                </div>
              </div>
              <div class="pass-rate">
                <span>合格率</span>
                <el-progress 
                  :percentage="statistics.passRate || 0" 
                  :color="getProgressColor(statistics.passRate)"
                  :stroke-width="20"
                />
              </div>
            </el-card>

            <el-card class="alert-stats-card" style="margin-top: 20px;">
              <template #header>
                <div class="card-header">
                  <el-icon><Bell /></el-icon>
                  <span>参数异常告警</span>
                  <el-badge :value="alertStatistics.unhandledAlerts || 0" :hidden="!alertStatistics.unhandledAlerts" class="alert-badge" />
                </div>
              </template>
              <div class="alert-stats">
                <div class="alert-stat-item serious">
                  <span class="alert-count">{{ alertStatistics.seriousAlerts || 0 }}</span>
                  <span class="alert-label">严重告警</span>
                </div>
                <div class="alert-stat-item warning">
                  <span class="alert-count">{{ alertStatistics.warningAlerts || 0 }}</span>
                  <span class="alert-label">警告告警</span>
                </div>
                <div class="alert-stat-item notice">
                  <span class="alert-count">{{ alertStatistics.noticeAlerts || 0 }}</span>
                  <span class="alert-label">注意告警</span>
                </div>
              </div>
              <el-button type="primary" size="small" @click="showAlerts = true" style="width: 100%; margin-top: 10px;">
                查看全部告警
              </el-button>
            </el-card>

            <el-card class="process-card" style="margin-top: 20px;">
              <template #header>
                <div class="card-header">
                  <el-icon><Setting /></el-icon>
                  <span>工艺参数</span>
                </div>
              </template>
              <div class="process-params">
                <div class="param-item">
                  <span class="param-label">检测速度</span>
                  <span class="param-value">{{ processParams.speed }} 件/分钟</span>
                </div>
                <div class="param-item">
                  <span class="param-label">检测精度</span>
                  <span class="param-value">{{ processParams.precision }} mm</span>
                </div>
                <div class="param-item">
                  <span class="param-label">亮度阈值</span>
                  <span class="param-value">{{ processParams.brightness }}</span>
                </div>
                <div class="param-item">
                  <span class="param-label">对比度</span>
                  <span class="param-value">{{ processParams.contrast }}</span>
                </div>
                <div class="param-item">
                  <span class="param-label">运行模式</span>
                  <el-tag :type="processParams.mode === 'auto' ? 'success' : 'info'">
                    {{ processParams.mode === 'auto' ? '自动' : '手动' }}
                  </el-tag>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="20" style="margin-top: 20px;">
          <el-col :span="24">
            <el-card class="defect-list-card">
              <template #header>
                <div class="card-header">
                  <el-icon><Warning /></el-icon>
                  <span>近期缺陷记录</span>
                </div>
              </template>
              <el-table :data="recentDefects" stripe style="width: 100%" max-height="250">
                <el-table-column prop="timestamp" label="检测时间" width="180">
                  <template #default="{ row }">
                    {{ formatTime(row.timestamp) }}
                  </template>
                </el-table-column>
                <el-table-column prop="type" label="缺陷类型" />
                <el-table-column prop="level" label="等级" width="100">
                  <template #default="{ row }">
                    <el-tag :type="getLevelTagType(row.level)" size="small">
                      {{ getDefectLevelText(row.level) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="positionX" label="位置X" width="100">
                  <template #default="{ row }">
                    {{ row.positionX.toFixed(2) }}%
                  </template>
                </el-table-column>
                <el-table-column prop="positionY" label="位置Y" width="100">
                  <template #default="{ row }">
                    {{ row.positionY.toFixed(2) }}%
                  </template>
                </el-table-column>
                <el-table-column prop="confidence" label="置信度" width="100">
                  <template #default="{ row }">
                    {{ (row.confidence * 100).toFixed(1) }}%
                  </template>
                </el-table-column>
                <el-table-column prop="size" label="尺寸(mm)" width="100" />
                <el-table-column label="处理状态" width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.handled ? 'success' : 'warning'" size="small">
                      {{ row.handled ? '已处理' : '待处理' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="20" style="margin-top: 20px;">
          <el-col :span="12">
            <el-card>
              <template #header>
                <div class="card-header">
                  <el-icon><TrendCharts /></el-icon>
                  <span>缺陷趋势（近7天）</span>
                </div>
              </template>
              <div ref="trendChartRef" class="chart-container"></div>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card>
              <template #header>
                <div class="card-header">
                  <el-icon><PieChart /></el-icon>
                  <span>缺陷类型分布</span>
                </div>
              </template>
              <div ref="typeChartRef" class="chart-container"></div>
            </el-card>
          </el-col>
        </el-row>
      </el-main>
    </el-container>

    <el-dialog v-model="showDefectDetail" title="缺陷详情" width="600px">
      <div v-if="selectedDefect" class="defect-detail-dialog">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="缺陷类型">{{ selectedDefect.type }}</el-descriptions-item>
          <el-descriptions-item label="严重程度">
            <el-tag :type="getLevelTagType(selectedDefect.level)" size="small">
              {{ getDefectLevelText(selectedDefect.level) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="严重度评分">{{ selectedDefect.severityScore || '-' }}</el-descriptions-item>
          <el-descriptions-item label="置信度">{{ (selectedDefect.confidence * 100).toFixed(1) }}%</el-descriptions-item>
          <el-descriptions-item label="位置X">{{ selectedDefect.positionX.toFixed(2) }}%</el-descriptions-item>
          <el-descriptions-item label="位置Y">{{ selectedDefect.positionY.toFixed(2) }}%</el-descriptions-item>
          <el-descriptions-item label="尺寸">{{ selectedDefect.size }} mm</el-descriptions-item>
          <el-descriptions-item label="检测时间">{{ formatTime(selectedDefect.timestamp) }}</el-descriptions-item>
        </el-descriptions>
        <div class="defect-location-preview" style="margin-top: 20px;">
          <h4>位置预览</h4>
          <div class="location-preview">
            <div 
              class="preview-marker"
              :style="{
                left: selectedDefect.positionX + '%',
                top: selectedDefect.positionY + '%',
                backgroundColor: getDefectColor(selectedDefect.level)
              }"
            ></div>
          </div>
        </div>
        <div v-if="selectedDefect.description" class="defect-description" style="margin-top: 20px;">
          <h4>缺陷描述</h4>
          <p>{{ selectedDefect.description }}</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="showDefectDetail = false">关闭</el-button>
        <el-button type="primary" @click="handleDefect(selectedDefect)">标记已处理</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showAlerts" title="参数异常告警" width="700px">
      <div class="alert-list">
        <el-table :data="activeAlerts" stripe style="width: 100%" max-height="400">
          <el-table-column prop="timestamp" label="告警时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.timestamp) }}
            </template>
          </el-table-column>
          <el-table-column prop="paramType" label="参数类型" width="100">
            <template #default="{ row }">
              <el-tag :type="getAlertTypeTag(row.paramType)" size="small">
                {{ translateParamType(row.paramType) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="paramName" label="参数名称" width="120">
            <template #default="{ row }">
              {{ translateParamName(row.paramName) }}
            </template>
          </el-table-column>
          <el-table-column prop="currentValue" label="当前值" width="100" />
          <el-table-column prop="alertType" label="告警类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.alertType === 'LOW' ? 'warning' : 'danger'" size="small">
                {{ row.alertType === 'LOW' ? '低于阈值' : '高于阈值' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="level" label="告警级别" width="100">
            <template #default="{ row }">
              <el-tag :type="getAlertLevelTag(row.level)" size="small">
                {{ row.level === 'serious' ? '严重' : row.level === 'warning' ? '警告' : '注意' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="handleAlert(row.id)" v-if="!row.handled">
                处理
              </el-button>
              <el-tag v-else type="success" size="small">已处理</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { detectionApi, processApi, alertApi, exportApi } from '../api'
import wsClient from '../utils/websocket'
import { ElMessage } from 'element-plus'

const router = useRouter()
const activeMenu = ref('dashboard')
const detectionStatus = ref(false)
const statistics = shallowRef({})
const processParams = shallowRef({
  speed: 60,
  precision: 0.1,
  brightness: 80,
  contrast: 50,
  mode: 'auto'
})
const currentDefects = shallowRef([])
const recentDefects = shallowRef([])
const hoverDefect = ref(null)
const trendChartRef = ref(null)
const typeChartRef = ref(null)
let trendChart = null
let typeChart = null

let messageBuffer = []
let bufferTimer = null
let lastStatsUpdate = 0
let isStatsUpdating = false

const zoomLevel = ref(1)
const selectedDefect = ref(null)
const showDefectDetail = ref(false)
const showAlerts = ref(false)
const alertStatistics = shallowRef({})
const activeAlerts = shallowRef([])

const defectIdMap = computed(() => {
  const map = new Map()
  currentDefects.value.forEach((d, i) => map.set(d.id || i, d))
  return map
})

const debounce = (fn, delay) => {
  let timer = null
  return (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

const throttle = (fn, threshold) => {
  let last = 0
  return (...args) => {
    const now = Date.now()
    if (now - last > threshold) {
      last = now
      fn(...args)
    }
  }
}

const handleMenuSelect = (index) => {
  router.push('/' + index)
}

const toggleDetection = async () => {
  try {
    if (detectionStatus.value) {
      await detectionApi.stopDetection()
      detectionStatus.value = false
      ElMessage.success('检测已停止')
    } else {
      await detectionApi.startDetection()
      detectionStatus.value = true
      ElMessage.success('检测已开始')
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const zoomIn = () => {
  if (zoomLevel.value < 3) {
    zoomLevel.value += 0.25
  }
}

const zoomOut = () => {
  if (zoomLevel.value > 0.5) {
    zoomLevel.value -= 0.25
  }
}

const resetZoom = () => {
  zoomLevel.value = 1
}

const handleMouseMove = (e) => {
}

const handleMouseLeave = () => {
}

const selectDefect = (defect) => {
  selectedDefect.value = defect
  showDefectDetail.value = true
}

const showDefectDetailPopup = (defect) => {
  hoverDefect.value = defect
}

const hideDefectDetailPopup = () => {
  hoverDefect.value = null
}

const handleDefect = async (defect) => {
  ElMessage.success('缺陷已标记为已处理')
  showDefectDetail.value = false
}

const getDefectColor = (level) => {
  const colors = { 1: '#22c55e', 2: '#fbbf24', 3: '#ef4444' }
  return colors[level] || '#94a3b8'
}

const getDefectLevelText = (level) => {
  const texts = { 1: '轻微', 2: '一般', 3: '严重' }
  return texts[level] || '未知'
}

const getLevelTagType = (level) => {
  const types = { 1: 'success', 2: 'warning', 3: 'danger' }
  return types[level] || 'info'
}

const getProgressColor = (rate) => {
  if (rate >= 95) return '#22c55e'
  if (rate >= 85) return '#fbbf24'
  return '#ef4444'
}

const showDefectDetail = (defect) => {
  hoverDefect.value = defect
}

const hideDefectDetail = () => {
  hoverDefect.value = null
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString('zh-CN')
}

const getAlertTypeTag = (paramType) => {
  const types = { detection: 'primary', camera: 'success', alert: 'warning' }
  return types[paramType] || 'info'
}

const getAlertLevelTag = (level) => {
  const levels = { serious: 'danger', warning: 'warning', notice: 'info' }
  return levels[level] || 'info'
}

const translateParamType = (type) => {
  const translations = { detection: '检测参数', camera: '相机参数', alert: '预警配置' }
  return translations[type] || type
}

const translateParamName = (name) => {
  const translations = {
    speed: '检测速度',
    precision: '检测精度',
    confidenceThreshold: '置信度阈值',
    brightness: '亮度',
    contrast: '对比度',
    saturation: '饱和度',
    sharpness: '锐度',
    consecutiveThreshold: '连续缺陷阈值'
  }
  return translations[name] || name
}

const handleAlert = async (alertId) => {
  try {
    await alertApi.handleAlert(alertId, { operator: '管理员', remark: '' })
    ElMessage.success('告警已处理')
    loadAlertStatistics()
    loadActiveAlerts()
  } catch (error) {
    ElMessage.error('处理失败')
  }
}

const loadStatistics = async (force = false) => {
  const now = Date.now()
  if (!force && now - lastStatsUpdate < 2000 && isStatsUpdating) {
    return
  }
  
  isStatsUpdating = true
  try {
    const res = await detectionApi.getStatistics()
    statistics.value = res.data || {}
    lastStatsUpdate = now
  } catch (error) {
    console.error('Load statistics error:', error)
  } finally {
    isStatsUpdating = false
  }
}

const loadProcessParams = async () => {
  try {
    const res = await processApi.getParams()
    processParams.value = res.data || processParams.value
  } catch (error) {
    console.error('Load process params error:', error)
  }
}

const loadDefects = async () => {
  try {
    const res = await detectionApi.getDefectList({ pageSize: 10 })
    recentDefects.value = res.data?.list || []
  } catch (error) {
    console.error('Load defects error:', error)
  }
}

const initCharts = () => {
  if (trendChartRef.value) {
    trendChart = echarts.init(trendChartRef.value, null, { renderer: 'canvas' })
    const trendOption = {
      tooltip: { trigger: 'axis' },
      legend: { data: ['缺陷数', '检测数'], textStyle: { color: '#94a3b8' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8' }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } }
      },
      series: [
        {
          name: '缺陷数',
          type: 'line',
          data: [12, 19, 15, 22, 18, 8, 5],
          lineStyle: { color: '#ef4444' },
          itemStyle: { color: '#ef4444' },
          sampling: 'lttb',
          animationDuration: 300
        },
        {
          name: '检测数',
          type: 'line',
          data: [150, 180, 165, 190, 175, 120, 90],
          lineStyle: { color: '#38bdf8' },
          itemStyle: { color: '#38bdf8' },
          sampling: 'lttb',
          animationDuration: 300
        }
      ],
      animation: false
    }
    trendChart.setOption(trendOption)
  }

  if (typeChartRef.value) {
    typeChart = echarts.init(typeChartRef.value, null, { renderer: 'canvas' })
    const typeOption = {
      tooltip: { trigger: 'item' },
      legend: {
        orient: 'vertical',
        left: 'left',
        textStyle: { color: '#94a3b8' }
      },
      series: [
        {
          name: '缺陷类型',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: '#1e293b', borderWidth: 2 },
          label: { show: false, position: 'center' },
          emphasis: {
            label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#fff' }
          },
          labelLine: { show: false },
          data: [
            { value: 35, name: '断丝', itemStyle: { color: '#ef4444' } },
            { value: 25, name: '错位', itemStyle: { color: '#fbbf24' } },
            { value: 20, name: '漏织', itemStyle: { color: '#38bdf8' } },
            { value: 15, name: '污渍', itemStyle: { color: '#a855f7' } },
            { value: 5, name: '其他', itemStyle: { color: '#64748b' } }
          ],
          animation: false
        }
      ]
    }
    typeChart.setOption(typeOption)
  }
}

const processBufferedMessages = () => {
  if (messageBuffer.length === 0) return

  const latestMessage = messageBuffer[messageBuffer.length - 1]
  messageBuffer = []

  if (latestMessage.type === 'detection_result') {
    const defects = latestMessage.defects || []
    
    if (defects.length > 0) {
      currentDefects.value = defects
      
      const existingIds = new Set(recentDefects.value.map(d => d.id))
      const newDefects = defects.filter(d => d.id && !existingIds.has(d.id))
      if (newDefects.length > 0) {
        recentDefects.value = [...newDefects, ...recentDefects.value].slice(0, 10)
      }
    } else {
      currentDefects.value = []
    }
    
    loadStatistics()
  }
}

const debouncedProcess = debounce(processBufferedMessages, 50)

const handleWebSocketMessage = (data) => {
  if (data.type === 'ping') return

  messageBuffer.push(data)
  
  if (bufferTimer) {
    clearTimeout(bufferTimer)
  }
  
  bufferTimer = setTimeout(() => {
    requestAnimationFrame(() => {
      debouncedProcess()
    })
  }, 30)
}

const loadAlertStatistics = async () => {
  try {
    const res = await alertApi.getStatistics()
    alertStatistics.value = res.data || {}
  } catch (error) {
    console.error('Load alert statistics error:', error)
  }
}

const loadActiveAlerts = async () => {
  try {
    const res = await alertApi.getAlerts()
    activeAlerts.value = res.data?.data || []
  } catch (error) {
    console.error('Load active alerts error:', error)
  }
}

const throttledStatsUpdate = throttle(() => loadStatistics(true), 3000)
const throttledAlertUpdate = throttle(() => loadAlertStatistics(), 10000)

const handleResize = () => {
  requestAnimationFrame(() => {
    trendChart?.resize()
    typeChart?.resize()
  })
}

onMounted(() => {
  loadStatistics(true)
  loadProcessParams()
  loadDefects()
  loadAlertStatistics()
  loadActiveAlerts()
  initCharts()
  
  wsClient.connect()
  wsClient.on('message', handleWebSocketMessage)
  wsClient.on('connected', () => {
    ElMessage.success('实时连接已建立')
    loadStatistics(true)
  })

  window.addEventListener('resize', handleResize)
  
  const statsInterval = setInterval(throttledStatsUpdate, 5000)
  const alertInterval = setInterval(throttledAlertUpdate, 10000)
})

onUnmounted(() => {
  wsClient.off('message', handleWebSocketMessage)
  if (bufferTimer) {
    clearTimeout(bufferTimer)
  }
  messageBuffer = []
  trendChart?.dispose()
  typeChart?.dispose()
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped lang="scss">
.dashboard {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: rgba(30, 41, 59, 0.95);
  border-bottom: 1px solid rgba(71, 85, 105, 0.5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    h1 {
      font-size: 20px;
      color: #38bdf8;
      margin: 0;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
}

.nav-menu {
  background: transparent;
  border: none;

  :deep(.el-menu-item) {
    color: #94a3b8;

    &.is-active {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
    }

    &:hover {
      background: rgba(56, 189, 248, 0.05);
      color: #38bdf8;
    }
  }
}

.main-content {
  background: #0f172a;
  overflow-y: auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detection-card {
  height: 100%;
}

.detection-image-container {
  position: relative;
}

.detection-image {
  width: 100%;
  height: 350px;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  .image-placeholder {
    text-align: center;
    color: #64748b;

    p {
      margin-top: 12px;
    }
  }
}

.defect-marker {
  position: absolute;
  width: 40px;
  height: 40px;
  border: 2px solid;
  border-radius: 4px;
  transform: translate(-50%, -50%);
  cursor: pointer;
  animation: pulse 2s infinite;

  .defect-label {
    position: absolute;
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 6px;
    font-size: 10px;
    border-radius: 3px;
    white-space: nowrap;

    &.level-1 {
      background: rgba(34, 197, 94, 0.9);
      color: #fff;
    }

    &.level-2 {
      background: rgba(251, 191, 36, 0.9);
      color: #000;
    }

    &.level-3 {
      background: rgba(239, 68, 68, 0.9);
      color: #fff;
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.defect-detail {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(30, 41, 59, 0.95);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(71, 85, 105, 0.5);

  h4 {
    color: #ef4444;
    margin-bottom: 8px;
  }

  p {
    margin: 4px 0;
    color: #94a3b8;
    font-size: 12px;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 4px;

  &.total {
    color: #38bdf8;
  }

  &.pass {
    color: #22c55e;
  }

  &.warning {
    color: #fbbf24;
  }

  &.error {
    color: #ef4444;
  }
}

.stat-label {
  color: #64748b;
  font-size: 14px;
}

.pass-rate {
  padding: 0 8px;

  span {
    display: block;
    margin-bottom: 8px;
    color: #94a3b8;
  }
}

.process-params {
  .param-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid rgba(71, 85, 105, 0.3);

    &:last-child {
      border-bottom: none;
    }
  }

  .param-label {
    color: #94a3b8;
  }

  .param-value {
    color: #e2e8f0;
    font-weight: 500;
  }
}

.chart-container {
  height: 280px;
  width: 100%;
}
</style>
