<template>
  <div class="trace-log">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>跟踪日志</span>
          <el-button size="small" type="primary" text @click="clearLog">
            清空
          </el-button>
        </div>
      </template>
      <div ref="logContainer" class="log-container">
        <div 
          v-for="(event, idx) in events" 
          :key="idx"
          class="log-entry"
          :class="getEventClass(event.type)"
        >
          <span class="log-time">[{{ event.time }}]</span>
          <el-tag size="small" class="log-type" :type="getEventTypeTag(event.type)">
            {{ getEventTypeName(event.type) }}
          </el-tag>
          <span class="log-message">{{ formatEvent(event) }}</span>
        </div>
        <el-empty v-if="events.length === 0" description="暂无日志" :image-size="40" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'

const simulatorStore = useSimulatorStore()
const logContainer = ref(null)

const events = computed(() => simulatorStore.traceEvents)

const eventTypeMap = {
  TASK_CREATE: { name: '创建任务', type: 'success' },
  TASK_SWITCH: { name: '切换', type: 'info' },
  TASK_BLOCK: { name: '阻塞', type: 'warning' },
  TASK_UNBLOCK: { name: '唤醒', type: 'success' },
  TASK_SUSPEND: { name: '挂起', type: 'info' },
  TASK_RESUME: { name: '恢复', type: 'success' },
  TASK_NOTIFY: { name: '通知', type: 'info' },
  QUEUE_CREATE: { name: '创建队列', type: 'success' },
  QUEUE_SEND: { name: '队列发送', type: 'primary' },
  QUEUE_RECEIVE: { name: '队列接收', type: 'primary' },
  SEMAPHORE_CREATE: { name: '创建信号量', type: 'success' },
  SEMAPHORE_TAKE: { name: '获取信号量', type: 'warning' },
  SEMAPHORE_GIVE: { name: '释放信号量', type: 'success' },
  PRIORITY_SET: { name: '优先级设置', type: 'info' }
}

function getEventTypeTag(type) {
  return eventTypeMap[type]?.type || 'info'
}

function getEventTypeName(type) {
  return eventTypeMap[type]?.name || type
}

function getEventClass(type) {
  return `event-${type.toLowerCase().replace(/_/g, '-')}`
}

function formatEvent(event) {
  switch (event.type) {
    case 'TASK_CREATE':
      return `Task #${event.data.taskId} "${event.data.name}" (P${event.data.priority})`
    case 'TASK_SWITCH':
      return `Task #${event.data.from} → Task #${event.data.to}`
    case 'TASK_BLOCK':
      return `Task #${event.data.taskId} 超时: ${event.data.timeout} ticks`
    case 'TASK_UNBLOCK':
      return `Task #${event.data.taskId}`
    case 'TASK_SUSPEND':
      return `Task #${event.data.taskId}`
    case 'TASK_RESUME':
      return `Task #${event.data.taskId}`
    case 'TASK_NOTIFY':
      return `Task #${event.data.taskId}, 计数: ${event.data.count}`
    case 'QUEUE_CREATE':
      return `Queue #${event.data.queueId} (${event.data.queueLength} x ${event.data.itemSize}B)`
    case 'QUEUE_SEND':
      return `Queue #${event.data.queueId}, 项目数: ${event.data.itemCount}`
    case 'QUEUE_RECEIVE':
      return `Queue #${event.data.queueId}, 项目数: ${event.data.itemCount}`
    case 'SEMAPHORE_CREATE':
      return `Sem #${event.data.semId} ${event.data.type} (max: ${event.data.maxCount})`
    case 'SEMAPHORE_TAKE':
      return `Sem #${event.data.semId}, 剩余: ${event.data.count}`
    case 'SEMAPHORE_GIVE':
      return `Sem #${event.data.semId}, 剩余: ${event.data.count}`
    case 'PRIORITY_SET':
      return `Task #${event.data.taskId}: P${event.data.oldPriority} → P${event.data.newPriority}`
    default:
      return JSON.stringify(event.data)
  }
}

function clearLog() {
  simulatorStore.traceEvents = []
}

watch(events, () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}, { deep: true })
</script>

<style scoped>
.trace-log {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-container {
  max-height: 250px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 11px;
}

.log-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-bottom: 1px solid #f0f0f0;
  line-height: 1.4;
}

.log-time {
  color: #909399;
  min-width: 60px;
  flex-shrink: 0;
}

.log-type {
  flex-shrink: 0;
  transform: scale(0.85);
  transform-origin: left center;
}

.log-message {
  color: #606266;
  word-break: break-all;
}

.event-task-create {
  background: #f0f9eb;
}

.event-task-switch {
  background: #ecf5ff;
}

.event-task-block {
  background: #fdf6ec;
}

.event-queue-send,
.event-queue-receive {
  background: #f4f4f5;
}
</style>
