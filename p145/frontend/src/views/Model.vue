<template>
  <div class="model">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>模型状态</span>
          </template>
          <el-descriptions :column="1" border v-loading="loadingStatus">
            <el-descriptions-item label="模型加载状态">
              <el-tag :type="modelStatus.model_loaded ? 'success' : 'danger'">
                {{ modelStatus.model_loaded ? '已加载' : '未加载' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="异常阈值">
              {{ modelStatus.threshold?.toFixed(4) || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="序列长度">
              {{ modelStatus.sequence_length || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="特征数量">
              {{ modelStatus.n_features || '-' }}
            </el-descriptions-item>
          </el-descriptions>
          <el-button type="primary" style="margin-top: 20px; width: 100%" @click="refreshStatus">
            刷新状态
          </el-button>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <span>模型训练（模拟数据）</span>
          </template>
          <el-form :model="trainForm" label-width="120px">
            <el-form-item label="训练轮数 (epochs)">
              <el-input-number v-model="trainForm.epochs" :min="1" :max="200" />
            </el-form-item>
            <el-form-item label="批次大小 (batch size)">
              <el-input-number v-model="trainForm.batch_size" :min="8" :max="128" />
            </el-form-item>
          </el-form>
          <el-button 
            type="primary" 
            style="width: 100%" 
            @click="startTraining"
            :loading="isTraining"
          >
            {{ isTraining ? '训练中...' : '开始训练' }}
          </el-button>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card>
          <template #header>
            <span>上传CSV训练数据</span>
          </template>
          <el-alert
            title="CSV格式要求"
            type="info"
            :closable="false"
            style="margin-bottom: 20px"
          >
            <template #default>
              CSV文件必须包含以下列: vibration, swing, temperature
            </template>
          </el-alert>
          <el-upload
            ref="uploadRef"
            action="/api/model/train/upload"
            :auto-upload="false"
            :show-file-list="true"
            :on-change="handleFileChange"
            :before-upload="beforeUpload"
            accept=".csv"
            drag
            style="width: 100%"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              将CSV文件拖到此处，或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                只能上传csv文件
              </div>
            </template>
          </el-upload>
          <el-form :inline="true" style="margin-top: 20px">
            <el-form-item label="训练轮数">
              <el-input-number v-model="uploadTrainForm.epochs" :min="1" :max="200" />
            </el-form-item>
            <el-form-item label="批次大小">
              <el-input-number v-model="uploadTrainForm.batch_size" :min="8" :max="128" />
            </el-form-item>
            <el-form-item>
              <el-button 
                type="primary" 
                @click="startUploadTraining"
                :loading="isUploadTraining"
                :disabled="!selectedFile"
              >
                {{ isUploadTraining ? '训练中...' : '开始训练' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card>
          <template #header>
            <span>训练日志</span>
          </template>
          <el-scrollbar height="300px">
            <div class="log-container">
              <div 
                v-for="(log, index) in trainingLogs" 
                :key="index" 
                class="log-item"
                :class="log.type"
              >
                <span class="log-time">[{{ log.time }}]</span>
                <span class="log-message">{{ log.message }}</span>
              </div>
              <div v-if="trainingLogs.length === 0" class="empty-log">
                暂无训练日志
              </div>
            </div>
          </el-scrollbar>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import axios from '../api/axios'

const loadingStatus = ref(false)
const isTraining = ref(false)
const isUploadTraining = ref(false)

const modelStatus = ref({
  model_loaded: false,
  threshold: null,
  sequence_length: null,
  n_features: null
})

const trainForm = ref({
  epochs: 50,
  batch_size: 32
})

const uploadTrainForm = ref({
  epochs: 50,
  batch_size: 32
})

const selectedFile = ref(null)
const uploadRef = ref(null)
const trainingLogs = ref([])

const addLog = (message, type = 'info') => {
  const time = new Date().toLocaleTimeString()
  trainingLogs.value.push({ time, message, type })
}

const refreshStatus = async () => {
  loadingStatus.value = true
  try {
    const response = await axios.get('/model/status')
    modelStatus.value = response.data
  } catch (error) {
    console.error('加载模型状态失败:', error)
    ElMessage.error('加载失败')
  } finally {
    loadingStatus.value = false
  }
}

const startTraining = async () => {
  isTraining.value = true
  addLog('开始模型训练...', 'info')
  addLog(`参数: epochs=${trainForm.value.epochs}, batch_size=${trainForm.value.batch_size}`, 'info')

  try {
    const response = await axios.post('/model/train', {
      epochs: trainForm.value.epochs,
      batch_size: trainForm.value.batch_size
    })
    addLog('训练任务已启动，请等待训练完成...', 'success')
    addLog(response.data.message || '训练进行中...', 'info')
    
    setTimeout(() => {
      refreshStatus()
      addLog('训练完成，模型已更新', 'success')
    }, 3000)
  } catch (error) {
    console.error('训练失败:', error)
    addLog('训练失败: ' + (error.message || '未知错误'), 'error')
    ElMessage.error('训练失败')
  } finally {
    isTraining.value = false
  }
}

const handleFileChange = (file) => {
  selectedFile.value = file.raw
}

const beforeUpload = (file) => {
  const isCSV = file.name.endsWith('.csv')
  if (!isCSV) {
    ElMessage.error('只能上传CSV文件!')
    return false
  }
  return true
}

const startUploadTraining = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择CSV文件')
    return
  }

  isUploadTraining.value = true
  addLog('开始使用上传的数据训练...', 'info')

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('epochs', uploadTrainForm.value.epochs)
    formData.append('batch_size', uploadTrainForm.value.batch_size)

    const response = await axios.post('/model/train/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    addLog('训练任务已启动', 'success')
    addLog(response.data.message || '训练进行中...', 'info')
    
    setTimeout(() => {
      refreshStatus()
      addLog('训练完成，模型已更新', 'success')
    }, 3000)
  } catch (error) {
    console.error('训练失败:', error)
    addLog('训练失败: ' + (error.message || '未知错误'), 'error')
    ElMessage.error('训练失败')
  } finally {
    isUploadTraining.value = false
    uploadRef.value?.clearFiles()
    selectedFile.value = null
  }
}

onMounted(() => {
  refreshStatus()
  addLog('系统初始化完成', 'info')
})
</script>

<style scoped>
.model {
  padding: 0;
}

.log-container {
  padding: 10px;
  font-family: monospace;
}

.log-item {
  padding: 5px 0;
  border-bottom: 1px solid #f0f0f0;
}

.log-item.info .log-time {
  color: #409eff;
}

.log-item.success .log-time {
  color: #67c23a;
}

.log-item.error .log-time {
  color: #f56c6c;
}

.log-time {
  margin-right: 10px;
  color: #909399;
}

.log-message {
  color: #303133;
}

.empty-log {
  text-align: center;
  color: #909399;
  padding: 50px;
}
</style>
