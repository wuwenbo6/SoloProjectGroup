<template>
  <div class="histogram-view">
    <div class="controls">
      <el-input-number
        v-model="binCount"
        :min="10"
        :max="500"
        :step="10"
        size="small"
        label="分箱数:"
      />
      <el-button type="primary" size="small" @click="loadHistogram">
        刷新
      </el-button>
    </div>

    <div class="chart-container" ref="chartRef">
      <canvas ref="canvasEl"></canvas>
      <div v-if="loading" class="loading-overlay">
        <el-icon class="is-loading"><Loading /></el-icon>
      </div>
    </div>

    <div v-if="histogramData" class="stats-panel">
      <el-card>
        <template #header>统计信息</template>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="label">最小值:</span>
            <span class="value">{{ histogramData.min_amplitude.toFixed(4) }}</span>
          </div>
          <div class="stat-item">
            <span class="label">最大值:</span>
            <span class="value">{{ histogramData.max_amplitude.toFixed(4) }}</span>
          </div>
          <div class="stat-item">
            <span class="label">分箱数:</span>
            <span class="value">{{ histogramData.bin_count }}</span>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useSeismicStore } from '../stores/seismic'

const props = defineProps({
  fileId: {
    type: Number,
    required: true
  }
})

const store = useSeismicStore()
const chartRef = ref(null)
const canvasEl = ref(null)

const binCount = ref(100)
const histogramData = ref(null)
const loading = ref(false)

const loadHistogram = async () => {
  if (!props.fileId) return
  
  loading.value = true
  try {
    await store.fetchHistogram(props.fileId, binCount.value)
    histogramData.value = store.histogram
    await nextTick()
    renderChart()
  } catch (error) {
    console.error('加载直方图失败:', error)
  } finally {
    loading.value = false
  }
}

const renderChart = () => {
  if (!canvasEl.value || !histogramData.value) return
  
  const canvas = canvasEl.value
  const ctx = canvas.getContext('2d')
  const data = histogramData.value.histogram
  const binEdges = histogramData.value.bin_edges
  
  const padding = { top: 20, right: 30, bottom: 50, left: 60 }
  const chartWidth = chartRef.value.clientWidth - padding.left - padding.right
  const chartHeight = chartRef.value.clientHeight - padding.top - padding.bottom
  
  canvas.width = chartRef.value.clientWidth
  canvas.height = chartRef.value.clientHeight
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  const maxCount = Math.max(...data)
  const barWidth = chartWidth / data.length
  const barGap = 1
  
  for (let i = 0; i < data.length; i++) {
    const barHeight = (data[i] / maxCount) * chartHeight
    const x = padding.left + i * barWidth
    const y = padding.top + chartHeight - barHeight
    
    const normalized = i / data.length
    const hue = (1 - normalized) * 0.65
    ctx.fillStyle = `hsl(${hue * 360}, 70%, 50%)`
    ctx.fillRect(x, y, barWidth - barGap, barHeight)
  }
  
  ctx.strokeStyle = '#dcdfe6'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padding.left, padding.top)
  ctx.lineTo(padding.left, padding.top + chartHeight)
  ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight)
  ctx.stroke()
  
  ctx.fillStyle = '#606266'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  
  const labelCount = 10
  for (let i = 0; i <= labelCount; i++) {
    const idx = Math.floor(i * (binEdges.length - 1) / labelCount)
    const x = padding.left + (idx / (binEdges.length - 1)) * chartWidth
    const label = binEdges[idx].toFixed(2)
    
    ctx.fillText(label, x, padding.top + chartHeight + 20)
  }
  
  ctx.textAlign = 'right'
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + chartHeight - (i / 5) * chartHeight
    const label = Math.floor((i / 5) * maxCount)
    
    ctx.fillText(label.toString(), padding.left - 10, y + 4)
  }
  
  ctx.fillStyle = '#303133'
  ctx.font = '14px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('振幅分布直方图', canvas.width / 2, 15)
}

watch(() => props.fileId, () => {
  loadHistogram()
}, { immediate: true })
</script>

<style scoped>
.histogram-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 10px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.chart-container {
  flex: 1;
  background: white;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  position: relative;
  overflow: hidden;
}

canvas {
  width: 100%;
  height: 100%;
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

.stats-panel {
  margin-top: 10px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stat-item .label {
  font-size: 12px;
  color: #909399;
}

.stat-item .value {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}
</style>
