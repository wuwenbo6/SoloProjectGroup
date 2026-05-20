<template>
  <div class="anomalies">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>异常事件记录</span>
          <el-button type="primary" size="small" @click="refreshAnomalies">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <el-table :data="anomalyList" border stripe v-loading="loading">
        <el-table-column prop="time" label="检测时间" min-width="180">
          <template #default="{ row }">
            {{ formatTime(row.time) }}
          </template>
        </el-table-column>
        <el-table-column prop="sensor_id" label="传感器ID" width="120" />
        <el-table-column prop="anomalyScore" label="异常分数" width="120">
          <template #default="{ row }">
            <el-tag :type="getScoreType(row.anomaly_score)" size="small">
              {{ row.anomaly_score?.toFixed(2) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="250" />
        <el-table-column prop="start_time" label="异常开始" min-width="180">
          <template #default="{ row }">
            {{ formatTime(row.start_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="end_time" label="异常结束" min-width="180">
          <template #default="{ row }">
            {{ formatTime(row.end_time) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row, $index }">
            <el-button type="danger" size="small" @click="deleteAnomaly($index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>异常统计</span>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="总异常数">
              <el-tag type="danger">{{ anomalyList.length }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="高风险异常">
              <el-tag type="danger">{{ highRiskCount }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="中风险异常">
              <el-tag type="warning">{{ mediumRiskCount }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="低风险异常">
              <el-tag type="info">{{ lowRiskCount }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>传感器异常分布</span>
          </template>
          <v-chart :option="sensorChartOption" style="height: 250px" autoresize />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { Refresh, Delete } from '@element-plus/icons-vue'
import axios from '../api/axios'

use([CanvasRenderer, PieChart, GridComponent, TooltipComponent, LegendComponent])

const anomalyList = ref([])
const loading = ref(false)

const highRiskCount = computed(() => anomalyList.value.filter(a => (a.anomaly_score || 0) > 70).length)
const mediumRiskCount = computed(() => anomalyList.value.filter(a => (a.anomaly_score || 0) > 40 && (a.anomaly_score || 0) <= 70).length)
const lowRiskCount = computed(() => anomalyList.value.filter(a => (a.anomaly_score || 0) <= 40).length)

const sensorChartOption = computed(() => {
  const sensorCounts = {}
  anomalyList.value.forEach(a => {
    const sensorId = a.sensor_id || 'unknown'
    sensorCounts[sensorId] = (sensorCounts[sensorId] || 0) + 1
  })

  const data = Object.entries(sensorCounts).map(([name, value]) => ({ name, value }))

  return {
    tooltip: {
      trigger: 'item'
    },
    legend: {
      bottom: '5%',
      left: 'center'
    },
    series: [
      {
        name: '异常数',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: data.length > 0 ? data : [{ name: '暂无数据', value: 1 }]
      }
    ]
  }
})

const getScoreType = (score) => {
  if (!score) return 'info'
  if (score > 70) return 'danger'
  if (score > 40) return 'warning'
  return 'info'
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

const refreshAnomalies = async () => {
  loading.value = true
  try {
    const response = await axios.get('/anomalies')
    anomalyList.value = response.data.events || []
  } catch (error) {
    console.error('加载异常记录失败:', error)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const deleteAnomaly = (index) => {
  ElMessageBox.confirm('确定要删除这条异常记录吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    anomalyList.value.splice(index, 1)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

onMounted(() => {
  refreshAnomalies()
})
</script>

<style scoped>
.anomalies {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
