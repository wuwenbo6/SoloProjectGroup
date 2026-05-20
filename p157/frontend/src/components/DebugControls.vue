<template>
  <div class="debug-controls">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>调试控制</span>
          <el-tag v-if="simulatorStore.isRunning" type="success" size="small">运行中</el-tag>
          <el-tag v-else-if="simulatorStore.isPaused" type="warning" size="small">已暂停</el-tag>
          <el-tag v-else type="info" size="small">已停止</el-tag>
        </div>
      </template>
      
      <div class="control-section">
        <div class="control-buttons">
          <el-button 
            @click="handleRun" 
            :disabled="!simulatorStore.elfLoaded || simulatorStore.isRunning"
            type="success"
            icon="VideoPlay"
          >
            运行
          </el-button>
          <el-button 
            @click="handlePause" 
            :disabled="!simulatorStore.isRunning"
            type="warning"
            icon="VideoPause"
          >
            暂停
          </el-button>
          <el-button 
            @click="handleStep" 
            :disabled="simulatorStore.isRunning || !simulatorStore.elfLoaded"
            type="primary"
            icon="DArrowRight"
          >
            单步
          </el-button>
          <el-button 
            @click="handleStop" 
            :disabled="!simulatorStore.elfLoaded"
            type="danger"
            icon="SwitchButton"
          >
            停止
          </el-button>
        </div>
        
        <div class="speed-control">
          <span class="speed-label">速度:</span>
          <el-slider 
            v-model="speed" 
            :min="1" 
            :max="10" 
            :step="1"
            :show-tooltip="true"
            @change="handleSpeedChange"
            style="width: 150px"
          />
          <span class="speed-value">{{ speed }}x</span>
        </div>
      </div>

      <el-divider />

      <div class="elf-section">
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :show-file-list="false"
          accept=".elf,.bin,.o"
          :on-change="handleFileChange"
        >
          <el-button type="primary" icon="Upload">
            上传 ELF 文件
          </el-button>
        </el-upload>
        <div v-if="simulatorStore.elfFileName" class="elf-info">
          <el-icon><Check /></el-icon>
          <span>{{ simulatorStore.elfFileName }}</span>
        </div>
      </div>

      <el-divider />

      <div class="breakpoint-section">
        <div class="section-title">断点管理</div>
        <div class="breakpoint-input">
          <el-input-number 
            v-model="newBreakpoint" 
            :step="2"
            placeholder="地址"
            size="small"
            style="width: 150px"
          />
          <el-button 
            @click="addBreakpoint" 
            size="small"
            type="primary"
            icon="Plus"
          >
            添加断点
          </el-button>
        </div>
        <div class="breakpoint-list">
          <div 
            v-for="bp in breakpoints" 
            :key="bp"
            class="breakpoint-item"
          >
            <el-icon class="bp-icon"><CircleCloseFilled /></el-icon>
            <span class="bp-addr">0x{{ bp.toString(16).toUpperCase().padStart(8, '0') }}</span>
            <el-button 
              @click="removeBreakpoint(bp)" 
              size="small" 
              type="danger"
              text
              icon="Delete"
            />
          </div>
          <el-empty 
            v-if="breakpoints.length === 0" 
            description="暂无断点" 
            :image-size="40"
          />
        </div>
      </div>

      <el-divider />

      <div class="snapshot-section">
        <div class="section-title">快照管理</div>
        <div class="snapshot-input">
          <el-input 
            v-model="snapshotName" 
            placeholder="快照名称"
            size="small"
            style="width: 150px"
          />
          <el-button 
            @click="saveSnapshot" 
            size="small"
            type="success"
            icon="Camera"
          >
            保存快照
          </el-button>
        </div>
        <div class="snapshot-list">
          <div 
            v-for="snap in snapshots" 
            :key="snap.id"
            class="snapshot-item"
          >
            <el-icon class="snap-icon"><Camera /></el-icon>
            <div class="snap-info">
              <div class="snap-name">{{ snap.name }}</div>
              <div class="snap-time">{{ formatTime(snap.timestamp) }}</div>
            </div>
            <div class="snap-actions">
              <el-button 
                @click="loadSnapshot(snap.id)" 
                size="small" 
                type="primary"
                text
                icon="Download"
              >
                加载
              </el-button>
              <el-button 
                @click="deleteSnapshot(snap.id)" 
                size="small" 
                type="danger"
                text
                icon="Delete"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  VideoPlay, VideoPause, DArrowRight, SwitchButton, 
  Upload, Plus, Delete, Camera, Download, Check,
  CircleCloseFilled
} from '@element-plus/icons-vue'
import { useSimulatorStore } from '@/stores/simulator'

const simulatorStore = useSimulatorStore()
const uploadRef = ref(null)
const newBreakpoint = ref(0)
const speed = ref(1)
const snapshotName = ref('')

const breakpoints = computed(() => simulatorStore.breakpoints)
const snapshots = computed(() => simulatorStore.snapshots)

function handleRun() {
  simulatorStore.run()
}

function handlePause() {
  simulatorStore.pause()
  ElMessage.info('模拟器已暂停')
}

function handleStep() {
  simulatorStore.step()
}

function handleStop() {
  simulatorStore.stop()
  ElMessage.info('模拟器已停止')
}

function handleSpeedChange(val) {
  simulatorStore.setSpeed(val)
}

function handleFileChange(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    const buffer = e.target.result
    const success = simulatorStore.loadELF(buffer, file.name)
    if (success) {
      ElMessage.success('ELF 文件加载成功')
    } else {
      ElMessage.error('ELF 文件加载失败')
    }
  }
  reader.readAsArrayBuffer(file.raw)
}

function addBreakpoint() {
  if (newBreakpoint.value >= 0) {
    simulatorStore.addBreakpoint(newBreakpoint.value)
    newBreakpoint.value = 0
    ElMessage.success('断点已添加')
  }
}

function removeBreakpoint(addr) {
  simulatorStore.removeBreakpoint(addr)
  ElMessage.info('断点已移除')
}

async function saveSnapshot() {
  const name = snapshotName.value || `Snapshot ${Date.now()}`
  await simulatorStore.saveSnapshot(name)
  snapshotName.value = ''
  ElMessage.success('快照已保存')
}

async function loadSnapshot(id) {
  await simulatorStore.loadSnapshot(id)
  ElMessage.success('快照已加载')
}

async function deleteSnapshot(id) {
  await simulatorStore.deleteSnapshot(id)
  ElMessage.info('快照已删除')
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString()
}

onMounted(() => {
  simulatorStore.loadSnapshots()
})
</script>

<style scoped>
.debug-controls {
  width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.control-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.speed-label {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

.speed-value {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
  min-width: 40px;
}

.elf-section {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.elf-info {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #67c23a;
  font-size: 13px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #303133;
}

.breakpoint-section,
.snapshot-section {
  padding: 5px 0;
}

.breakpoint-input,
.snapshot-input {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.breakpoint-list {
  max-height: 150px;
  overflow-y: auto;
}

.breakpoint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 6px;
}

.bp-icon {
  color: #f56c6c;
  font-size: 10px;
}

.bp-addr {
  font-family: monospace;
  font-size: 13px;
  flex: 1;
}

.snapshot-list {
  max-height: 200px;
  overflow-y: auto;
}

.snapshot-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 8px;
}

.snap-icon {
  color: #409eff;
  font-size: 16px;
}

.snap-info {
  flex: 1;
}

.snap-name {
  font-size: 13px;
  font-weight: 500;
}

.snap-time {
  font-size: 11px;
  color: #909399;
}

.snap-actions {
  display: flex;
  gap: 4px;
}
</style>
