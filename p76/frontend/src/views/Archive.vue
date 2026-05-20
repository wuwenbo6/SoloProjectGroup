<template>
  <div class="archive-container">
    <div class="page-header">
      <h1>拓片分级归档</h1>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon" style="background: #409eff">
          <el-icon size="28"><Collection /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">总归档数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #67c23a">
          <el-icon size="28"><Medal /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.levelA }}</div>
          <div class="stat-label">A级藏品</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #e6a23c">
          <el-icon size="28"><Trophy /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.levelB }}</div>
          <div class="stat-label">B级藏品</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #909399">
          <el-icon size="28"><FolderOpened /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.levelC + stats.levelD }}</div>
          <div class="stat-label">C/D级藏品</div>
        </div>
      </div>
    </div>

    <div class="content-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="A级归档" name="A">
          <template #label>
            <span><el-icon><Star /></el-icon> A级归档</span>
          </template>
        </el-tab-pane>
        <el-tab-pane label="B级归档" name="B">
          <template #label>
            <span><el-icon><StarFilled /></el-icon> B级归档</span>
          </template>
        </el-tab-pane>
        <el-tab-pane label="C级归档" name="C">
          <template #label>
            <span><el-icon><Stars /></el-icon> C级归档</span>
          </template>
        </el-tab-pane>
        <el-tab-pane label="D级归档" name="D">
          <template #label>
            <span><el-icon><Folder /></el-icon> D级归档</span>
          </template>
        </el-tab-pane>
      </el-tabs>

      <el-table :data="tableData" border stripe style="margin-top: 20px">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="rubbingId" label="拓片编号" width="120" />
        <el-table-column prop="name" label="拓片名称" width="150" />
        <el-table-column prop="dynasty" label="所属朝代" width="100" />
        <el-table-column prop="archiveTime" label="归档时间" width="180" />
        <el-table-column prop="archiveLevel" label="归档等级" width="100">
          <template #default="{ row }">
            <el-tag :type="getLevelType(row.archiveLevel)">
              {{ row.archiveLevel }}级
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="location" label="存储位置" width="150" />
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="handleView(row)">查看</el-button>
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-button type="warning" size="small" style="margin-right: 10px" @click="handleBatchUpdate">
          批量调整等级
        </el-button>
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadData"
          @current-change="loadData"
        />
      </div>
    </div>

    <el-dialog v-model="editVisible" :title="editMode ? '编辑归档' : '查看详情'" width="700px">
      <el-form :model="form" label-width="100px" v-if="form">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="拓片编号">
              <el-input v-model="form.rubbingId" :disabled="!editMode" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="拓片名称">
              <el-input v-model="form.name" :disabled="!editMode" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属朝代">
              <el-select v-model="form.dynasty" :disabled="!editMode" style="width: 100%">
                <el-option label="先秦" value="先秦" />
                <el-option label="秦汉" value="秦汉" />
                <el-option label="魏晋南北朝" value="魏晋南北朝" />
                <el-option label="隋唐" value="隋唐" />
                <el-option label="宋元" value="宋元" />
                <el-option label="明清" value="明清" />
                <el-option label="民国" value="民国" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="归档等级">
              <el-select v-model="form.archiveLevel" :disabled="!editMode" style="width: 100%">
                <el-option label="A级" value="A" />
                <el-option label="B级" value="B" />
                <el-option label="C级" value="C" />
                <el-option label="D级" value="D" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="存储位置">
              <el-input v-model="form.location" :disabled="!editMode" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="采集时间">
              <el-input v-model="form.captureTime" disabled />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注说明">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            :disabled="!editMode"
          />
        </el-form-item>
      </el-form>
      <template #footer v-if="editMode">
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Collection, Medal, Trophy, FolderOpened, Star, StarFilled, Stars, Folder } from '@element-plus/icons-vue'

const activeTab = ref('A')

const stats = reactive({
  total: 128,
  levelA: 32,
  levelB: 45,
  levelC: 35,
  levelD: 16
})

const pagination = reactive({
  page: 1,
  size: 10,
  total: 0
})

const tableData = ref([])
const editVisible = ref(false)
const editMode = ref(false)
const form = ref(null)
const selectedRows = ref([])

const getLevelType = (level) => {
  const map = { A: 'success', B: '', C: 'warning', D: 'danger' }
  return map[level] || ''
}

const loadData = () => {
  const dynasties = ['先秦', '秦汉', '魏晋南北朝', '隋唐', '宋元', '明清', '民国']
  const operators = ['张三', '李四', '王五', '赵六']
  const locations = ['藏品库A-001', '藏品库A-002', '藏品库B-001', '藏品库C-001']
  
  const mockData = Array.from({ length: 10 }, (_, i) => ({
    id: pagination.page * 10 + i + 1,
    rubbingId: `TP${String(pagination.page * 10 + i + 1).padStart(6, '0')}`,
    name: `拓片档案${pagination.page * 10 + i + 1}`,
    dynasty: dynasties[Math.floor(Math.random() * dynasties.length)],
    archiveTime: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toLocaleString(),
    archiveLevel: activeTab.value,
    location: locations[Math.floor(Math.random() * locations.length)],
    operator: operators[Math.floor(Math.random() * operators.length)],
    captureTime: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toLocaleString(),
    remark: '这是一条归档备注信息'
  }))
  tableData.value = mockData
  pagination.total = activeTab.value === 'A' ? 32 : activeTab.value === 'B' ? 45 : activeTab.value === 'C' ? 35 : 16
}

const handleTabChange = () => {
  pagination.page = 1
  loadData()
}

const handleView = (row) => {
  form.value = { ...row }
  editMode.value = false
  editVisible.value = true
}

const handleEdit = (row) => {
  form.value = { ...row }
  editMode.value = true
  editVisible.value = true
}

const handleSave = () => {
  ElMessage.success('保存成功')
  editVisible.value = false
  loadData()
}

const handleDelete = (row) => {
  ElMessageBox.confirm(
    `确定要删除 ${row.name} 吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    ElMessage.success('删除成功')
    loadData()
  }).catch(() => {})
}

const handleBatchUpdate = () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要调整的记录')
    return
  }
  ElMessageBox.prompt('请选择新的归档等级', '批量调整等级', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /^[ABCD]$/,
    inputErrorMessage: '请输入有效的等级 (A/B/C/D)'
  }).then(({ value }) => {
    ElMessage.success(`已将 ${selectedRows.value.length} 条记录调整为 ${value}级`)
    loadData()
  }).catch(() => {})
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.archive-container {
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

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.content-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
