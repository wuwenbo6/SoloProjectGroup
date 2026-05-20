<template>
  <div class="dashboard">
    <h2 class="page-title">监控面板</h2>
    
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon device">
              <el-icon><Monitor /></el-icon>
            </div>
            <div class="stat-info">
              <p class="stat-value">{{ statistics.totalDevices || 0 }}</p>
              <p class="stat-label">设备总数</p>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon online">
              <el-icon><Link /></el-icon>
            </div>
            <div class="stat-info">
              <p class="stat-value">{{ statistics.onlineDevices || 0 }}</p>
              <p class="stat-label">在线设备</p>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon inference">
              <el-icon><DataAnalysis /></el-icon>
            </div>
            <div class="stat-info">
              <p class="stat-value">{{ statistics.totalInferences || 0 }}</p>
              <p class="stat-label">推理总数</p>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon alert">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <p class="stat-value">{{ alertCount }}</p>
              <p class="stat-label">待处理预警</p>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>病虫害分布统计</span>
            </div>
          </template>
          <div ref="pieChartRef" class="chart"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>7日推理趋势</span>
            </div>
          </template>
          <div ref="lineChartRef" class="chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="results-row">
      <el-col :span="24">
        <el-card class="table-card">
          <template #header>
            <div class="card-header">
              <span>最新识别结果</span>
              <el-button type="primary" size="small" @click="loadResults">刷新</el-button>
            </div>
          </template>
          <el-table :data="latestResults" stripe style="width: 100%">
            <el-table-column prop="device_id" label="设备ID" width="120" />
            <el-table-column prop="pest_type" label="病虫害类型" width="120">
              <template #default="{ row }">
                <el-tag :type="getPestTagType(row.pest_type)">
                  {{ getPestName(row.pest_type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="confidence" label="置信度" width="100">
              <template #default="{ row }">
                {{ (row.confidence * 100).toFixed(1) }}%
              </template>
            </el-table-column>
            <el-table-column prop="model_type" label="模型类型" width="150" />
            <el-table-column prop="timestamp" label="时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.timestamp) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import axios from 'axios'
import { Monitor, Link, DataAnalysis, Warning } from '@element-plus/icons-vue'

const statistics = ref({})
const latestResults = ref([])
const alertCount = ref(0)
const pieChartRef = ref(null)
const lineChartRef = ref(null)
const connectionStatus = ref('connecting')
let pieChart = null
let lineChart = null
let eventSource = null
let fastPollTimer = null
let slowPollTimer = null
let lastUpdateTime = null
let pendingRequests = 0

const pestNames = {
  aphid: '蚜虫',
  whitefly: '粉虱',
  thrips: '蓟马',
  spider_mite: '红蜘蛛',
  bollworm: '棉铃虫',
  healthy: '健康',
  unknown: '未知'
}

const getPestName = (type) => pestNames[type] || type

const getPestTagType = (type) => {
  if (type === 'healthy') return 'success'
  if (type === 'unknown') return 'info'
  return 'danger'
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const throttle = (fn, delay) => {
  let lastCall = 0
  return function(...args) {
    const now = new Date().getTime()
    if (now - lastCall < delay) return
    lastCall = now
    return fn(...args)
  }
}

const loadStatistics = throttle(async () => {
  if (pendingRequests > 2) return
  pendingRequests++
  try {
    const res = await axios.get('/api/v1/statistics', { timeout: 5000 })
    statistics.value = res.data
    nextTick(() => {
      updatePieChart()
      updateLineChart()
    })
  } catch (e) {
    console.error('Failed to load statistics:', e)
  } finally {
    pendingRequests--
  }
}, 2000)

const loadDeltaResults = throttle(async () => {
  if (pendingRequests > 2) return
  pendingRequests++
  try {
    const since = lastUpdateTime ? lastUpdateTime.toISOString() : ''
    const res = await axios.get('/api/v1/results/delta', { 
      params: { since },
      timeout: 5000 
    })
    if (res.data.results && res.data.results.length > 0) {
      const newResults = res.data.results
      const existingIds = new Set(latestResults.value.map(r => r.result_id))
      const uniqueNew = newResults.filter(r => !existingIds.has(r.result_id))
      if (uniqueNew.length > 0) {
        latestResults.value = [...uniqueNew, ...latestResults.value].slice(0, 20)
        lastUpdateTime = new Date(res.data.timestamp)
      }
    }
  } catch (e) {
    console.error('Failed to load delta results:', e)
  } finally {
    pendingRequests--
  }
}, 1000)

const loadResults = async () => {
  try {
    const res = await axios.get('/api/v1/results?limit=10', { timeout: 5000 })
    latestResults.value = res.data
    lastUpdateTime = new Date()
  } catch (e) {
    console.error('Failed to load results:', e)
  }
}

const loadAlerts = throttle(async () => {
  try {
    const res = await axios.get('/api/v1/alerts?resolved=false&limit=100', { timeout: 5000 })
    alertCount.value = res.data.length
  } catch (e) {
    console.error('Failed to load alerts:', e)
  }
}, 3000)

const setupSSE = () => {
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
  const host = window.location.hostname === 'localhost' ? 'localhost:8080' : window.location.host
  const sseUrl = `${protocol}//${host}/api/v1/stream`
  
  try {
    eventSource = new EventSource(sseUrl)
    
    eventSource.onopen = () => {
      connectionStatus.value = 'connected'
      console.log('SSE connection established')
    }
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_results') {
          Promise.all([
            loadDeltaResults(),
            loadStatistics(),
            loadAlerts()
          ])
        }
      } catch (e) {
        console.error('Failed to parse SSE message:', e)
      }
    }
    
    eventSource.onerror = (e) => {
      connectionStatus.value = 'disconnected'
      console.log('SSE error, switching to polling fallback', e)
      eventSource.close()
      startFastPolling()
    }
  } catch (e) {
    console.error('Failed to setup SSE, switching to polling', e)
    connectionStatus.value = 'polling'
    startFastPolling()
  }
}

const startFastPolling = () => {
  if (fastPollTimer) clearInterval(fastPollTimer)
  if (slowPollTimer) clearInterval(slowPollTimer)
  
  let idleCount = 0
  
  fastPollTimer = setInterval(() => {
    Promise.all([
      loadDeltaResults(),
      loadStatistics(),
      loadAlerts()
    ])
    
    idleCount++
    if (idleCount > 20) {
      clearInterval(fastPollTimer)
      startSlowPolling()
    }
  }, 1500)
}

const startSlowPolling = () => {
  slowPollTimer = setInterval(() => {
    Promise.all([
      loadDeltaResults(),
      loadStatistics(),
      loadAlerts()
    ])
  }, 10000)
}

const updatePieChart = () => {
  if (!pieChart) return
  const data = Object.entries(statistics.value.pestDistribution || {}).map(([key, value]) => ({
    name: pestNames[key] || key,
    value
  }))
  
  pieChart.setOption({
    tooltip: {
      trigger: 'item'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [{
      type: 'pie',
      radius: '60%',
      data,
      animationDuration: 500,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  }, false)
}

const updateLineChart = () => {
  if (!lineChart) return
  const daily = statistics.value.dailyInferences || []
  
  lineChart.setOption({
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: daily.map(d => d.date)
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: daily.map(d => d.count),
      type: 'line',
      smooth: true,
      animationDuration: 500,
      areaStyle: {}
    }]
  }, false)
}

onMounted(() => {
  pieChart = echarts.init(pieChartRef.value)
  lineChart = echarts.init(lineChartRef.value)
  
  loadStatistics()
  loadResults()
  loadAlerts()
  
  setupSSE()
  
  onUnmounted(() => {
    if (eventSource) {
      eventSource.close()
    }
    if (fastPollTimer) {
      clearInterval(fastPollTimer)
    }
    if (slowPollTimer) {
      clearInterval(slowPollTimer)
    }
    pieChart && pieChart.dispose()
    lineChart && lineChart.dispose()
  })
})
</script>

<style scoped>
.dashboard {
  height: 100%;
}

.page-title {
  margin-bottom: 20px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border-radius: 8px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: white;
}

.stat-icon.device {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.online {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.stat-icon.inference {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.alert {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.charts-row {
  margin-bottom: 20px;
}

.chart-card {
  height: 350px;
}

.chart {
  width: 100%;
  height: 280px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}
</style>
