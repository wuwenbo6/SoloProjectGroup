<template>
  <div class="app-container">
    <el-container>
      <el-header class="app-header">
        <div class="header-content">
          <h1 class="app-title">
            <el-icon><Cpu /></el-icon>
            ARM Cortex-M FreeRTOS Simulator
          </h1>
          <div class="header-actions">
            <el-button @click="createDemoTasks" type="primary" size="small">
              创建演示任务
            </el-button>
          </div>
        </div>
      </el-header>
      <el-main class="app-main">
        <el-tabs v-model="activeTab" class="main-tabs">
          <el-tab-pane label="任务视图" name="tasks">
            <el-row :gutter="20">
              <el-col :span="5">
                <DebugControls />
              </el-col>
              <el-col :span="13">
                <el-row :gutter="20" class="main-content">
                  <el-col :span="24">
                    <TaskStateGraph />
                  </el-col>
                  <el-col :span="24" style="margin-top: 20px;">
                    <QueueSemaphoreView />
                  </el-col>
                </el-row>
              </el-col>
              <el-col :span="6">
                <el-row :gutter="20">
                  <el-col :span="24">
                    <RegisterView />
                  </el-col>
                  <el-col :span="24" style="margin-top: 20px;">
                    <TraceLog />
                  </el-col>
                </el-row>
              </el-col>
            </el-row>
          </el-tab-pane>

          <el-tab-pane label="多核 SMP" name="multicore">
            <el-row :gutter="20">
              <el-col :span="12">
                <MultiCoreStatus />
              </el-col>
              <el-col :span="12">
                <PowerMonitor />
              </el-col>
            </el-row>
          </el-tab-pane>

          <el-tab-pane label="调度时间线" name="timeline">
            <ScheduleTimeline />
          </el-tab-pane>
        </el-tabs>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Cpu } from '@element-plus/icons-vue'
import { useSimulatorStore } from '@/stores/simulator'
import TaskStateGraph from '@/components/TaskStateGraph.vue'
import QueueSemaphoreView from '@/components/QueueSemaphoreView.vue'
import DebugControls from '@/components/DebugControls.vue'
import RegisterView from '@/components/RegisterView.vue'
import TraceLog from '@/components/TraceLog.vue'
import MultiCoreStatus from '@/components/MultiCoreStatus.vue'
import PowerMonitor from '@/components/PowerMonitor.vue'
import ScheduleTimeline from '@/components/ScheduleTimeline.vue'

const simulatorStore = useSimulatorStore()
const activeTab = ref('tasks')

function createDemoTasks() {
  simulatorStore.createDemoTasks()
}

onMounted(() => {
  simulatorStore.init()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-container {
  width: 100%;
  height: 100vh;
  background: #f0f2f5;
}

.el-container {
  height: 100%;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 600;
  color: white;
  margin: 0;
}

.app-title .el-icon {
  font-size: 28px;
}

.app-main {
  padding: 20px;
  overflow: auto;
  height: calc(100vh - 60px);
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.main-tabs {
  height: 100%;
}

.main-tabs :deep(.el-tabs__content) {
  height: calc(100% - 50px);
  overflow: auto;
}
</style>
