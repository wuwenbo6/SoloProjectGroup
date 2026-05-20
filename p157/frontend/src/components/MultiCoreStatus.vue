<template>
  <div class="multi-core-status">
    <el-card>
      <template #header>
        <div class="card-header">
          <span><el-icon><Cpu /></el-icon> 多核状态</span>
          <div class="header-actions">
            <el-switch 
              v-model="multiCoreEnabled" 
              @change="toggleMultiCore"
              active-text="SMP 模式"
              inactive-text="单核模式"
              size="small"
            />
            <el-select 
              v-model="selectedCoreCount" 
              size="small" 
              style="width: 100px; margin-left: 10px;"
              :disabled="!multiCoreEnabled"
              @change="changeCoreCount"
            >
              <el-option :label="2 + ' 核心'" :value="2" />
              <el-option :label="4 + ' 核心'" :value="4" />
            </el-select>
          </div>
        </div>
      </template>

      <div class="cores-grid">
        <div 
          v-for="core in coreStates" 
          :key="core.coreId"
          class="core-card"
          :class="{ 'core-active': isCoreActive(core) }"
        >
          <div class="core-header">
            <el-tag size="small" :type="getCoreType(core)">
              Core {{ core.coreId }}
            </el-tag>
            <el-tag size="small" type="info" v-if="core.currentTask">
              Task {{ core.currentTask }}
            </el-tag>
            <el-tag size="small" v-else type="info">
              IDLE
            </el-tag>
          </div>

          <div class="core-info">
            <div class="info-row">
              <span class="label">PC:</span>
              <span class="value mono">0x{{ core.pc.toString(16).padStart(8, '0').toUpperCase() }}</span>
            </div>
            <div class="info-row">
              <span class="label">周期:</span>
              <span class="value mono">{{ core.cycles.toLocaleString() }}</span>
            </div>
            <div class="info-row">
              <span class="label">功耗:</span>
              <span class="value mono">{{ core.power.toFixed(1) }} mW</span>
            </div>
          </div>

          <div class="core-visual">
            <div class="activity-bar">
              <div 
                class="activity-fill"
                :style="{ width: getActivityWidth(core) + '%' }"
                :class="getActivityClass(core)"
              ></div>
            </div>
            <span class="activity-label">{{ getActivityText(core) }}</span>
          </div>
        </div>
      </div>

      <el-divider />

      <div class="core-summary">
        <div class="summary-item">
          <el-statistic title="活跃核心" :value="activeCoreCount" />
        </div>
        <div class="summary-item">
          <el-statistic title="总周期数" :value="totalCycles" />
        </div>
        <div class="summary-item">
          <el-statistic title="任务数" :value="taskCount" />
        </div>
        <div class="summary-item">
          <el-statistic title="负载均衡" :value="loadBalanceScore" suffix="%">
            <template #suffix>
              <span class="balance-suffix">{{ loadBalanceScore.toFixed(0) }}%</span>
            </template>
          </el-statistic>
        </div>
      </div>

      <el-divider v-if="multiCoreEnabled" />

      <div v-if="multiCoreEnabled" class="affinity-section">
        <div class="section-title">任务亲和性</div>
        <div class="affinity-table">
          <div class="affinity-header">
            <span class="task-col">任务</span>
            <span class="core-col" v-for="i in coreCount" :key="i">Core {{ i - 1 }}</span>
          </div>
          <div 
            v-for="task in tasksWithAffinity" 
            :key="task.id"
            class="affinity-row"
          >
            <span class="task-col">{{ task.name }}</span>
            <span class="core-col" v-for="i in coreCount" :key="i">
              <el-icon 
                :class="{ 'check-icon': task.affinity & (1 << (i - 1)) }"
                size="14"
              >
                <Check v-if="task.affinity & (1 << (i - 1))" />
                <Close v-else />
              </el-icon>
            </span>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Cpu, Check, Close } from '@element-plus/icons-vue'
import { useSimulatorStore } from '@/stores/simulator'

const simulatorStore = useSimulatorStore()

const multiCoreEnabled = ref(simulatorStore.useMultiCore)
const selectedCoreCount = ref(simulatorStore.coreCount)

const coreStates = computed(() => {
  if (simulatorStore.useMultiCore && simulatorStore.coreStates.length > 0) {
    return simulatorStore.coreStates
  }
  return [{
    coreId: 0,
    pc: simulatorStore.registers[15] || 0,
    cycles: simulatorStore.cycles,
    currentTask: simulatorStore.tasks.find(t => t.state === 'RUNNING')?.id || null,
    powerState: 'run',
    power: simulatorStore.powerStats.corePowers?.[0] || 0
  }]
})

const coreCount = computed(() => coreStates.value.length)
const activeCoreCount = computed(() => coreStates.value.filter(c => isCoreActive(c)).length)
const totalCycles = computed(() => coreStates.value.reduce((sum, c) => sum + c.cycles, 0))
const taskCount = computed(() => simulatorStore.tasks.length)

const loadBalanceScore = computed(() => {
  if (coreCount.value <= 1) return 100
  const loads = coreStates.value.map(c => c.cycles || 0)
  const avg = loads.reduce((a, b) => a + b, 0) / loads.length
  if (avg === 0) return 100
  const variance = loads.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / loads.length
  const stdDev = Math.sqrt(variance)
  return Math.max(0, 100 - (stdDev / avg) * 50)
})

const tasksWithAffinity = computed(() => {
  return simulatorStore.tasks.map(t => ({
    id: t.id,
    name: t.name,
    affinity: t.affinity || 0b11
  }))
})

function isCoreActive(core) {
  return core.currentTask !== null
}

function getCoreType(core) {
  if (core.powerState === 'run' || isCoreActive(core)) return 'danger'
  if (core.powerState === 'wfi') return 'info'
  return 'success'
}

function getActivityWidth(core) {
  if (!isCoreActive(core)) return 5
  return Math.min(100, ((core.power || 50) / 150) * 100)
}

function getActivityClass(core) {
  if (!isCoreActive(core)) return 'activity-idle'
  if ((core.power || 0) > 100) return 'activity-high'
  return 'activity-normal'
}

function getActivityText(core) {
  if (!isCoreActive(core)) return '空闲'
  if ((core.power || 0) > 100) return '高负载'
  return '运行中'
}

function toggleMultiCore(enabled) {
  simulatorStore.toggleMultiCore(enabled)
}

function changeCoreCount(count) {
  simulatorStore.coreCount = count
  simulatorStore.init()
}

watch(() => simulatorStore.useMultiCore, (val) => {
  multiCoreEnabled.value = val
})
</script>

<style scoped>
.multi-core-status {
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

.cores-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.core-card {
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  background: #fafafa;
  transition: all 0.3s;
}

.core-card.core-active {
  border-color: #409eff;
  background: linear-gradient(135deg, #ecf5ff 0%, #d9ecff 100%);
}

.core-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.core-info {
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.info-row .label {
  font-size: 12px;
  color: #909399;
}

.info-row .value {
  font-size: 12px;
  font-weight: 500;
  color: #303133;
}

.mono {
  font-family: monospace;
}

.core-visual {
  display: flex;
  align-items: center;
  gap: 8px;
}

.activity-bar {
  flex: 1;
  height: 8px;
  background: #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
}

.activity-fill {
  height: 100%;
  transition: width 0.3s;
  border-radius: 4px;
}

.activity-fill.activity-normal {
  background: #67c23a;
}

.activity-fill.activity-high {
  background: #f56c6c;
}

.activity-fill.activity-idle {
  background: #909399;
}

.activity-label {
  font-size: 11px;
  color: #606266;
  min-width: 50px;
  text-align: right;
}

.core-summary {
  display: flex;
  justify-content: space-around;
  padding: 10px 0;
}

.summary-item {
  text-align: center;
}

.balance-suffix {
  font-size: 14px;
  color: #606266;
}

.affinity-section {
  margin-top: 5px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.affinity-table {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}

.affinity-header,
.affinity-row {
  display: flex;
  align-items: center;
}

.affinity-header {
  background: #f5f7fa;
  font-weight: 600;
  border-bottom: 1px solid #e4e7ed;
}

.affinity-row {
  border-bottom: 1px solid #f0f0f0;
}

.affinity-row:last-child {
  border-bottom: none;
}

.task-col {
  flex: 1;
  padding: 8px 12px;
  font-size: 12px;
  border-right: 1px solid #e4e7ed;
}

.core-col {
  width: 70px;
  text-align: center;
  padding: 8px;
  font-size: 12px;
  border-right: 1px solid #f0f0f0;
}

.core-col:last-child {
  border-right: none;
}

.check-icon {
  color: #67c23a;
}

.core-col .el-icon:not(.check-icon) {
  color: #c0c4cc;
}
</style>
