<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">工序操作台</div>
      <el-button type="primary" @click="showStartDialog = true">
        <el-icon><Plus /></el-icon>
        开始工序
      </el-button>
    </div>

    <div class="table-container">
      <div class="table-header">
        <el-input
          v-model="searchForm.batchNo"
          placeholder="搜索批次号"
          style="width: 200px; margin-right: 10px;"
          clearable
        />
        <el-button type="primary" @click="loadProcessList">查询</el-button>
      </div>
      <el-table :data="processList" border stripe>
        <el-table-column prop="batchNo" label="批次号" width="120" />
        <el-table-column prop="processName" label="工序名称" width="120" />
        <el-table-column prop="craftsmanName" label="工匠" width="100" />
        <el-table-column prop="startTime" label="开始时间" width="160" />
        <el-table-column prop="endTime" label="结束时间" width="160" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'COMPLETED' ? 'success' : 'primary'">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="abnormalFlag" label="异常" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.abnormalFlag === 'ABNORMAL'" type="danger">异常</el-tag>
            <el-tag v-else type="success">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'PROCESSING'"
              type="primary"
              size="small"
              @click="handleComplete(row)"
            >
              完成
            </el-button>
            <el-button type="info" size="small" @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        style="margin-top: 20px; justify-content: flex-end;"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadProcessList"
        @current-change="loadProcessList"
      />
    </div>

    <el-dialog v-model="showStartDialog" title="开始工序" width="500px">
      <el-form :model="startForm" label-width="100px">
        <el-form-item label="批次号">
          <el-input v-model="startForm.batchNo" placeholder="请输入批次号" />
        </el-form-item>
        <el-form-item label="工序节点">
          <el-select v-model="startForm.processCode" placeholder="请选择工序" style="width: 100%;">
            <el-option
              v-for="node in processNodes"
              :key="node.nodeCode"
              :label="node.nodeName"
              :value="node.nodeCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="工序名称">
          <el-input v-model="startForm.processName" placeholder="请输入工序名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showStartDialog = false">取消</el-button>
        <el-button type="primary" @click="handleStartProcess">确认开始</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCompleteDialog" title="完成工序" width="500px">
      <el-form :model="completeForm" label-width="100px">
        <el-form-item label="参数记录">
          <el-input
            v-model="completeForm.parameters"
            type="textarea"
            :rows="4"
            placeholder="请输入工艺参数记录"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCompleteDialog = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmComplete">确认完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'
import { startProcess, completeProcess, getProcessList, getProcessNodes } from '../api/process'

const userStore = useUserStore()

const searchForm = ref({
  batchNo: ''
})

const pagination = ref({
  page: 1,
  size: 10,
  total: 0
})

const processList = ref([])
const processNodes = ref([])
const showStartDialog = ref(false)
const showCompleteDialog = ref(false)
const currentProcessId = ref(null)

const startForm = ref({
  batchNo: '',
  processCode: '',
  processName: ''
})

const completeForm = ref({
  parameters: ''
})

const loadProcessNodes = async () => {
  try {
    const res = await getProcessNodes()
    processNodes.value = res.data || []
  } catch (error) {
    console.error('加载工序节点失败:', error)
  }
}

const loadProcessList = async () => {
  try {
    const res = await getProcessList({
      page: pagination.value.page,
      size: pagination.value.size,
      batchNo: searchForm.value.batchNo
    })
    processList.value = res.data.records || []
    pagination.value.total = res.data.total || 0
  } catch (error) {
    console.error('加载工序列表失败:', error)
  }
}

const handleStartProcess = async () => {
  if (!startForm.value.batchNo || !startForm.value.processCode) {
    ElMessage.warning('请填写完整信息')
    return
  }

  try {
    const userInfo = userStore.userInfo
    await startProcess({
      ...startForm.value,
      craftsmanId: userInfo?.userId,
      craftsmanName: userInfo?.realName || userInfo?.username
    })
    ElMessage.success('工序开始成功')
    showStartDialog.value = false
    loadProcessList()
    startForm.value = { batchNo: '', processCode: '', processName: '' }
  } catch (error) {
    console.error('开始工序失败:', error)
  }
}

const handleComplete = (row) => {
  currentProcessId.value = row.id
  completeForm.value.parameters = ''
  showCompleteDialog.value = true
}

const handleConfirmComplete = async () => {
  if (!completeForm.value.parameters) {
    ElMessage.warning('请填写工艺参数')
    return
  }

  try {
    await completeProcess(currentProcessId.value, completeForm.value.parameters)
    ElMessage.success('工序完成成功')
    showCompleteDialog.value = false
    loadProcessList()
  } catch (error) {
    console.error('完成工序失败:', error)
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

const viewDetail = (row) => {
  ElMessage.info('详情功能开发中')
}

onMounted(() => {
  loadProcessNodes()
  loadProcessList()
})
</script>
