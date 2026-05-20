<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">多批次对比分析</div>
    </div>

    <el-card style="margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <el-input
          v-model="newBatchNo"
          placeholder="输入批次号"
          style="width: 200px;"
          @keyup.enter="addBatchNo"
        />
        <el-button type="primary" @click="addBatchNo">添加批次</el-button>
        <el-divider direction="vertical" />
        <span style="color: #666;">已选择批次：</span>
        <el-tag
          v-for="batchNo in batchNos"
          :key="batchNo"
          closable
          @close="removeBatchNo(batchNo)"
        >
          {{ batchNo }}
        </el-tag>
        <el-button
          type="success"
          @click="loadAnalysis"
          :disabled="batchNos.length < 2"
          style="margin-left: 20px;"
        >
          开始对比分析
        </el-button>
      </div>
    </el-card>

    <el-row :gutter="20" v-if="analysisData">
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 32px; color: #409EFF; font-weight: bold;">
              {{ analysisData.averageMetrics?.avgProgress || 0 }}%
            </div>
            <div style="color: #666; margin-top: 5px;">平均进度</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 32px; color: #67C23A; font-weight: bold;">
              {{ analysisData.averageMetrics?.avgQualityScore || 0 }}
            </div>
            <div style="color: #666; margin-top: 5px;">平均质量分</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 32px; color: #E6A23C; font-weight: bold;">
              {{ analysisData.averageMetrics?.avgAbnormalRate || 0 }}%
            </div>
            <div style="color: #666; margin-top: 5px;">平均异常率</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 32px; color: #F56C6C; font-weight: bold;">
              {{ analysisData.averageMetrics?.avgDurationMinutes || 0 }}
            </div>
            <div style="color: #666; margin-top: 5px;">平均耗时(分钟)</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;" v-if="analysisData">
      <el-col :span="12">
        <el-card title="各批次对比图表">
          <div ref="chartContainer" style="width: 100%; height: 400px;"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card title="最佳/最差对比">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="质量最佳批次">
              <el-tag type="success">{{ analysisData.comparisons?.bestQualityBatch }}</el-tag>
              <span style="margin-left: 10px;">得分：{{ analysisData.comparisons?.bestQualityScore }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="进度最快批次">
              <el-tag type="primary">{{ analysisData.comparisons?.bestProgressBatch }}</el-tag>
              <span style="margin-left: 10px;">进度：{{ analysisData.comparisons?.bestProgressRate }}%</span>
            </el-descriptions-item>
            <el-descriptions-item label="异常率最低批次">
              <el-tag type="warning">{{ analysisData.comparisons?.lowestAbnormalBatch }}</el-tag>
              <span style="margin-left: 10px;">异常率：{{ analysisData.comparisons?.lowestAbnormalRate }}%</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px;" title="批次详细数据" v-if="analysisData">
      <el-table :data="analysisData.batchData" border stripe>
        <el-table-column prop="batchNo" label="批次号" width="120" />
        <el-table-column prop="progress" label="进度(%)" width="100">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :stroke-width="10" />
          </template>
        </el-table-column>
        <el-table-column prop="qualityScore" label="质量分" width="100">
          <template #default="{ row }">
            <el-tag :type="getQualityScoreType(row.qualityScore)">{{ row.qualityScore }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="qualityLevel" label="质量等级" width="100">
          <template #default="{ row }">
            <el-tag :type="getQualityLevelType(row.qualityLevel)">{{ row.qualityLevel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="completedProcess" label="完成工序" width="100" />
        <el-table-column prop="abnormalCount" label="异常数" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.abnormalCount > 0" type="danger" size="small">{{ row.abnormalCount }}</el-tag>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="abnormalRate" label="异常率(%)" width="100">
          <template #default="{ row }">{{ row.abnormalRate?.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="totalDurationMinutes" label="总耗时(分钟)" width="120" />
        <el-table-column prop="craftsmanCount" label="工匠数" width="80" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import request from '../utils/request'

const newBatchNo = ref('')
const batchNos = ref(['BATCH001', 'BATCH002', 'BATCH003'])
const analysisData = ref(null)
let chart = null

const addBatchNo = () => {
  if (!newBatchNo.value.trim()) {
    ElMessage.warning('请输入批次号')
    return
  }
  if (batchNos.value.includes(newBatchNo.value.trim())) {
    ElMessage.warning('该批次已添加')
    return
  }
  batchNos.value.push(newBatchNo.value.trim())
  newBatchNo.value = ''
}

const removeBatchNo = (batchNo) => {
  const index = batchNos.value.indexOf(batchNo)
  if (index > -1) {
    batchNos.value.splice(index, 1)
  }
}

const loadAnalysis = async () => {
  if (batchNos.value.length < 2) {
    ElMessage.warning('请至少选择2个批次进行对比')
    return
  }

  try {
    const res = await request({
      url: '/analysis/compare-batches',
      method: 'post',
      data: { batchNos: batchNos.value }
    })
    analysisData.value = res.data
    ElMessage.success('对比分析完成')
    await nextTick()
    renderChart()
  } catch (error) {
    console.error('对比分析失败:', error)
  }
}

const renderChart = () => {
  const container = document.querySelector('[ref="chartContainer"]')
  if (!container) return

  if (chart) {
    chart.dispose()
  }

  chart = echarts.init(container)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: ['进度', '质量分', '异常率', '耗时(分钟)']
    },
    xAxis: {
      type: 'category',
      data: analysisData.value.chartData?.labels || []
    },
    yAxis: [
      {
        type: 'value',
        name: '百分比',
        max: 100,
        axisLabel: {
          formatter: '{value}%'
        }
      },
      {
        type: 'value',
        name: '分钟',
        axisLabel: {
          formatter: '{value}min'
        }
      }
    ],
    series: [
      {
        name: '进度',
        type: 'bar',
        data: analysisData.value.chartData?.progressData || [],
        itemStyle: { color: '#409EFF' }
      },
      {
        name: '质量分',
        type: 'bar',
        data: analysisData.value.chartData?.qualityData || [],
        itemStyle: { color: '#67C23A' }
      },
      {
        name: '异常率',
        type: 'line',
        yAxisIndex: 0,
        data: analysisData.value.chartData?.abnormalData || [],
        itemStyle: { color: '#E6A23C' }
      },
      {
        name: '耗时(分钟)',
        type: 'line',
        yAxisIndex: 1,
        data: analysisData.value.chartData?.durationData || [],
        itemStyle: { color: '#F56C6C' }
      }
    ]
  }

  chart.setOption(option)

  window.addEventListener('resize', () => {
    chart?.resize()
  })
}

const getQualityScoreType = (score) => {
  if (score >= 90) return 'success'
  if (score >= 75) return 'warning'
  if (score >= 60) return 'info'
  return 'danger'
}

const getQualityLevelType = (level) => {
  const map = {
    'EXCELLENT': 'success',
    'GOOD': 'warning',
    'PASS': 'info',
    'FAIL': 'danger'
  }
  return map[level] || 'info'
}
</script>
