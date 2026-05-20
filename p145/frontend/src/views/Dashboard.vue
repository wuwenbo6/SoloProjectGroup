<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon vibration">
              <el-icon><Odometer /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">振动值</div>
              <div class="stat-value">{{ latestData.vibration?.toFixed(2) || '0.00' }}</div>
              <div class="stat-unit">mm/s</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon swing">
              <el-icon><Compass /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">摆度值</div>
              <div class="stat-value">{{ latestData.swing?.toFixed(2) || '0.00' }}</div>
              <div class="stat-unit">μm</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon temperature">
              <el-icon><Thermometer /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">温度</div>
              <div class="stat-value">{{ latestData.temperature?.toFixed(1) || '0.0' }}</div>
              <div class="stat-unit">°C</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>实时数据监控</span>
              <el-tag :type="isAnomaly ? 'danger' : 'success'" size="small">
                {{ isAnomaly ? '异常状态' : '正常状态' }}
              </el-tag>
            </div>
          </template>
          <v-chart :option="chartOption" style="height: 400px" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>振动频谱分析</span>
          </template>
          <v-chart :option="fftOption" style="height: 300px" autoresize />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>信号特征</span>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="RMS">{{ features.rms?.toFixed(4) || '-' }}</el-descriptions-item>
            <el-descriptions-item label="峰值">{{ features.peak?.toFixed(4) || '-' }}</el-descriptions-item>
            <el-descriptions-item label="峰度">{{ features.kurtosis?.toFixed(4) || '-' }}</el-descriptions-item>
            <el-descriptions-item label="峰值频率">{{ features.peak_frequency?.toFixed(2) || '-' }} Hz</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { Odometer, Compass, Thermometer } from '@element-plus/icons-vue'
import axios from '../api/axios'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps({
  sensorId: {
    type: String,
    default: 'sensor_001'
  }
})

const latestData = ref({})
const dataHistory = ref([])
const features = ref({})
const isAnomaly = ref(false)
let refreshInterval = null

const chartOption = computed(() => {
  const times = dataHistory.value.map(d => new Date(d.time).toLocaleTimeString())
  const vibrations = dataHistory.value.map(d => d.vibration)
  const swings = dataHistory.value.map(d => d.swing)
  const temperatures = dataHistory.value.map(d => d.temperature)

  return {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['振动', '摆度', '温度']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: times
    },
    yAxis: [
      {
        type: 'value',
        name: '振动/摆度',
        position: 'left'
      },
      {
        type: 'value',
        name: '温度',
        position: 'right'
      }
    ],
    series: [
      {
        name: '振动',
        type: 'line',
        smooth: true,
        data: vibrations,
        itemStyle: { color: '#409eff' },
        markPoint: {
          data: dataHistory.value.filter(d => d.is_anomaly).map((d, i) => ({
            coord: [times[dataHistory.value.indexOf(d)], d.vibration],
            value: '异常',
            itemStyle: { color: '#f56c6c' }
          }))
        }
      },
      {
        name: '摆度',
        type: 'line',
        smooth: true,
        data: swings,
        itemStyle: { color: '#67c23a' }
      },
      {
        name: '温度',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: temperatures,
        itemStyle: { color: '#e6a23c' }
      }
    ]
  }
})

const fftOption = computed(() => {
  return {
    tooltip: {
      trigger: 'axis'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      name: '频率 (Hz)',
      data: fftData.value.frequencies
    },
    yAxis: {
      type: 'value',
      name: '振幅'
    },
    series: [
      {
        name: '频谱',
        type: 'line',
        smooth: true,
        data: fftData.value.amplitudes,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(64, 158, 255, 0.5)' },
              { offset: 1, color: 'rgba(64, 158, 255, 0.1)' }
            ]
          }
        },
        itemStyle: { color: '#409eff' }
      }
    ]
  }
})

const fftData = ref({
  frequencies: [],
  amplitudes: []
})

const loadLatestData = async () => {
  try {
    const response = await axios.get(`/sensor/${props.sensorId}/latest?limit=100`)
    dataHistory.value = response.data.data
    
    if (response.data.data.length > 0) {
      latestData.value = response.data.data[response.data.data.length - 1]
      isAnomaly.value = response.data.data.some(d => d.is_anomaly)
    }
  } catch (error) {
    console.error('加载最新数据失败:', error)
  }
}

const loadFFTData = async () => {
  try {
    const response = await axios.get(`/sensor/${props.sensorId}/fft?duration=10`)
    fftData.value = {
      frequencies: response.data.frequencies,
      amplitudes: response.data.amplitudes
    }
  } catch (error) {
    console.error('加载FFT数据失败:', error)
  }
}

const loadFeatures = async () => {
  try {
    const response = await axios.get(`/sensor/${props.sensorId}/features?duration=5`)
    features.value = response.data.features || {}
  } catch (error) {
    console.error('加载特征数据失败:', error)
  }
}

watch(() => props.sensorId, () => {
  dataHistory.value = []
  loadLatestData()
  loadFFTData()
  loadFeatures()
})

onMounted(() => {
  loadLatestData()
  loadFFTData()
  loadFeatures()
  
  refreshInterval = setInterval(() => {
    loadLatestData()
    loadFFTData()
    loadFeatures()
  }, 2000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.stat-card {
  height: 120px;
}

.stat-content {
  display: flex;
  align-items: center;
  height: 100%;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  font-size: 28px;
  color: #fff;
}

.stat-icon.vibration {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.swing {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.stat-icon.temperature {
  background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
}

.stat-info {
  flex: 1;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  line-height: 1;
}

.stat-unit {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
