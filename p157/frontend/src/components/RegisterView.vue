<template>
  <div class="register-view">
    <el-card>
      <template #header>
        <span>寄存器</span>
      </template>
      <div class="registers-grid">
        <div v-for="(reg, idx) in registers" :key="idx" class="register-item">
          <span class="reg-name">R{{ idx }}</span>
          <span class="reg-value hex">0x{{ toHex(reg) }}</span>
          <span class="reg-value dec">{{ reg }}</span>
        </div>
      </div>
      <el-divider />
      <div class="special-registers">
        <div class="special-reg">
          <span class="reg-name">PC</span>
          <span class="reg-value hex">0x{{ toHex(pc) }}</span>
        </div>
        <div class="special-reg">
          <span class="reg-name">SP</span>
          <span class="reg-value hex">0x{{ toHex(sp) }}</span>
        </div>
        <div class="special-reg">
          <span class="reg-name">LR</span>
          <span class="reg-value hex">0x{{ toHex(lr) }}</span>
        </div>
        <div class="special-reg">
          <span class="reg-name">XPSR</span>
          <span class="reg-value hex">0x{{ toHex(xpsr) }}</span>
        </div>
      </div>
      <el-divider />
      <div class="flags">
        <div class="flags-title">标志位</div>
        <div class="flags-row">
          <div class="flag-item">
            <el-tag :type="n ? 'danger' : 'info'" size="small">N</el-tag>
            <span class="flag-desc">负数</span>
          </div>
          <div class="flag-item">
            <el-tag :type="z ? 'success' : 'info'" size="small">Z</el-tag>
            <span class="flag-desc">零</span>
          </div>
          <div class="flag-item">
            <el-tag :type="c ? 'warning' : 'info'" size="small">C</el-tag>
            <span class="flag-desc">进位</span>
          </div>
          <div class="flag-item">
            <el-tag :type="v ? 'danger' : 'info'" size="small">V</el-tag>
            <span class="flag-desc">溢出</span>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'

const simulatorStore = useSimulatorStore()

const registers = computed(() => simulatorStore.registers.slice(0, 13))
const pc = computed(() => simulatorStore.registers[15])
const sp = computed(() => simulatorStore.registers[13])
const lr = computed(() => simulatorStore.registers[14])
const xpsr = computed(() => simulatorStore.xpsr)

const n = computed(() => (xpsr.value & 0x80000000) !== 0)
const z = computed(() => (xpsr.value & 0x40000000) !== 0)
const c = computed(() => (xpsr.value & 0x20000000) !== 0)
const v = computed(() => (xpsr.value & 0x10000000) !== 0)

function toHex(val) {
  return (val >>> 0).toString(16).toUpperCase().padStart(8, '0')
}
</script>

<style scoped>
.register-view {
  width: 100%;
}

.registers-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.register-item {
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-family: monospace;
}

.reg-name {
  font-size: 11px;
  color: #909399;
  font-weight: 600;
}

.reg-value {
  font-size: 12px;
}

.reg-value.hex {
  color: #409eff;
  font-weight: 500;
}

.reg-value.dec {
  color: #606266;
  font-size: 10px;
}

.special-registers {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.special-reg {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #ecf5ff;
  border-radius: 4px;
}

.special-reg .reg-name {
  font-weight: 700;
  color: #409eff;
  font-size: 13px;
  min-width: 40px;
}

.special-reg .reg-value {
  font-family: monospace;
  font-size: 14px;
}

.flags {
  padding: 5px 0;
}

.flags-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #303133;
}

.flags-row {
  display: flex;
  gap: 20px;
}

.flag-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.flag-desc {
  font-size: 12px;
  color: #606266;
}
</style>
