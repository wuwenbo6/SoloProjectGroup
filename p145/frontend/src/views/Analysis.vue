<template>
  <div class="analysis">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>信号频谱分析</span>
              <el-button type="primary" size="small" @click="refreshSpectrogram">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>
          <v-chart :option="spectrogramOption" style="height: 400px" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>小波时频分析</span>
              <el-button type="primary" size="small" @click="refreshWavelet">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>
          <v-chart :option="waveletOption" style="height: 400px" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>FFT频谱分析</span>
          </template>
          <v-chart :option="fftOption" style="height: 350px" autoresize />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>时域波形</span>
          </template>
          <v-chart :option="waveformOption" style="height: 350px" autoresize />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, HeatmapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent } from 'echarts/components'
import { Refresh } from '@element-plus/icons-vue'
import axios from '../api/axios'

use([CanvasRenderer, LineChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent])

const props = defineProps({
  sensorId: {
    type: String,
    default: 'sensor_001'
  }
})

const spectrogramData = ref({
  frequencies: [],
  times: [],
  spectrogram: []
})

const waveletData = ref({
  frequencies: [],
  scales: [],
  power_db: []
})

const fftData = ref({
  frequencies: [],
  amplitudes: []
})

const waveformData = ref([])

const spectrogramOption = computed(() => {
  const data = []
  const spec = spectrogramData.value.spectrogram
  const freqs = spectrogramData.value.frequencies
  const times = spectrogramData.value.times

  if (spec && spec.length > 0) {
    for (let i = 0; i < spec.length; i++) {
      for (let j = 0; j < spec[i].length; j++) {
        data.push([j, i, spec[i][j]])
      }
    }
  }

  return {
    tooltip: {
      position: 'top',
      formatter: (params) => {
        return `时间: ${params.data[0]}<br/>频率: ${freqs[params.data[1]]?.toFixed(2) || 0} Hz<br/>功率: ${params.data[2]?.toFixed(2)} dB`
      }
    },
    grid: {
      height: '70%',
      top: '10%'
    },
    xAxis: {
      type: 'category',
      data: times.map((t, i) => i),
      name: '时间点',
      splitArea: {
        show: false
      }
    },
    yAxis: {
      type: 'category',
      data: freqs.map((f, i) => i),
      name: '频率 (Hz)',
      splitArea: {
        show: false
      }
    },
    visualMap: {
      min: -50,
      max: 50,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: {
        color: ['#0c0c0c', '#07248f', '#069fff', '#11d813', '#fafb08', '#ff5608', '#fe0000']
      }
    },
    series: [
      {
        name: '频谱',
        type: 'heatmap',
        data: data,
        label: {
          show: false
        },
        emphasis: {
          itemStyle: {
            borderColor: '#333',
            borderWidth: 1
          }
        }
      }
    ]
  }
})

const waveletOption = computed(() => {
  const data = []
  const power = waveletData.value.power_db
  const scales = waveletData.value.scales

  if (power && power.length > 0) {
    for (let i = 0; i < power.length; i++) {
      for (let j = 0; j < power[i].length; j++) {
        data.push([j, scales[i] || i, power[i][j]])
      }
    }
  }

  return {
    tooltip: {
      position: 'top',
      formatter: (params) => {
        return `时间: ${params.data[0]}<br/>尺度: ${params.data[1]}<br/>功率: ${params.data[2]?.toFixed(2)} dB`
      }
    },
    grid: {
      height: '70%',
      top: '10%'
    },
    xAxis: {
      type: 'category',
      name: '时间点',
      splitArea: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      name: '尺度',
      splitArea: {
        show: false
      }
    },
    visualMap: {
      min: -30,
      max: 30,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: {
        color: ['#00008B', '#0000FF', '#00BFFF', '#00FF00', '#FFFF00', '#FF8C00', '#FF0000']
      }
    },
    series: [
      {
        name: '小波变换',
        type: 'heatmap',
        data: data,
        label: {
          show: false
        },
        emphasis: {
          itemStyle: {
            borderColor: '#333',
            borderWidth: 1
          }
        }
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
              { offset: 0, color: 'rgba(102, 126, 234, 0.5)' },
              { offset: 1, color: 'rgba(118, 75, 162, 0.1)' }
            ]
          }
        },
        itemStyle: { color: '#667eea' }
      }
    ]
  }
})

const waveformOption = computed(() => {
  const times = waveformData.value.map(d => new Date(d.time).toLocaleTimeString())
  const vibrations = waveformData.value.map(d => d.vibration)

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
      boundaryGap: false,
      data: times
    },
    yAxis: {
      type: 'value',
      name: '振动 (mm/s)'
    },
    series: [
      {
        name: '振动',
        type: 'line',
        smooth: true,
        data: vibrations,
        itemStyle: { color: '#409eff' },
        markPoint: {
          data: waveformData.value.filter(d => d.is_anomaly).map((d, i) => ({
            coord: [times[waveformData.value.indexOf(d)], d.vibration],
            value: '异常',
            itemStyle: { color: '#f56c6c' }
          }))
        }
      }
    ]
  }
})

const refreshSpectrogram = async () => {
  try {
    const response = await axios.get(`/sensor/${props.sensorId}/spectrogram?duration=30`)
    spectrogramData.value = {
      frequencies: response.data.frequencies,
      times: response.data.times,
      spectrogram: response.data.spectrogram
    }
  } catch (error) {
    console.error('加载频谱图失败:', error)
  }
}

const refreshWavelet = async () => {
  try {
    const response = await axios.get(`/sensor/${props.sensorId}/wavelet?duration=10`)
    waveletData.value = {
      frequencies: response.data.frequencies,
      scales: response.data.scales,
      power_db: response.data.power_db
    }
  } catch (error) {
    console.error('加载小波变换失败:', error)
  }
}

const refreshFFT = async () => {
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

const refreshWaveform = async () => {
  try {
    const response = await axios.get(`/sensor/${props.sensorId}/latest?limit=200`)
    waveformData.value = response.data.data
  } catch (error) {
    console.error('加载波形数据失败:', error)
  }
}

watch(() => props.sensorId, () => {
  refreshAll()
})

const refreshAll = () => {
  refreshSpectrogram()
  refreshWavelet()
  refreshFFT()
  refreshWaveform()
}

onMounted(() => {
  refreshAll()
})
</script>

<style scoped>
.analysis {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
