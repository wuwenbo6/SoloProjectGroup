<template>
  <div class="history-container">
    <div class="page-header">
      <h1>历史数据查询</h1>
    </div>

    <div class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="采集时间">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item label="质量等级">
          <el-select v-model="filters.qualityLevel" placeholder="请选择" clearable>
            <el-option label="A级" value="A" />
            <el-option label="B级" value="B" />
            <el-option label="C级" value="C" />
            <el-option label="D级" value="D" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="编号/名称" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
      <div class="export-actions">
        <el-button type="success" :icon="Download" @click="handleExportExcel">
          导出Excel
        </el-button>
        <el-button :icon="Document" @click="handleExportCSV">
          导出CSV
        </el-button>
      </div>
    </div>

    <div class="content-card">
      <el-table :data="tableData" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="rubbingId" label="拓片编号" width="120" />
        <el-table-column prop="name" label="拓片名称" width="150" />
        <el-table-column prop="captureTime" label="采集时间" width="180" />
        <el-table-column prop="resolution" label="分辨率" width="120">
          <template #default="{ row }">
            {{ row.resolutionWidth }} x {{ row.resolutionHeight }}
          </template>
        </el-table-column>
        <el-table-column prop="qualityScore" label="质量评分" width="100">
          <template #default="{ row }">
            <el-tag :type="getQualityType(row.qualityScore)">
              {{ row.qualityScore }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="qualityLevel" label="等级" width="80">
          <template #default="{ row }">
            <el-tag :type="getLevelType(row.qualityLevel)">
              {{ row.qualityLevel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fileSize" label="文件大小" width="100" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="handleView(row)">查看</el-button>
            <el-button size="small" @click="handleDownload(row)">下载</el-button>
            <el-button size="small" type="success" @click="handleArchive(row)">归档</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSearch"
          @current-change="handleSearch"
        />
      </div>
    </div>

    <el-dialog v-model="detailVisible" title="拓片详情" width="800px">
      <div v-if="currentDetail" class="detail-content">
        <div class="detail-image">
          <img :src="currentDetail.imageUrl" alt="拓片图像" />
        </div>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="拓片编号">{{ currentDetail.rubbingId }}</el-descriptions-item>
          <el-descriptions-item label="拓片名称">{{ currentDetail.name }}</el-descriptions-item>
          <el-descriptions-item label="采集时间">{{ currentDetail.captureTime }}</el-descriptions-item>
          <el-descriptions-item label="分辨率">{{ currentDetail.resolutionWidth }} x {{ currentDetail.resolutionHeight }}</el-descriptions-item>
          <el-descriptions-item label="质量评分">{{ currentDetail.qualityScore }}</el-descriptions-item>
          <el-descriptions-item label="质量等级">
            <el-tag :type="getLevelType(currentDetail.qualityLevel)">
              {{ currentDetail.qualityLevel }}级
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="文件大小">{{ currentDetail.fileSize }}</el-descriptions-item>
          <el-descriptions-item label="文件格式">{{ currentDetail.fileFormat }}</el-descriptions-item>
          <el-descriptions-item label="DPI">{{ currentDetail.dpi }}</el-descriptions-item>
          <el-descriptions-item label="色彩深度">{{ currentDetail.colorDepth }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Document } from '@element-plus/icons-vue'
import { useRubbingStore } from '@/stores/rubbing'

const store = useRubbingStore()

const filters = reactive({
  qualityLevel: '',
  keyword: ''
})

const dateRange = ref(null)

const pagination = reactive({
  page: 1,
  size: 10,
  total: 0
})

const tableData = ref([])
const detailVisible = ref(false)
const currentDetail = ref(null)

const getQualityType = (score) => {
  if (score >= 90) return 'success'
  if (score >= 70) return ''
  if (score >= 60) return 'warning'
  return 'danger'
}

const getLevelType = (level) => {
  const map = { A: 'success', B: '', C: 'warning', D: 'danger' }
  return map[level] || ''
}

const handleSearch = () => {
  const mockData = Array.from({ length: 10 }, (_, i) => ({
    id: pagination.page * 10 + i + 1,
    rubbingId: `TP${String(pagination.page * 10 + i + 1).padStart(6, '0')}`,
    name: `拓片样本${pagination.page * 10 + i + 1}`,
    captureTime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleString(),
    resolutionWidth: 4000 + Math.floor(Math.random() * 1000),
    resolutionHeight: 6000 + Math.floor(Math.random() * 1000),
    qualityScore: 60 + Math.floor(Math.random() * 40),
    qualityLevel: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
    fileSize: (Math.random() * 50 + 10).toFixed(1) + ' MB',
    fileFormat: 'TIFF',
    dpi: 400,
    colorDepth: '24位',
    imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmN2ZhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5MDkzOTkiPuaVsOeJh+WbvuWDtw==PC90ZXh0Pjwvc3ZnPg=='
  }))
  tableData.value = mockData
  pagination.total = 156
}

const handleReset = () => {
  filters.qualityLevel = ''
  filters.keyword = ''
  dateRange.value = null
  pagination.page = 1
  handleSearch()
}

const handleView = (row) => {
  currentDetail.value = row
  detailVisible.value = true
}

const handleDownload = (row) => {
  ElMessage.success(`开始下载: ${row.name}`)
}

const handleArchive = (row) => {
  ElMessage.success(`已将 ${row.name} 加入归档`)
}

const handleExportExcel = async () => {
  try {
    const params = {
      qualityLevel: filters.qualityLevel,
      keyword: filters.keyword
    }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startTime = dateRange.value[0].toISOString()
      params.endTime = dateRange.value[1].toISOString()
    }
    
    const res = await store.exportExcel(params)
    const blob = new Blob([res], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `拓片报表_${new Date().toISOString().slice(0, 10)}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success('Excel导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

const handleExportCSV = async () => {
  try {
    const params = {
      qualityLevel: filters.qualityLevel,
      keyword: filters.keyword
    }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startTime = dateRange.value[0].toISOString()
      params.endTime = dateRange.value[1].toISOString()
    }
    
    const res = await store.exportCSV(params)
    const blob = new Blob([res], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `拓片报表_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success('CSV导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  handleSearch()
})
</script>

<style scoped>
.history-container {
  padding: 20px;
  min-height: 100vh;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 28px;
  color: #303133;
}

.filter-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.export-actions {
  display: flex;
  gap: 10px;
}

.filter-card,
.content-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.filter-form {
  margin-bottom: 0;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.detail-image {
  width: 100%;
  height: 300px;
  background: #f5f7fa;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  overflow: hidden;
}

.detail-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
