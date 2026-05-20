<template>
  <div class="results-page">
    <h2 class="page-title">识别结果</h2>
    
    <el-card class="filter-card">
      <el-form :inline="true" :model="filters">
        <el-form-item label="设备ID">
          <el-input v-model="filters.deviceId" placeholder="请输入设备ID" style="width: 200px" />
        </el-form-item>
        <el-form-item label="病虫害类型">
          <el-select v-model="filters.pestType" placeholder="请选择类型" style="width: 150px" clearable>
            <el-option label="全部" value="" />
            <el-option label="蚜虫" value="aphid" />
            <el-option label="粉虱" value="whitefly" />
            <el-option label="蓟马" value="thrips" />
            <el-option label="红蜘蛛" value="spider_mite" />
            <el-option label="棉铃虫" value="bollworm" />
            <el-option label="健康" value="healthy" />
            <el-option label="未知" value="unknown" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadResults">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="results-card">
      <el-table :data="results" stripe style="width: 100%">
        <el-table-column prop="result_id" label="结果ID" width="180" />
        <el-table-column prop="edge_id" label="边缘节点" width="120" />
        <el-table-column prop="device_id" label="设备ID" width="120" />
        <el-table-column prop="pest_type" label="病虫害类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getPestTagType(row.pest_type)">
              {{ getPestName(row.pest_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="confidence" label="置信度" width="100">
          <template #default="{ row }">
            <el-progress :percentage="(row.confidence * 100)" :show-text="false" />
            {{ (row.confidence * 100).toFixed(1) }}%
          </template>
        </el-table-column>
        <el-table-column prop="model_type" label="模型类型" width="180" />
        <el-table-column prop="timestamp" label="识别时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.timestamp) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const results = ref([])
const filters = ref({
  deviceId: '',
  pestType: ''
})

const pestNames = {
  aphid: '蚜虫',
  whitefly: '粉虱',
  thrips: '蓟马',
  spider_mite: '红蜘蛛',
  bollworm: '棉铃虫',
  healthy: '健康',
  unknown: '未知'
}

const getPestName = (type) => pestNames[type] || type

const getPestTagType = (type) => {
  if (type === 'healthy') return 'success'
  if (type === 'unknown') return 'info'
  return 'danger'
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const loadResults = async () => {
  try {
    let url = '/api/v1/results?limit=50'
    if (filters.value.pestType) {
      url += `&pest_type=${filters.value.pestType}`
    }
    const res = await axios.get(url)
    results.value = res.data
  } catch (e) {
    console.error('Failed to load results:', e)
  }
}

const resetFilters = () => {
  filters.value = {
    deviceId: '',
    pestType: ''
  }
  loadResults()
}

onMounted(() => {
  loadResults()
})
</script>

<style scoped>
.results-page {
  height: 100%;
}

.page-title {
  margin-bottom: 20px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.filter-card {
  margin-bottom: 20px;
}

.results-card {
  margin-bottom: 20px;
}
</style>
