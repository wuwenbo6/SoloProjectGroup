<template>
  <div class="history">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>历史数据查询与回放</span>
        </div>
      </template>

      <el-form :inline="true" :model="queryForm" class="query-form">
        <el-form-item label="传感器">
          <el-select v-model="queryForm.sensorId" placeholder="选择传感器">
            <el-option label="sensor_001" value="sensor_001" />
            <el-option label="sensor_002" value="sensor_002" />
            <el-option label="sensor_003" value="sensor_003" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="queryForm.startTime"
            type="datetime"
            placeholder="选择开始时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker
            v-model="queryForm.endTime"
            type="datetime"
            placeholder="选择结束时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="queryHistory">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>数据回放控制</span>
          <div>
            <el-button-group>
              <el-button size="small" @click="startPlayback" :disabled="isPlaying">
                <el-icon><VideoPlay /></el-icon>
                播放
              </el-button>
              <el-button size="small" @click="pausePlayback" :disabled="!isPlaying">
                <el-icon><VideoPause /></el-icon>
                暂停
              </el-button>
              <el-button size="small" @click="stopPlayback">
                <el-icon><VideoStop /></el-icon>
                停止
              </el-button>
            </el-button-group>
            <el-select v-model="playbackSpeed" size="small" style="width: 100px; margin-left: 10px">
              <el-option label="0.5x" :value="0.5" />
              <el-option label="1x" :value="1" />
              <el-option label="2x" :value="2" />
              <el-option label="4x" :value="4" />
            </el-select>
          </div>
        </div>
      </template>

      <el-slider
        v-model="playbackPosition"
        :max="historyData.length - 1"
        :step="1"
        show-tooltip
        :format="formatSliderTooltip"
        @change="onSliderChange"
        style="margin-bottom: 20px"
      />

      <v-chart :option="playbackChartOption" style="height: 350px" autoresize />
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>异常段标记</span>
          <el-button type="primary" size="small" @click="openMarkDialog">
            <el-icon><Promotion /></el-icon>
            标记异常段
          </el-button>
        </div>
      </template>

      <el-table :data="markedAnomalies" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="startTime" label="开始时间" min-width="180" />
        <el-table-column prop="endTime" label="结束时间" min-width="180" />
        <el-table-column prop="anomalyScore" label="异常分数" width="120">
          <template #default="{ row }">
            <el-tag :type="row.anomalyScore > 50 ? 'danger' : 'warning'" size="small">
              {{ row.anomalyScore.toFixed(2) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" />
        <el-table-column label="操作" width="100">
          <template #default="{ row, $index }">
            <el-button type="danger" size="small" @click="deleteMark($index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>

  <el-dialog
    v-model="markDialogVisible"
    title="标记异常段"
    width="500px"
  >
    <el-form :model="markForm" label-width="100px">
      <el-form-item label="开始时间">
        <el-date-picker
          v-model="markForm.startTime"
          type="datetime"
          placeholder="选择开始时间"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="YYYY-MM-DD HH:mm:ss"
        />
      </el-form-item>
      <el-form-item label="结束时间">
        <el-date-picker
          v-model="markForm.endTime"
          type="datetime"
          placeholder="选择结束时间"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="YYYY-MM-DD HH:mm:ss"
        />
      </el-form-item>
      <el-form-item label="异常分数">
        <el-slider v-model="markForm.anomalyScore" :min="0" :max="100" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="markForm.description" type="textarea" :rows="3" placeholder="请输入异常描述" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="markDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveMark">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { Search, VideoPlay, VideoPause, VideoStop, Promotion, Delete } from '@element-plus/icons-vue'
import axios from '../api/axios'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const queryForm = ref({
  sensorId: 'sensor_001',
  startTime: '',
  endTime: ''
})

const historyData = ref([])
const playbackData = ref([])
const playbackPosition = ref(0)
const playbackSpeed = ref(1)
const isPlaying = ref(false)
let playbackInterval = null

const markDialogVisible = ref(false)
const markForm = ref({
  startTime: '',
  endTime: '',
  anomalyScore: 50,
  description: ''
})
const markedAnomalies = ref([])
let markIdCounter = 1

const playbackChartOption = computed(() => {
  const currentData = playbackData.value
  const times = currentData.map(d => new Date(d.time).toLocaleTimeString())
  const vibrations = currentData.map(d => d.vibration)
  const swings = currentData.map(d => d.swing)
  const temperatures = currentData.map(d => d.temperature)

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
        markArea: {
          silent: true,
          data: getMarkedAreas()
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

const getMarkedAreas = () => {
  const currentTimes = playbackData.value.map(d => d.time)
  const areas = []

  markedAnomalies.value.forEach(mark => {
    const startIndex = currentTimes.findIndex(t => {
      const time = new Date(t).getTime()
      const markStart = new Date(mark.startTime).getTime()
      return time >= markStart
    })
    const endIndex = currentTimes.findIndex(t => {
      const time = new Date(t).getTime()
      const markEnd = new Date(mark.endTime).getTime()
      return time > markEnd
    })

    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
      areas.push([
        { xAxis: startIndex, itemStyle: { color: 'rgba(245, 108, 108, 0.3)' } },
        { xAxis: endIndex - 1 }
      ])
    }
  })

  return areas
}

const formatSliderTooltip = (value) => {
  if (historyData.value[value]) {
    return new Date(historyData.value[value].time).toLocaleString()
  }
  return value
}

const queryHistory = async () => {
  try {
    if (!queryForm.value.startTime || !queryForm.value.endTime) {
      ElMessage.warning('请选择时间范围')
      return
    }

    const response = await axios.post('/sensor/history', {
      sensor_id: queryForm.value.sensorId,
      start_time: queryForm.value.startTime,
      end_time: queryForm.value.endTime
    })

    historyData.value = response.data.data
    playbackData.value = response.data.data.slice(0, 100)
    playbackPosition.value = 0

    if (historyData.value.length === 0) {
      ElMessage.info('没有找到数据')
    } else {
      ElMessage.success(`查询到 ${historyData.value.length} 条数据`)
    }
  } catch (error) {
    console.error('查询历史数据失败:', error)
    ElMessage.error('查询失败')
  }
}

const resetQuery = () => {
  queryForm.value = {
    sensorId: 'sensor_001',
    startTime: '',
    endTime: ''
  }
  historyData.value = []
  playbackData.value = []
  playbackPosition.value = 0
}

const startPlayback = () => {
  if (historyData.value.length === 0) {
    ElMessage.warning('没有可播放的数据')
    return
  }

  isPlaying.value = true
  playbackInterval = setInterval(() => {
    if (playbackPosition.value < historyData.value.length - 1) {
      playbackPosition.value++
      updatePlaybackData()
    } else {
      stopPlayback()
    }
  }, 100 / playbackSpeed.value)
}

const pausePlayback = () => {
  isPlaying.value = false
  if (playbackInterval) {
    clearInterval(playbackInterval)
    playbackInterval = null
  }
}

const stopPlayback = () => {
  isPlaying.value = false
  if (playbackInterval) {
    clearInterval(playbackInterval)
    playbackInterval = null
  }
  playbackPosition.value = 0
  updatePlaybackData()
}

const onSliderChange = () => {
  updatePlaybackData()
}

const updatePlaybackData = () => {
  const windowSize = 100
  const start = Math.max(0, playbackPosition.value - windowSize / 2)
  const end = Math.min(historyData.value.length, start + windowSize)
  playbackData.value = historyData.value.slice(start, end)
}

const openMarkDialog = () => {
  markForm.value = {
    startTime: '',
    endTime: '',
    anomalyScore: 50,
    description: ''
  }
  markDialogVisible.value = true
}

const saveMark = () => {
  if (!markForm.value.startTime || !markForm.value.endTime) {
    ElMessage.warning('请选择时间范围')
    return
  }

  markedAnomalies.value.push({
    id: markIdCounter++,
    ...markForm.value
  })

  markDialogVisible.value = false
  ElMessage.success('异常段标记成功')
}

const deleteMark = (index) => {
  markedAnomalies.value.splice(index, 1)
  ElMessage.success('删除成功')
}

onMounted(() => {
  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - 30 * 60 * 1000)
  queryForm.value.startTime = startTime.toISOString().slice(0, 19).replace('T', ' ')
  queryForm.value.endTime = endTime.toISOString().slice(0, 19).replace('T', ' ')
})

onUnmounted(() => {
  if (playbackInterval) {
    clearInterval(playbackInterval)
  }
})
</script>

<style scoped>
.history {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.query-form {
  margin: 0;
}
</style>
