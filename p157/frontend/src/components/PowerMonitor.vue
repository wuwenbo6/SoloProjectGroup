<template>
  <div class="power-monitor">
    <el-card>
      <template #header>
        <div class="card-header">
          <span><el-icon><Lightning /></el-icon> 功耗监控</span>
          <el-tag :type="powerLevelTag" size="small">{{ powerLevelText }}</el-tag>
        </div>
      </template>
      
      <div class="power-overview">
        <div class="power-item main-power">
          <div class="power-value">{{ currentPower.toFixed(1) }}</div>
          <div class="power-unit">mW</div>
          <div class="power-label">当前功率</div>
        </div>
        <div class="power-item">
          <div class="power-value energy-value">{{ totalEnergy.toFixed(3) }}</div>
          <div class="power-unit">mWh</div>
          <div class="power-label">累计能耗</div>
        </div>
      </div>

      <el-divider />

      <div class="core-powers">
        <div class="section-title">各核心功耗</div>
        <div v-for="(power, idx) in corePowers" :key="idx" class="core-power-item">
          <div class="core-label">
            <el-tag size="small" :type="getCoreStateType(powerStates[idx])">
              Core {{ idx }}
            </el-tag>
            <span class="state-text">{{ getStateText(powerStates[idx]) }}</span>
          </div>
          <div class="core-power-bar">
            <el-progress 
              :percentage="Math.min((power / 150) * 100, 100)" 
              :stroke-width="12"
              :color="getPowerColor(power)"
              :show-text="false"
            />
            <span class="power-text">{{ power.toFixed(1) }} mW</span>
          </div>
        </div>
      </div>

      <el-divider />

      <div class="power-breakdown">
        <div class="section-title">功耗分布</div>
        <div class="breakdown-chart">
          <div class="breakdown-item">
            <div class="breakdown-label">CPU 核心</div>
            <div class="breakdown-bar" :style="{ width: breakdown.corePercent + '%' }"></div>
            <div class="breakdown-value">{{ breakdown.core.toFixed(1) }} mW</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">内存访问</div>
            <div class="breakdown-bar memory" :style="{ width: breakdown.memoryPercent + '%' }"></div>
            <div class="breakdown-value">{{ breakdown.memory.toFixed(1) }} mW</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">外设</div>
            <div class="breakdown-bar peripheral" :style="{ width: breakdown.peripheralPercent + '%' }"></div>
            <div class="breakdown-value">{{ breakdown.peripheral.toFixed(1) }} mW</div>
          </div>
        </div>
      </div>

      <el-divider />

      <div class="power-savings">
        <div class="section-title">节能建议</div>
        <el-alert 
          v-if="idleCores > 0" 
          :title="`${idleCores} 个核心处于空闲，可进入 WFI 模式`"
          type="success"
          :closable="false"
          size="small"
          show-icon
        />
        <el-alert 
          v-else-if="highPowerCores > 0" 
          :title="`${highPowerCores} 个核心高负载，考虑任务迁移`"
          type="warning"
          :closable="false"
          size="small"
          show-icon
        />
        <el-alert 
          v-else
          title="系统功耗处于最优状态"
          type="info"
          :closable="false"
          size="small"
          show-icon
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Lightning } from '@element-plus/icons-vue'
import { useSimulatorStore } from '@/stores/simulator'

const simulatorStore = useSimulatorStore()

const currentPower = computed(() => simulatorStore.powerStats.currentPower || 0)
const totalEnergy = computed(() => simulatorStore.powerStats.totalEnergy || 0)
const corePowers = computed(() => simulatorStore.powerStats.corePowers || [])
const powerStates = computed(() => simulatorStore.powerStats.powerStates || [])
const breakdown = computed(() => {
  const bd = simulatorStore.powerStats.breakdown || { core: 0, memory: 0, peripherals: 0 }
  const total = bd.core + bd.memory + bd.peripherals || 1
  return {
    core: bd.core,
    memory: bd.memory,
    peripheral: bd.peripherals,
    corePercent: (bd.core / total) * 100,
    memoryPercent: (bd.memory / total) * 100,
    peripheralPercent: (bd.peripherals / total) * 100
  }
})

const powerLevelTag = computed(() => {
  const p = currentPower.value
  if (p > 200) return 'danger'
  if (p > 100) return 'warning'
  return 'success'
})

const powerLevelText = computed(() => {
  const p = currentPower.value
  if (p > 200) return '高功耗'
  if (p > 100) return '中功耗'
  return '低功耗'
})

const idleCores = computed(() => {
  return powerStates.value.filter(s => s === 'wfi' || s === 'sleep').length
})

const highPowerCores = computed(() => {
  return corePowers.value.filter(p => p > 80).length
})

function getCoreStateType(state) {
  switch (state) {
    case 'run': return 'danger'
    case 'wfi': return 'info'
    case 'sleep': return 'success'
    default: return 'info'
  }
}

function getStateText(state) {
  switch (state) {
    case 'run': return '运行中'
    case 'wfi': return '等待中断'
    case 'sleep': return '睡眠'
    case 'deep_sleep': return '深度睡眠'
    case 'off': return '关闭'
    default: return '未知'
  }
}

function getPowerColor(power) {
  if (power > 100) return '#f56c6c'
  if (power > 50) return '#e6a23c'
  return '#67c23a'
}
</script>

<style scoped>
.power-monitor {
  width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.power-overview {
  display: flex;
  gap: 20px;
}

.power-item {
  flex: 1;
  text-align: center;
  padding: 15px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  border-radius: 8px;
}

.power-item.main-power {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.power-item.main-power .power-label,
.power-item.main-power .power-unit {
  color: rgba(255, 255, 255, 0.8);
}

.power-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.power-value.energy-value {
  font-size: 22px;
}

.power-unit {
  font-size: 12px;
  color: #909399;
  margin-left: 2px;
}

.power-label {
  font-size: 12px;
  color: #606266;
  margin-top: 4px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.core-power-item {
  margin-bottom: 12px;
}

.core-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.state-text {
  font-size: 12px;
  color: #909399;
}

.core-power-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.power-text {
  font-size: 12px;
  font-family: monospace;
  min-width: 80px;
  text-align: right;
}

.breakdown-chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.breakdown-label {
  width: 70px;
  font-size: 12px;
  color: #606266;
}

.breakdown-bar {
  flex: 1;
  height: 8px;
  background: #67c23a;
  border-radius: 4px;
  min-width: 5px;
}

.breakdown-bar.memory {
  background: #409eff;
}

.breakdown-bar.peripheral {
  background: #e6a23c;
}

.breakdown-value {
  width: 80px;
  font-size: 12px;
  font-family: monospace;
  text-align: right;
}

.power-savings {
  margin-top: 5px;
}
</style>
