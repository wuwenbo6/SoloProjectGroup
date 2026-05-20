<template>
  <div class="history-page">
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon size="32" color="#38bdf8"><Monitor /></el-icon>
          <h1>竹编缺陷检测 - 历史数据</h1>
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
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon><Search /></el-icon>
              <span>查询条件</span>
            </div>
          </template>
          <el-form :model="queryParams" inline>
            <el-form-item label="开始日期">
              <el-date-picker
                v-model="queryParams.startDate"
                type="date"
                placeholder="选择开始日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
            <el-form-item label="结束日期">
              <el-date-picker
                v-model="queryParams.endDate"
                type="date"
                placeholder="选择结束日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
            <el-form-item label="缺陷等级">
              <el-select v-model="queryParams.level" placeholder="选择等级" clearable>
                <el-option label="全部" value="" />
                <el-option label="轻微" :value="1" />
                <el-option label="一般" :value="2" />
                <el-option label="严重" :value="3" />
              </el-select>
            </el-form-item>
            <el-form-item label="缺陷类型">
              <el-select v-model="queryParams.type" placeholder="选择类型" clearable>
                <el-option label="全部" value="" />
                <el-option label="断丝" value="断丝" />
                <el-option label="错位" value="错位" />
                <el-option label="漏织" value="漏织" />
                <el-option label="污渍" value="污渍" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
            <el-form-item label="处理状态">
              <el-select v-model="queryParams.handled" placeholder="选择状态" clearable>
                <el-option label="全部" :value="" />
                <el-option label="待处理" :value="false" />
                <el-option label="已处理" :value="true" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleQuery">
                <el-icon><Search /></el-icon>
                查询
              </el-button>
              <el-button @click="handleReset">
                <el-icon><Refresh /></el-icon>
                重置
              </el-button>
              <el-button type="success" @click="handleExport">
                <el-icon><Download /></el-icon>
                导出
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <el-icon><List /></el-icon>
              <span>检测记录</span>
              <span style="margin-left: auto; color: #94a3b8; font-size: 14px;">
                共 {{ total }} 条记录
              </span>
            </div>
          </template>
          <el-table :data="tableData" stripe style="width: 100%" @selection-change="handleSelectionChange">
            <el-table-column type="selection" width="55" />
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="timestamp" label="检测时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.timestamp) }}
              </template>
            </el-table-column>
            <el-table-column prop="productId" label="产品编号" width="120" />
            <el-table-column prop="defectCount" label="缺陷数量" width="100">
              <template #default="{ row }">
                <el-tag :type="row.defectCount > 0 ? 'danger' : 'success'" size="small">
                  {{ row.defectCount }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="缺陷详情">
              <template #default="{ row }">
                <div v-if="row.defects && row.defects.length > 0">
                  <el-tag
                    v-for="defect in row.defects"
                    :key="defect.id"
                    :type="getLevelTagType(defect.level)"
                    size="small"
                    style="margin-right: 4px; margin-bottom: 4px;"
                  >
                    {{ defect.type }}({{ getDefectLevelText(defect.level) }})
                  </el-tag>
                </div>
                <span v-else style="color: #22c55e;">合格</span>
              </template>
            </el-table-column>
            <el-table-column prop="operator" label="操作员" width="100" />
            <el-table-column label="处理状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.handled ? 'success' : 'warning'" size="small">
                  {{ row.handled ? '已处理' : '待处理' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="handleViewDetail(row)">
                  <el-icon><View /></el-icon>
                  查看
                </el-button>
                <el-button
                  v-if="!row.handled"
                  type="success"
                  size="small"
                  @click="handleMarkHandled(row)"
                >
                  <el-icon><Check /></el-icon>
                  标记处理
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          
          <div style="margin-top: 20px; text-align: right;">
            <el-pagination
              v-model:current-page="queryParams.page"
              v-model:page-size="queryParams.pageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="total"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
            />
          </div>
        </el-card>
      </el-main>
    </el-container>

    <el-dialog
      v-model="detailDialogVisible"
      title="检测详情"
      width="800px"
    >
      <div v-if="currentDetail" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="检测ID">{{ currentDetail.id }}</el-descriptions-item>
          <el-descriptions-item label="检测时间">{{ formatTime(currentDetail.timestamp) }}</el-descriptions-item>
          <el-descriptions-item label="产品编号">{{ currentDetail.productId }}</el-descriptions-item>
          <el-descriptions-item label="操作员">{{ currentDetail.operator }}</el-descriptions-item>
          <el-descriptions-item label="缺陷数量">{{ currentDetail.defectCount }}</el-descriptions-item>
          <el-descriptions-item label="处理状态">
            <el-tag :type="currentDetail.handled ? 'success' : 'warning'">
              {{ currentDetail.handled ? '已处理' : '待处理' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 20px 0 10px;">缺陷列表</h4>
        <el-table v-if="currentDetail.defects && currentDetail.defects.length > 0" :data="currentDetail.defects" stripe>
          <el-table-column prop="type" label="缺陷类型" />
          <el-table-column prop="level" label="等级">
            <template #default="{ row }">
              <el-tag :type="getLevelTagType(row.level)" size="small">
                {{ getDefectLevelText(row.level) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="positionX" label="位置X">
            <template #default="{ row }">{{ row.positionX.toFixed(2) }}%</template>
          </el-table-column>
          <el-table-column prop="positionY" label="位置Y">
            <template #default="{ row }">{{ row.positionY.toFixed(2) }}%</template>
          </el-table-column>
          <el-table-column prop="confidence" label="置信度">
            <template #default="{ row }">{{ (row.confidence * 100).toFixed(1) }}%</template>
          </el-table-column>
          <el-table-column prop="size" label="尺寸(mm)" />
        </el-table>
        <el-empty v-else description="无缺陷记录" />
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { detectionApi } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const activeMenu = ref('history')
const tableData = ref([])
const total = ref(0)
const detailDialogVisible = ref(false)
const currentDetail = ref(null)
const selectedRows = ref([])

const queryParams = reactive({
  startDate: '',
  endDate: '',
  level: '',
  type: '',
  handled: '',
  page: 1,
  pageSize: 10
})

const handleMenuSelect = (index) => {
  router.push('/' + index)
}

const getLevelTagType = (level) => {
  const types = { 1: 'success', 2: 'warning', 3: 'danger' }
  return types[level] || 'info'
}

const getDefectLevelText = (level) => {
  const texts = { 1: '轻微', 2: '一般', 3: '严重' }
  return texts[level] || '未知'
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const loadData = async () => {
  try {
    const mockData = generateMockData(queryParams.pageSize)
    tableData.value = mockData
    total.value = 156
  } catch (error) {
    console.error('Load data error:', error)
  }
}

const generateMockData = (count) => {
  const defectTypes = ['断丝', '错位', '漏织', '污渍', '其他']
  const data = []
  
  for (let i = 0; i < count; i++) {
    const hasDefect = Math.random() > 0.3
    const defects = []
    
    if (hasDefect) {
      const defectCount = Math.floor(Math.random() * 3) + 1
      for (let j = 0; j < defectCount; j++) {
        defects.push({
          id: Date.now() + j,
          type: defectTypes[Math.floor(Math.random() * defectTypes.length)],
          level: Math.floor(Math.random() * 3) + 1,
          positionX: Math.random() * 100,
          positionY: Math.random() * 100,
          confidence: 0.7 + Math.random() * 0.3,
          size: (Math.random() * 10 + 1).toFixed(1)
        })
      }
    }
    
    data.push({
      id: (queryParams.page - 1) * queryParams.pageSize + i + 1,
      timestamp: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
      productId: `BAM-${String(Math.floor(Math.random() * 10000)).padStart(5, '0')}`,
      defectCount: defects.length,
      defects: defects,
      operator: ['张三', '李四', '王五'][Math.floor(Math.random() * 3)],
      handled: Math.random() > 0.5
    })
  }
  
  return data
}

const handleQuery = () => {
  queryParams.page = 1
  loadData()
  ElMessage.success('查询成功')
}

const handleReset = () => {
  queryParams.startDate = ''
  queryParams.endDate = ''
  queryParams.level = ''
  queryParams.type = ''
  queryParams.handled = ''
  queryParams.page = 1
  loadData()
}

const handleExport = () => {
  ElMessage.success('导出功能开发中...')
}

const handleSelectionChange = (selection) => {
  selectedRows.value = selection
}

const handleSizeChange = (size) => {
  queryParams.pageSize = size
  loadData()
}

const handleCurrentChange = (page) => {
  queryParams.page = page
  loadData()
}

const handleViewDetail = (row) => {
  currentDetail.value = row
  detailDialogVisible.value = true
}

const handleMarkHandled = async (row) => {
  try {
    await ElMessageBox.confirm('确定标记为已处理吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    row.handled = true
    ElMessage.success('标记成功')
  } catch {
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.history-page {
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
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-form-item__label) {
  color: #94a3b8 !important;
}

:deep(.el-descriptions__label) {
  background: rgba(30, 41, 59, 0.8) !important;
  color: #94a3b8 !important;
}

:deep(.el-descriptions__body) {
  background: rgba(15, 23, 42, 0.5) !important;
  color: #e2e8f0 !important;
}

.detail-content {
  h4 {
    color: #38bdf8;
  }
}
</style>
