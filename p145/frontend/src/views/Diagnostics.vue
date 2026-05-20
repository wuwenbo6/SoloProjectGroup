<template>
  <div class="diagnostics">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>趋势预测 - 未来5分钟振动趋势</span>
              <el-button type="primary" size="small" @click="loadTrendPrediction" :loading="trendLoading">
                <el-icon><Refresh /></el-icon>
                刷新预测
              </el-button>
            </div>
          </template>
          <v-chart :option="trendChartOption" style="height: 350px" autoresize />
          <el-descriptions :column="4" border style="margin-top: 20px">
            <el-descriptions-item label="趋势方向">
              <el-tag :type="getTrendTypeColor(trendSummary.direction)">{{ getTrendDirectionText(trendSummary.direction) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="预测均值">{{ trendSummary.mean_value?.toFixed(2) || '-' }} mm/s</el-descriptions-item>
            <el-descriptions-item label="预测最大值">{{ trendSummary.max_value?.toFixed(2) || '-' }} mm/s</el-descriptions-item>
            <el-descriptions-item label="异常风险">
              <el-tag :type="getRiskColor(trendSummary.anomaly_risk)">{{ getRiskText(trendSummary.anomaly_risk) }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>故障诊断分析</span>
              <el-button type="primary" size="small" @click="loadFaultClassification" :loading="faultLoading">
                <el-icon><Refresh /></el-icon>
                刷新诊断
              </el-button>
            </div>
          </template>
          
          <el-row v-if="faultData.primary_fault" :gutter="20">
            <el-col :span="8">
              <div class="fault-summary">
                <div class="fault-status" :class="{'fault-detected': faultData.fault_detected, 'no-fault': !faultData.fault_detected}">
                  <el-icon :size="48" :color="faultData.fault_detected ? '#f56c6c' : '#67c23a'">
                    <component :is="faultData.fault_detected ? Warning : CircleCheck" />
                  </el-icon>
                  <h3>{{ faultData.fault_detected ? '检测到潜在故障' : '设备运行正常' }}</h3>
                </div>
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="故障类型">
                    <strong>{{ faultData.primary_fault?.name || '正常' }}</strong>
                  </el-descriptions-item>
                  <el-descriptions-item label="置信度">
                    <el-progress :percentage="Math.round((faultData.primary_fault?.confidence || 0) * 100)" :color="getConfidenceColor(faultData.primary_fault?.confidence)" />
                  </el-descriptions-item>
                  <el-descriptions-item label="严重程度">
                    <el-tag :type="getSeverityColor(faultData.primary_fault?.severity)">{{ faultData.primary_fault?.severity || '正常' }}</el-tag>
                  </el-descriptions-item>
                </el-descriptions>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="fault-description">
                <h4>故障描述</h4>
                <p>{{ faultData.primary_fault?.description || '设备运行正常，未检测到异常特征。' }}</p>
                <h4 style="margin-top: 20px">次要指标</h4>
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="轴承磨损概率">
                    <el-progress :percentage="Math.round((faultData.secondary_indicators?.bearing_wear_probability || 0) * 100)" :stroke-width="12" color="#e6a23c" />
                  </el-descriptions-item>
                  <el-descriptions-item label="不对中概率">
                    <el-progress :percentage="Math.round((faultData.secondary_indicators?.misalignment_probability || 0) * 100)" :stroke-width="12" color="#f56c6c" />
                  </el-descriptions-item>
                </el-descriptions>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="fault-recommendations">
                <h4>维护建议</h4>
                <el-timeline>
                  <el-timeline-item
                    v-for="(rec, index) in faultData.recommendations || ['继续监控设备状态', '定期维护保养']"
                    :key="index"
                    :type="faultData.fault_detected ? 'danger' : 'success'"
                    :timestamp="`建议 ${index + 1}`"
                  >
                    {{ rec }}
                  </el-timeline-item>
                </el-timeline>
              </div>
            </el-col>
          </el-row>
          
          <div v-else class="empty-state">
            <el-empty description="请点击刷新诊断按钮进行故障分析" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>故障概率分布</span>
          </template>
          <v-chart :option="faultPieOption" style="height: 300px" autoresize />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>特征参数分析</span>
          </template>
          <el-table :data="featureTableData" stripe style="width: 100%">
            <el-table-column prop="name" label="特征名称" />
            <el-table-column prop="value" label="数值">
              <template #default="{ row }">
                {{ row.value.toFixed(4) }}
              </template>
            </el-table-column>
          </el-table>
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
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { Refresh, Warning, CircleCheck } from '@element-plus/icons-vue'
import axios from '../api/axios'

use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps({
  sensorId: {
    type: String,
    default: 'sensor_001'
  }
})

const trendLoading = ref(false)
const faultLoading = ref(false)
const trendData = ref([])
const trendSummary = ref({})
const faultData = ref({})

const trendChartOption = computed(() => {
  const times = trendData.value.map(d => d.time.split('T')[1]?.substring(0, 8) || d.time.substring(11, 19))
  const values = trendData.value.map(d => d.vibration)

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0]
        return `时间: ${p.name}<br/>振动: ${p.value.toFixed(3)} mm/s`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: times,
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: '振动 (mm/s)',
      min: Math.max(0, Math.min(...values) * 0.8),
      max: Math.max(...values) * 1.2
    },
    series: [
      {
        name: '预测振动值',
        type: 'line',
        smooth: true,
        data: values,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(102, 126, 234, 0.4)' },
              { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
            ]
          }
        },
        lineStyle: {
          color: '#667eea',
          width: 2,
          type: 'dashed'
        },
        itemStyle: { color: '#667eea' }
      }
    ]
  }
})

const faultPieOption = computed(() => {
  const probs = faultData.value.all_probabilities || {}
  const data = Object.entries(probs).map(([name, value]) => ({
    name: getFaultNameCN(name),
    value: (value * 100).toFixed(1)
  }))

  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}% ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '故障概率',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}: {c}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: true
        },
        data: data.length > 0 ? data : [
          { name: '正常', value: 100 },
          { name: '轴承磨损', value: 0 },
          { name: '不对中', value: 0 },
          { name: '不平衡', value: 0 },
          { name: '松动', value: 0 }
        ]
      }
    ]
  }
})

const featureTableData = computed(() => {
  const features = faultData.value.raw_features || {}
  return Object.entries(features).map(([name, value]) => ({
    name: getFeatureNameCN(name),
    value: value
  }))
})

const getTrendDirectionText = (direction) => {
  const map = {
    'rising': '上升趋势',
    'falling': '下降趋势',
    'stable': '稳定',
    'unknown': '未知'
  }
  return map[direction] || '未知'
}

const getTrendTypeColor = (direction) => {
  const map = {
    'rising': 'warning',
    'falling': 'info',
    'stable': 'success',
    'unknown': 'info'
  }
  return map[direction] || 'info'
}

const getRiskText = (risk) => {
  const map = {
    'low': '低风险',
    'medium': '中风险',
    'high': '高风险',
    'unknown': '未知'
  }
  return map[risk] || '未知'
}

const getRiskColor = (risk) => {
  const map = {
    'low': 'success',
    'medium': 'warning',
    'high': 'danger',
    'unknown': 'info'
  }
  return map[risk] || 'info'
}

const getSeverityColor = (severity) => {
  const map = {
    '正常': 'success',
    '中等': 'warning',
    '高': 'danger',
    '严重': 'danger'
  }
  return map[severity] || 'info'
}

const getConfidenceColor = (confidence) => {
  if (confidence > 0.8) return '#f56c6c'
  if (confidence > 0.5) return '#e6a23c'
  return '#67c23a'
}

const getFaultNameCN = (name) => {
  const map = {
    'normal': '正常',
    'bearing_wear': '轴承磨损',
    'misalignment': '不对中',
    'imbalance': '不平衡',
    'looseness': '松动'
  }
  return map[name] || name
}

const getFeatureNameCN = (name) => {
  const map = {
    'rms': 'RMS有效值',
    'peak': '峰值',
    'crest_factor': '波峰因子',
    'kurtosis': '峭度',
    'skewness': '偏度',
    'peak_to_peak': '峰峰值',
    'margin_factor': '裕度因子',
    'impulse_factor': '脉冲因子',
    'freq_peak_1': '主频1',
    'freq_peak_2': '主频2',
    'freq_peak_3': '主频3',
    'harmonic_ratio': '谐波比',
    'swing_rms': '摆度RMS',
    'temp_rms': '温度RMS',
    'temp_trend': '温度趋势'
  }
  return map[name] || name
}

const loadTrendPrediction = async () => {
  trendLoading.value = true
  try {
    const response = await axios.get(`/trend/predict/${props.sensorId}?minutes=5`)
    trendData.value = response.data.data.predicted_values || []
    trendSummary.value = response.data.data.trend_analysis || {}
  } catch (error) {
    console.error('加载趋势预测失败:', error)
    ElMessage.error('加载趋势预测失败')
  } finally {
    trendLoading.value = false
  }
}

const loadFaultClassification = async () => {
  faultLoading.value = true
  try {
    const response = await axios.get(`/fault/classify/${props.sensorId}?duration_minutes=5`)
    faultData.value = response.data.data || {}
  } catch (error) {
    console.error('加载故障诊断失败:', error)
    ElMessage.error('加载故障诊断失败')
  } finally {
    faultLoading.value = false
  }
}

onMounted(() => {
  loadTrendPrediction()
  loadFaultClassification()
})
</script>

<style scoped>
.diagnostics {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fault-summary, .fault-description, .fault-recommendations {
  padding: 10px;
}

.fault-status {
  text-align: center;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 8px;
}

.fault-detected {
  background: #fef0f0;
}

.no-fault {
  background: #f0f9eb;
}

.fault-status h3 {
  margin-top: 10px;
}

.empty-state {
  padding: 40px;
  text-align: center;
}
</style>