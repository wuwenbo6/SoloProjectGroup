<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">工作台</div>
    </div>

    <el-row :gutter="20" style="margin-bottom: 30px;">
      <el-col :span="6">
        <el-card class="stat-card">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div class="card-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <el-icon><Document /></el-icon>
            </div>
            <div>
              <div class="card-value">{{ stats.todayProcessCount }}</div>
              <div class="card-label">今日工序数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div class="card-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <el-icon><Warning /></el-icon>
            </div>
            <div>
              <div class="card-value">{{ stats.abnormalCount }}</div>
              <div class="card-label">异常预警</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div class="card-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
              <el-icon><Check /></el-icon>
            </div>
            <div>
              <div class="card-value">{{ stats.qualityPassRate }}%</div>
              <div class="card-label">质检合格率</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div class="card-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
              <el-icon><Tickets /></el-icon>
            </div>
            <div>
              <div class="card-value">{{ stats.traceCodeCount }}</div>
              <div class="card-label">溯源码生成</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="14">
        <el-card>
          <template #header>
            <span>工序进度</span>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in processList"
              :key="index"
              :timestamp="item.startTime"
              :type="item.abnormalFlag === 'ABNORMAL' ? 'danger' : 'primary'"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong>{{ item.processName }}</strong>
                  <span style="margin-left: 10px; color: #666;">批次: {{ item.batchNo }}</span>
                </div>
                <el-tag :class="getStatusClass(item.status)">
                  {{ getStatusText(item.status) }}
                </el-tag>
              </div>
              <div style="margin-top: 5px; color: #999;">
                工匠: {{ item.craftsmanName }}
              </div>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card>
          <template #header>
            <span>异常预警</span>
          </template>
          <el-alert
            v-for="(item, index) in abnormalList"
            :key="index"
            :title="`${item.processName} - ${item.batchNo}`"
            type="error"
            :description="item.abnormalDesc"
            style="margin-bottom: 10px;"
            closable
          />
          <el-empty v-if="abnormalList.length === 0" description="暂无异常" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getProcessList, getAbnormalList } from '../api/process'
import websocket from '../utils/websocket'

const stats = ref({
  todayProcessCount: 0,
  abnormalCount: 0,
  qualityPassRate: 95.5,
  traceCodeCount: 0
})

const processList = ref([])
const abnormalList = ref([])

const loadData = async () => {
  try {
    const [processRes, abnormalRes] = await Promise.all([
      getProcessList({ page: 1, size: 10 }),
      getAbnormalList()
    ])
    
    processList.value = processRes.data.records || []
    abnormalList.value = abnormalRes.data || []
    stats.value.todayProcessCount = processRes.data.total || 0
    stats.value.abnormalCount = abnormalRes.data?.length || 0
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

const initWebSocket = async () => {
  try {
    await websocket.connect()
    
    websocket.subscribeProcessProgress((data) => {
      console.log('收到工序进度更新:', data)
      updateProcessProgress(data)
    })
    
    websocket.subscribeProcessAbnormal((data) => {
      console.log('收到工序异常警告:', data)
      ElMessage.warning(`${data.processName} 出现异常: ${data.reason}`)
      addAbnormalItem(data)
    })
    
    websocket.subscribeProcessComplete((data) => {
      console.log('收到工序完成通知:', data)
      ElMessage.success(`${data.processName} 已完成`)
      updateProcessComplete(data)
    })
  } catch (error) {
    console.error('WebSocket初始化失败:', error)
  }
}

const updateProcessProgress = (data) => {
  const index = processList.value.findIndex(
    item => item.batchNo === data.batchNo && item.processCode === data.processCode
  )
  if (index !== -1) {
    processList.value[index] = { ...processList.value[index], ...data }
  } else {
    processList.value.unshift(data)
  }
}

const addAbnormalItem = (data) => {
  stats.value.abnormalCount++
  const exists = abnormalList.value.find(
    item => item.batchNo === data.batchNo && item.processCode === data.processCode
  )
  if (!exists) {
    abnormalList.value.unshift(data)
  }
}

const updateProcessComplete = (data) => {
  const index = processList.value.findIndex(
    item => item.batchNo === data.batchNo && item.processCode === data.processCode
  )
  if (index !== -1) {
    processList.value[index].status = 'COMPLETED'
  }
}

const getStatusText = (status) => {
  const map = {
    'PROCESSING': '进行中',
    'COMPLETED': '已完成',
    'SUSPENDED': '已暂停'
  }
  return map[status] || status
}

const getStatusClass = (status) => {
  const map = {
    'PROCESSING': 'status-processing',
    'COMPLETED': 'status-completed'
  }
  return map[status] || ''
}

onMounted(() => {
  loadData()
  initWebSocket()
})

onUnmounted(() => {
  websocket.disconnect()
})
</script>
