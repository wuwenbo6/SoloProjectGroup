<template>
  <div class="schedule-timeline">
    <el-card>
      <template #header>
        <div class="card-header">
          <span><el-icon><Timer /></el-icon> 调度时间线</span>
          <div class="header-actions">
            <el-select v-model="exportFormat" size="small" style="width: 120px; margin-right: 8px;">
              <el-option label="JSON 格式" value="json" />
              <el-option label="CSV 格式" value="csv" />
              <el-option label="Chrome Trace" value="chrome" />
            </el-select>
            <el-button type="primary" size="small" @click="downloadTimeline">
              <el-icon><Download /></el-icon> 导出
            </el-button>
          </div>
        </div>
      </template>

      <div class="timeline-controls">
        <el-slider 
          v-model="visibleRange" 
          range 
          :min="0" 
          :max="Math.max(100, maxTime)"
          :step="10"
          style="flex: 1; margin-right: 20px;"
        />
        <span class="time-display">
          {{ visibleRange[0] }} - {{ visibleRange[1] }} 周期
        </span>
      </div>

      <div class="timeline-container" ref="timelineContainer">
        <svg :width="svgWidth" :height="svgHeight" class="timeline-svg">
          <defs>
            <linearGradient id="taskGradient0" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="taskGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#f093fb;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#f5576c;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="taskGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#4facfe;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#00f2fe;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="taskGradient3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#43e97b;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#38f9d7;stop-opacity:1" />
            </linearGradient>
          </defs>

          <g v-for="(core, coreIdx) in coreCount" :key="'core-' + coreIdx" :transform="`translate(0, ${coreIdx * rowHeight + 30})`">
            <text x="5" y="20" class="core-label">Core {{ coreIdx }}</text>
            <rect 
              x="60" 
              y="5" 
              :width="timelineWidth" 
              :height="rowHeight - 10" 
              fill="#f5f7fa" 
              stroke="#e4e7ed"
              stroke-width="1"
              rx="4"
            />
            <line 
              v-for="tick in timelineTicks" 
              :key="'tick-' + coreIdx + '-' + tick"
              :x1="60 + tick.x" 
              y1="5" 
              :x2="60 + tick.x" 
              y2="rowHeight - 5"
              stroke="#dcdfe6"
              stroke-width="1"
              stroke-dasharray="2,2"
            />
            <rect
              v-for="(event, evIdx) in getCoreEvents(coreIdx)"
              :key="'event-' + coreIdx + '-' + evIdx"
              :x="60 + getEventX(event.time)"
              y="8"
              :width="getEventWidth(event)"
              :height="rowHeight - 16"
              :fill="getTaskColor(event.to)"
              rx="2"
              class="task-block"
              @mouseenter="showTooltip($event, event)"
              @mouseleave="hideTooltip"
            />
          </g>

          <g :transform="`translate(60, ${coreCount * rowHeight + 35})`">
            <text x="0" y="0" class="axis-label">{{ visibleRange[0] }}</text>
            <text :x="timelineWidth / 4" y="0" class="axis-label">{{ Math.round((visibleRange[0] + visibleRange[1]) / 4) }}</text>
            <text :x="timelineWidth / 2" y="0" class="axis-label">{{ Math.round((visibleRange[0] + visibleRange[1]) / 2) }}</text>
            <text :x="timelineWidth * 3 / 4" y="0" class="axis-label">{{ Math.round((visibleRange[0] + visibleRange[1]) * 3 / 4) }}</text>
            <text :x="timelineWidth" y="0" class="axis-label" text-anchor="end">{{ visibleRange[1] }}</text>
          </g>
        </svg>

        <div 
          v-if="tooltipVisible" 
          class="event-tooltip"
          :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
        >
          <div class="tooltip-title">任务切换</div>
          <div class="tooltip-row">
            <span class="label">时间:</span>
            <span class="value">{{ tooltipEvent?.time }} 周期</span>
          </div>
          <div class="tooltip-row">
            <span class="label">核心:</span>
            <span class="value">Core {{ tooltipEvent?.coreId }}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">切换:</span>
            <span class="value">Task {{ tooltipEvent?.from || 'IDLE' }} → Task {{ tooltipEvent?.to || 'IDLE' }}</span>
          </div>
        </div>
      </div>

      <el-divider />

      <div class="task-legend">
        <div class="legend-title">任务图例</div>
        <div class="legend-items">
          <div 
            v-for="(task, idx) in uniqueTasks" 
            :key="task"
            class="legend-item"
          >
            <span class="legend-color" :style="{ background: getTaskColor(task) }"></span>
            <span class="legend-label">Task {{ task }}</span>
            <el-tag size="small" type="info">{{ getTaskRunCount(task) }} 次</el-tag>
          </div>
        </div>
      </div>

      <el-divider />

      <div class="stats-summary">
        <div class="stat-item">
          <div class="stat-value">{{ totalSwitches }}</div>
          <div class="stat-label">总切换次数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ avgSwitchTime.toFixed(1) }}</div>
          <div class="stat-label">平均切换间隔</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ coreCount }}</div>
          <div class="stat-label">核心数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ timeline.length }}</div>
          <div class="stat-label">事件数</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Timer, Download } from '@element-plus/icons-vue'
import { useSimulatorStore } from '@/stores/simulator'

const simulatorStore = useSimulatorStore()

const exportFormat = ref('json')
const visibleRange = ref([0, 100])
const tooltipVisible = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)
const tooltipEvent = ref(null)

const timelineContainer = ref(null)
const svgWidth = 800
const rowHeight = 50
const timelineWidth = svgWidth.value - 80

const coreCount = computed(() => simulatorStore.coreCount || 2)
const timeline = computed(() => simulatorStore.scheduleTimeline || [])

const maxTime = computed(() => {
  if (timeline.value.length === 0) return 100
  return Math.max(...timeline.value.map(e => e.time))
})

const uniqueTasks = computed(() => {
  const tasks = new Set()
  for (const e of timeline.value) {
    if (e.to !== null) tasks.add(e.to)
    if (e.from !== null) tasks.add(e.from)
  }
  return Array.from(tasks).sort((a, b) => a - b)
})

const timelineTicks = computed(() => {
  const range = visibleRange.value[1] - visibleRange.value[0]
  const tickCount = 10
  const ticks = []
  for (let i = 0; i <= tickCount; i++) {
    ticks.push({ x: (i / tickCount) * timelineWidth.value })
  }
  return ticks
})

const totalSwitches = computed(() => timeline.value.length)

const avgSwitchTime = computed(() => {
  if (timeline.value.length < 2) return 0
  let total = 0
  for (let i = 1; i < timeline.value.length; i++) {
    total += timeline.value[i].time - timeline.value[i - 1].time
  }
  return total / (timeline.value.length - 1)
})

const svgHeight = computed(() => coreCount.value * rowHeight.value + 60)

function getEventX(time) {
  const range = visibleRange.value[1] - visibleRange.value[0]
  return ((time - visibleRange.value[0]) / range) * timelineWidth.value
}

function getEventWidth(event) {
  const range = visibleRange.value[1] - visibleRange.value[0]
  const nextEvent = timeline.value.find(e => e.time > event.time && e.coreId === event.coreId)
  const endTime = nextEvent ? nextEvent.time : Math.max(event.time + 10, visibleRange.value[1])
  const width = ((endTime - event.time) / range) * timelineWidth.value
  return Math.max(2, Math.min(width, timelineWidth.value))
}

function getCoreEvents(coreId) {
  return timeline.value.filter(e => 
    e.coreId === coreId && 
    e.time >= visibleRange.value[0] && 
    e.time <= visibleRange.value[1]
  )
}

function getTaskColor(taskId) {
  if (taskId === null) return '#c0c4cc'
  const colors = [
    'url(#taskGradient0)',
    'url(#taskGradient1)',
    'url(#taskGradient2)',
    'url(#taskGradient3)',
  ]
  return colors[taskId % colors.length]
}

function getTaskRunCount(taskId) {
  return timeline.value.filter(e => e.to === taskId).length
}

function showTooltip(event, timelineEvent) {
  tooltipVisible.value = true
  tooltipX.value = event.clientX - event.target.getBoundingClientRect().left + 10
  tooltipY.value = event.clientY - event.target.getBoundingClientRect().top - 60
  tooltipEvent.value = timelineEvent
}

function hideTooltip() {
  tooltipVisible.value = false
}

function downloadTimeline() {
  simulatorStore.downloadTimeline(exportFormat.value)
}
</script>

<style scoped>
.schedule-timeline {
  width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  align-items: center;
}

.timeline-controls {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 6px;
}

.time-display {
  font-size: 12px;
  color: #606266;
  font-family: monospace;
  min-width: 120px;
  text-align: right;
}

.timeline-container {
  position: relative;
  overflow: auto;
  min-height: 200px;
}

.timeline-svg {
  display: block;
}

.core-label {
  font-size: 12px;
  font-weight: 600;
  fill: #303133;
}

.task-block {
  cursor: pointer;
  transition: opacity 0.2s;
}

.task-block:hover {
  opacity: 0.8;
}

.axis-label {
  font-size: 10px;
  fill: #909399;
}

.event-tooltip {
  position: absolute;
  background: #303133;
  color: white;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 12px;
  z-index: 100;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tooltip-title {
  font-weight: 600;
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 4px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-top: 3px;
}

.tooltip-row .label {
  color: #909399;
}

.tooltip-row .value {
  font-family: monospace;
}

.task-legend {
  margin-top: 5px;
}

.legend-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.legend-label {
  font-size: 12px;
  color: #606266;
}

.stats-summary {
  display: flex;
  gap: 30px;
  justify-content: center;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #409eff;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
