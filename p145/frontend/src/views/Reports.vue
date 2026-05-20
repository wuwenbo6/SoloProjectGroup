<template>
  <div class="reports">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>生成运维报告</span>
            </div>
          </template>
          
          <el-form :inline="true" :model="reportForm" class="report-form">
            <el-form-item label="传感器">
              <el-select v-model="reportForm.sensorId" style="width: 200px">
                <el-option label="sensor_001" value="sensor_001" />
                <el-option label="sensor_002" value="sensor_002" />
                <el-option label="sensor_003" value="sensor_003" />
              </el-select>
            </el-form-item>
            <el-form-item label="报告类型">
              <el-select v-model="reportForm.type" style="width: 200px">
                <el-option label="日报（24小时）" value="daily" />
                <el-option label="周报（7天）" value="weekly" />
                <el-option label="小时报（1小时）" value="hourly" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="generateReport" :loading="generating">
                <el-icon><DocumentAdd /></el-icon>
                生成报告
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
            <div class="card-header">
              <span>历史报告列表</span>
              <el-button type="primary" size="small" @click="loadReports" :loading="loading">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>

          <el-table :data="reports" stripe v-loading="loading">
            <el-table-column type="index" label="序号" width="80" />
            <el-table-column prop="filename" label="报告名称" min-width="280" />
            <el-table-column prop="created_at" label="生成时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column prop="size_kb" label="大小" width="100">
              <template #default="{ row }">
                {{ row.size_kb }} KB
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="downloadReport(row.filename)">
                  <el-icon><Download /></el-icon>
                  下载
                </el-button>
                <el-button type="success" size="small" @click="previewReport(row.filename)">
                  <el-icon><View /></el-icon>
                  预览
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="reports.length === 0 && !loading" description="暂无报告，请点击上方按钮生成" />
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="previewVisible" title="报告预览" width="90%" top="5vh">
      <div class="preview-container">
        <iframe v-if="previewUrl" :src="previewUrl" style="width: 100%; height: 70vh; border: none" />
        <el-empty v-else description="加载中..." />
      </div>
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
        <el-button type="primary" @click="downloadReport(currentPreviewFile)">下载报告</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Refresh, DocumentAdd, Download, View } from '@element-plus/icons-vue'
import axios from '../api/axios'

const loading = ref(false)
const generating = ref(false)
const reports = ref([])
const previewVisible = ref(false)
const previewUrl = ref('')
const currentPreviewFile = ref('')

const reportForm = ref({
  sensorId: 'sensor_001',
  type: 'daily'
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const loadReports = async () => {
  loading.value = true
  try {
    const response = await axios.get('/report/list')
    reports.value = response.data.reports || []
  } catch (error) {
    console.error('加载报告列表失败:', error)
    ElMessage.error('加载报告列表失败')
  } finally {
    loading.value = false
  }
}

const generateReport = async () => {
  generating.value = true
  try {
    const response = await axios.post(`/report/generate/${reportForm.value.sensorId}?report_type=${reportForm.value.type}`)
    
    if (response.data.success) {
      ElMessage.success('报告生成成功！')
      await loadReports()
    } else {
      ElMessage.error('报告生成失败')
    }
  } catch (error) {
    console.error('生成报告失败:', error)
    ElMessage.error('生成报告失败: ' + (error.response?.data?.detail || error.message))
  } finally {
    generating.value = false
  }
}

const downloadReport = (filename) => {
  window.open(`/api/report/download/${filename}`, '_blank')
}

const previewReport = (filename) => {
  currentPreviewFile.value = filename
  previewUrl.value = `/api/report/download/${filename}#toolbar=1&navpanes=0&scrollbar=1`
  previewVisible.value = true
}

onMounted(() => {
  loadReports()
})
</script>

<style scoped>
.reports {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.report-form {
  margin: 0;
}

.preview-container {
  min-height: 600px;
}
</style>