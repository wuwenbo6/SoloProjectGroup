<template>
  <div class="app-container">
    <el-container>
      <el-aside width="200px" class="sidebar">
        <div class="logo">
          <h3>传感器监控系统</h3>
        </div>
        <el-menu
          :default-active="$route.path"
          class="el-menu-vertical-demo"
          router
        >
          <el-menu-item index="/">
            <el-icon><Monitor /></el-icon>
            <span>实时监控</span>
          </el-menu-item>
          <el-menu-item index="/analysis">
            <el-icon><DataAnalysis /></el-icon>
            <span>频谱分析</span>
          </el-menu-item>
          <el-menu-item index="/history">
            <el-icon><History /></el-icon>
            <span>历史回放</span>
          </el-menu-item>
          <el-menu-item index="/anomalies">
            <el-icon><Warning /></el-icon>
            <span>异常记录</span>
          </el-menu-item>
          <el-menu-item index="/model">
            <el-icon><Setting /></el-icon>
            <span>模型管理</span>
          </el-menu-item>
          <el-menu-item index="/diagnostics">
            <el-icon><TrendCharts /></el-icon>
            <span>故障诊断</span>
          </el-menu-item>
          <el-menu-item index="/reports">
            <el-icon><Document /></el-icon>
            <span>运维报告</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container>
        <el-header class="header">
          <div class="header-left">
            <el-select v-model="selectedSensor" placeholder="选择传感器" @change="onSensorChange" style="width: 200px">
              <el-option v-for="sensor in sensors" :key="sensor" :label="sensor" :value="sensor" />
            </el-select>
          </div>
          <div class="header-right">
            <el-button :type="simulatorRunning ? 'danger' : 'success'" @click="toggleSimulator">
              {{ simulatorRunning ? '停止模拟' : '开始模拟' }}
            </el-button>
          </div>
        </el-header>
        <el-main class="main-content">
          <router-view v-slot="{ Component }">
            <component :is="Component" :sensor-id="selectedSensor" />
          </router-view>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Monitor, DataAnalysis, History, Warning, Setting, TrendCharts, Document } from '@element-plus/icons-vue'
import axios from './api/axios'

const router = useRouter()
const selectedSensor = ref('sensor_001')
const sensors = ref([])
const simulatorRunning = ref(false)

const loadSensors = async () => {
  try {
    const response = await axios.get('/api/sensors')
    sensors.value = response.data.sensors
  } catch (error) {
    console.error('加载传感器列表失败:', error)
  }
}

const checkSimulatorStatus = async () => {
  try {
    const response = await axios.get('/api/simulator/status')
    simulatorRunning.value = response.data.running
  } catch (error) {
    console.error('检查模拟器状态失败:', error)
  }
}

const toggleSimulator = async () => {
  try {
    if (simulatorRunning.value) {
      await axios.post('/api/simulator/stop')
    } else {
      await axios.post('/api/simulator/start')
    }
    simulatorRunning.value = !simulatorRunning.value
  } catch (error) {
    console.error('切换模拟器状态失败:', error)
  }
}

const onSensorChange = () => {
}

onMounted(() => {
  loadSensors()
  checkSimulatorStatus()
})
</script>

<style scoped>
.app-container {
  height: 100vh;
  background: #f5f7fa;
}

.sidebar {
  background: #304156;
}

.logo {
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid #434a50;
}

.logo h3 {
  color: #fff;
  margin: 0;
  font-size: 16px;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
}

.main-content {
  padding: 20px;
}

.el-menu {
  border-right: none;
}

:deep(.el-menu-item) {
  color: #bfcbd9;
}

:deep(.el-menu-item:hover) {
  background: #263445;
  color: #fff;
}

:deep(.el-menu-item.is-active) {
  background: #409eff;
  color: #fff;
}
</style>
