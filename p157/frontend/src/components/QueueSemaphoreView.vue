<template>
  <div class="queue-semaphore-view">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="list-card">
          <template #header>
            <span>队列 (Queues)</span>
          </template>
          <div v-if="queues.length === 0" class="empty-state">
            <el-empty description="暂无队列" :image-size="60" />
          </div>
          <div v-else class="queue-list">
            <div v-for="queue in queues" :key="queue.id" class="queue-item">
              <div class="queue-header">
                <el-tag type="info" size="small">Queue #{{ queue.id }}</el-tag>
                <span class="queue-size">{{ queue.count }}/{{ queue.length }}</span>
              </div>
              <div class="queue-details">
                <span class="detail-item">项目大小: {{ queue.itemSize }}B</span>
                <span class="detail-item">等待发送: {{ queue.waitingSend }}</span>
                <span class="detail-item">等待接收: {{ queue.waitingReceive }}</span>
              </div>
              <div class="queue-visual">
                <div 
                  v-for="i in queue.length" 
                  :key="i"
                  class="queue-slot"
                  :class="{ filled: i <= queue.count }"
                >
                  <el-icon v-if="i <= queue.count" class="slot-icon">
                    <Document />
                  </el-icon>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="list-card">
          <template #header>
            <span>信号量 (Semaphores)</span>
          </template>
          <div v-if="semaphores.length === 0" class="empty-state">
            <el-empty description="暂无信号量" :image-size="60" />
          </div>
          <div v-else class="semaphore-list">
            <div v-for="sem in semaphores" :key="sem.id" class="semaphore-item">
              <div class="semaphore-header">
                <el-tag :type="sem.type === 'mutex' ? 'warning' : 'success'" size="small">
                  {{ sem.type === 'mutex' ? 'Mutex' : 'Counting' }} #{{ sem.id }}
                </el-tag>
                <span class="semaphore-count">{{ sem.count }}/{{ sem.maxCount }}</span>
              </div>
              <div class="semaphore-details">
                <span class="detail-item">等待任务: {{ sem.waiting }}</span>
                <span v-if="sem.holder" class="detail-item">持有者: Task #{{ sem.holder }}</span>
              </div>
              <div class="semaphore-progress">
                <el-progress 
                  :percentage="Math.round((sem.count / sem.maxCount) * 100)" 
                  :stroke-width="8"
                  :color="sem.count > 0 ? '#67C23A' : '#E6A23C'"
                />
              </div>
              <div class="semaphore-state">
                <el-badge :value="sem.count" :max="sem.maxCount" class="badge">
                  <el-button size="small" :type="sem.count > 0 ? 'success' : 'warning'">
                    {{ sem.count > 0 ? '可用' : '已占用' }}
                  </el-button>
                </el-badge>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { useSimulatorStore } from '@/stores/simulator'

const simulatorStore = useSimulatorStore()

const queues = computed(() => simulatorStore.queues)
const semaphores = computed(() => simulatorStore.semaphores)
</script>

<style scoped>
.queue-semaphore-view {
  width: 100%;
}

.list-card {
  height: 100%;
  min-height: 400px;
}

.empty-state {
  padding: 40px 0;
}

.queue-list,
.semaphore-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 350px;
  overflow-y: auto;
  padding-right: 8px;
}

.queue-item,
.semaphore-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
  background: #fafafa;
}

.queue-header,
.semaphore-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.queue-size,
.semaphore-count {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
}

.queue-details,
.semaphore-details {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.detail-item {
  font-size: 12px;
  color: #666;
}

.queue-visual {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.queue-slot {
  width: 28px;
  height: 28px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.queue-slot.filled {
  border-style: solid;
  border-color: #67c23a;
  background: #f0f9eb;
}

.slot-icon {
  font-size: 14px;
  color: #67c23a;
}

.semaphore-progress {
  margin-bottom: 10px;
}

.semaphore-state {
  text-align: right;
}

.badge :deep(.el-badge__content) {
  transform: translateX(20%) translateY(-50%);
}
</style>
