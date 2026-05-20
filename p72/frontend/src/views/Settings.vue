<template>
  <div class="settings-page">
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon size="32" color="#38bdf8"><Monitor /></el-icon>
          <h1>竹编缺陷检测 - 参数设置</h1>
        </div>
        <div class="header-right">
          <el-menu mode="horizontal" :default-active="activeMenu" class="nav-menu" @select="handleMenuSelect">
            <el-menu-item index="dashboard">实时监控</el-menu-item>
            <el-menu-item index="history">历史数据</el-menu-item>
            <el-menu-item index="settings">参数设置</el-menu-item>
          </el-menu>
        </div>
      </el-header>
      
      <el-main class="main-content">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-card>
              <template #header>
                <div class="card-header">
                  <el-icon><Setting /></el-icon>
                  <span>检测参数</span>
                </div>
              </template>
              <el-form :model="detectionParams" label-width="120px">
                <el-form-item label="检测速度">
                  <el-slider v-model="detectionParams.speed" :min="10" :max="120" />
                  <span style="margin-left: 10px; color: #38bdf8;">{{ detectionParams.speed }} 件/分钟</span>
                </el-form-item>
                <el-form-item label="检测精度">
                  <el-input-number v-model="detectionParams.precision" :min="0.01" :max="1" :step="0.01" />
                  <span style="margin-left: 10px; color: #94a3b8;">mm</span>
                </el-form-item>
                <el-form-item label="置信度阈值">
                  <el-slider v-model="detectionParams.confidenceThreshold" :min="0.5" :max="1" :step="0.05" />
                  <span style="margin-left: 10px; color: #38bdf8;">{{ (detectionParams.confidenceThreshold * 100).toFixed(0) }}%</span>
                </el-form-item>
                <el-form-item label="缺陷等级阈值">
                  <div class="threshold-group">
                    <span style="color: #94a3b8; width: 80px;">轻微:</span>
                    <el-input-number v-model="detectionParams.level1Threshold" :min="1" :max="10" style="width: 100px;" />
                    <span style="color: #94a3b8; margin: 0 10px;">mm</span>
                  </div>
                  <div class="threshold-group" style="margin-top: 10px;">
                    <span style="color: #94a3b8; width: 80px;">一般:</span>
                    <el-input-number v-model="detectionParams.level2Threshold" :min="1" :max="20" style="width: 100px;" />
                    <span style="color: #94a3b8; margin: 0 10px;">mm</span>
                  </div>
                </el-form-item>
                <el-form-item label="运行模式">
                  <el-radio-group v-model="detectionParams.mode">
                    <el-radio value="auto">自动模式</el-radio>
                    <el-radio value="manual">手动模式</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="saveDetectionParams">
                    <el-icon><Check /></el-icon>
                    保存检测参数
                  </el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>
          
          <el-col :span="12">
            <el-card>
              <template #header>
                <div class="card-header">
                  <el-icon><Camera /></el-icon>
                  <span>相机参数</span>
                </div>
              </template>
              <el-form :model="cameraParams" label-width="120px">
                <el-form-item label="亮度">
                  <el-slider v-model="cameraParams.brightness" :min="0" :max="100" />
                  <span style="margin-left: 10px; color: #38bdf8;">{{ cameraParams.brightness }}</span>
                </el-form-item>
                <el-form-item label="对比度">
                  <el-slider v-model="cameraParams.contrast" :min="0" :max="100" />
                  <span style="margin-left: 10px; color: #38bdf8;">{{ cameraParams.contrast }}</span>
                </el-form-item>
                <el-form-item label="饱和度">
                  <el-slider v-model="cameraParams.saturation" :min="0" :max="100" />
                  <span style="margin-left: 10px; color: #38bdf8;">{{ cameraParams.saturation }}</span>
                </el-form-item>
                <el-form-item label="锐度">
                  <el-slider v-model="cameraParams.sharpness" :min="0" :max="100" />
                  <span style="margin-left: 10px; color: #38bdf8;">{{ cameraParams.sharpness }}</span>
                </el-form-item>
                <el-form-item label="曝光模式">
                  <el-select v-model="cameraParams.exposureMode" style="width: 100%;">
                    <el-option label="自动曝光" value="auto" />
                    <el-option label="手动曝光" value="manual" />
                  </el-select>
                </el-form-item>
                <el-form-item label="分辨率">
                  <el-select v-model="cameraParams.resolution" style="width: 100%;">
                    <el-option label="1920x1080" value="1920x1080" />
                    <el-option label="2560x1440" value="2560x1440" />
                    <el-option label="3840x2160" value="3840x2160" />
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="saveCameraParams">
                    <el-icon><Check /></el-icon>
                    保存相机参数
                  </el-button>
                  <el-button @click="testCamera">
                    <el-icon><Picture /></el-icon>
                    测试拍照
                  </el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="20" style="margin-top: 20px;">
          <el-col :span="24">
            <el-card>
              <template #header>
                <div class="card-header">
                  <el-icon><Warning /></el-icon>
                  <span>预警配置</span>
                </div>
              </template>
              <el-form :model="alertConfig" label-width="150px">
                <el-row :gutter="20">
                  <el-col :span="8">
                    <el-form-item label="声音预警">
                      <el-switch v-model="alertConfig.soundEnabled" />
                    </el-form-item>
                    <el-form-item label="弹窗预警">
                      <el-switch v-model="alertConfig.popupEnabled" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="预警等级">
                      <el-select v-model="alertConfig.alertLevel" style="width: 100%;">
                        <el-option label="全部等级" value="all" />
                        <el-option label="一般及以上" value="2" />
                        <el-option label="仅严重" value="3" />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="连续缺陷预警">
                      <el-input-number v-model="alertConfig.consecutiveThreshold" :min="1" :max="20" />
                      <span style="margin-left: 10px; color: #94a3b8;">次后触发</span>
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="邮件通知">
                      <el-switch v-model="alertConfig.emailEnabled" />
                    </el-form-item>
                    <el-form-item label="通知邮箱">
                      <el-input v-model="alertConfig.email" placeholder="输入通知邮箱" disabled />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-form-item>
                  <el-button type="primary" @click="saveAlertConfig">
                    <el-icon><Check /></el-icon>
                    保存预警配置
                  </el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="20" style="margin-top: 20px;">
          <el-col :span="24">
            <el-card>
              <template #header>
                <div class="card-header">
                  <el-icon><Clock /></el-icon>
                  <span>参数变更历史</span>
                </div>
              </template>
              <el-table :data="paramHistory" stripe style="width: 100%">
                <el-table-column prop="timestamp" label="变更时间" width="180">
                  <template #default="{ row }">
                    {{ formatTime(row.timestamp) }}
                  </template>
                </el-table-column>
                <el-table-column prop="paramType" label="参数类型" width="120">
                  <template #default="{ row }">
                    <el-tag :type="getParamTypeTag(row.paramType)" size="small">
                      {{ translateParamType(row.paramType) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="paramName" label="参数名称" width="150">
                  <template #default="{ row }">
                    {{ translateParamName(row.paramName) }}
                  </template>
                </el-table-column>
                <el-table-column prop="oldValue" label="变更前" />
                <el-table-column prop="newValue" label="变更后" />
                <el-table-column prop="operator" label="操作人" width="100" />
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../api'

const router = useRouter()
const activeMenu = ref('settings')
const loading = ref(false)

const detectionParams = reactive({
  speed: 60,
  precision: 0.1,
  confidenceThreshold: 0.75,
  level1Threshold: 3,
  level2Threshold: 8,
  mode: 'auto'
})

const cameraParams = reactive({
  brightness: 80,
  contrast: 50,
  saturation: 50,
  sharpness: 60,
  exposureMode: 'auto',
  resolution: '1920x1080'
})

const alertConfig = reactive({
  soundEnabled: true,
  popupEnabled: true,
  alertLevel: '2',
  consecutiveThreshold: 5,
  emailEnabled: false,
  email: 'admin@bamboo.com'
})

const paramStatistics = ref({})
const paramHistory = ref([])

const handleMenuSelect = (index) => {
  router.push('/' + index)
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const getParamTypeTag = (type) => {
  const types = { 'detection': 'primary', 'camera': 'success', 'alert': 'warning' }
  return types[type] || 'info'
}

const translateParamType = (type) => {
  const translations = { 'detection': '检测参数', 'camera': '相机参数', 'alert': '预警配置' }
  return translations[type] || type
}

const translateParamName = (name) => {
  const translations = {
    'speed': '检测速度',
    'precision': '检测精度',
    'confidenceThreshold': '置信度阈值',
    'level1Threshold': '轻微阈值',
    'level2Threshold': '一般阈值',
    'mode': '运行模式',
    'brightness': '亮度',
    'contrast': '对比度',
    'saturation': '饱和度',
    'sharpness': '锐度',
    'exposureMode': '曝光模式',
    'resolution': '分辨率',
    'soundEnabled': '声音预警',
    'popupEnabled': '弹窗预警',
    'alertLevel': '预警等级',
    'consecutiveThreshold': '连续缺陷阈值',
    'emailEnabled': '邮件通知',
    'email': '通知邮箱'
  }
  return translations[name] || name
}

const loadDetectionParams = async () => {
  try {
    const res = await request.get('/api/process/params/detection')
    if (res.data && res.code === 200) {
      Object.assign(detectionParams, res.data)
    }
  } catch (error) {
    console.error('加载检测参数失败:', error)
  }
}

const loadCameraParams = async () => {
  try {
    const res = await request.get('/api/process/params/camera')
    if (res.data && res.code === 200) {
      Object.assign(cameraParams, res.data)
    }
  } catch (error) {
    console.error('加载相机参数失败:', error)
  }
}

const loadAlertParams = async () => {
  try {
    const res = await request.get('/api/process/params/alert')
    if (res.data && res.code === 200) {
      Object.assign(alertConfig, res.data)
    }
  } catch (error) {
    console.error('加载预警配置失败:', error)
  }
}

const loadParamHistory = async () => {
  try {
    const res = await request.get('/api/process/history/recent')
    if (res.data && res.code === 200) {
      paramHistory.value = res.data
    }
  } catch (error) {
    console.error('加载参数历史失败:', error)
  }
}

const loadParamStatistics = async () => {
  try {
    const res = await request.get('/api/process/statistics')
    if (res.data && res.code === 200) {
      paramStatistics.value = res.data
    }
  } catch (error) {
    console.error('加载参数统计失败:', error)
  }
}

const saveDetectionParams = async () => {
  loading.value = true
  try {
    const paramUpdates = [
      { name: 'speed', value: detectionParams.speed },
      { name: 'precision', value: detectionParams.precision },
      { name: 'confidenceThreshold', value: detectionParams.confidenceThreshold },
      { name: 'level1Threshold', value: detectionParams.level1Threshold },
      { name: 'level2Threshold', value: detectionParams.level2Threshold },
      { name: 'mode', value: detectionParams.mode }
    ]
    
    const updatePromises = paramUpdates.map(({ name, value }) => 
      request.put('/api/process/params', {
        paramType: 'detection',
        paramName: name,
        value: value,
        operator: '管理员'
      })
    )
    
    await Promise.all(updatePromises)
    
    ElMessage.success('检测参数保存成功')
    await loadParamHistory()
    await loadParamStatistics()
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const saveCameraParams = async () => {
  loading.value = true
  try {
    const paramUpdates = [
      { name: 'brightness', value: cameraParams.brightness },
      { name: 'contrast', value: cameraParams.contrast },
      { name: 'saturation', value: cameraParams.saturation },
      { name: 'sharpness', value: cameraParams.sharpness },
      { name: 'exposureMode', value: cameraParams.exposureMode },
      { name: 'resolution', value: cameraParams.resolution }
    ]
    
    const updatePromises = paramUpdates.map(({ name, value }) => 
      request.put('/api/process/params', {
        paramType: 'camera',
        paramName: name,
        value: value,
        operator: '管理员'
      })
    )
    
    await Promise.all(updatePromises)
    
    ElMessage.success('相机参数保存成功')
    await loadParamHistory()
    await loadParamStatistics()
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const saveAlertConfig = async () => {
  loading.value = true
  try {
    const paramUpdates = [
      { name: 'soundEnabled', value: alertConfig.soundEnabled },
      { name: 'popupEnabled', value: alertConfig.popupEnabled },
      { name: 'alertLevel', value: alertConfig.alertLevel },
      { name: 'consecutiveThreshold', value: alertConfig.consecutiveThreshold },
      { name: 'emailEnabled', value: alertConfig.emailEnabled },
      { name: 'email', value: alertConfig.email }
    ]
    
    const updatePromises = paramUpdates.map(({ name, value }) => 
      request.put('/api/process/params', {
        paramType: 'alert',
        paramName: name,
        value: value,
        operator: '管理员'
      })
    )
    
    await Promise.all(updatePromises)
    
    ElMessage.success('预警配置保存成功')
    await loadParamHistory()
    await loadParamStatistics()
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const testCamera = async () => {
  try {
    const res = await request.post('/api/camera/capture')
    if (res.code === 200) {
      ElMessage.success('相机拍照测试成功')
    }
  } catch (error) {
    ElMessage.error('拍照测试失败: ' + error.message)
  }
}

const loadAllParams = async () => {
  await Promise.all([
    loadDetectionParams(),
    loadCameraParams(),
    loadAlertParams(),
    loadParamHistory(),
    loadParamStatistics()
  ])
}

onMounted(() => {
  loadAllParams()
})
</script>

<style scoped lang="scss">
.settings-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: rgba(30, 41, 59, 0.95);
  border-bottom: 1px solid rgba(71, 85, 105, 0.5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    h1 {
      font-size: 20px;
      color: #38bdf8;
      margin: 0;
    }
  }
}

.nav-menu {
  background: transparent;
  border: none;

  :deep(.el-menu-item) {
    color: #94a3b8;

    &.is-active {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
    }

    &:hover {
      background: rgba(56, 189, 248, 0.05);
      color: #38bdf8;
    }
  }
}

.main-content {
  background: #0f172a;
  overflow-y: auto;
  padding-bottom: 40px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-form-item__label) {
  color: #94a3b8 !important;
}

:deep(.el-radio__label) {
  color: #e2e8f0 !important;
}

.threshold-group {
  display: flex;
  align-items: center;
}
</style>
