<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">品质检测</div>
      <el-button type="primary" @click="showReportDialog = true">
        <el-icon><Plus /></el-icon>
        创建质检报告
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
        <el-select
          v-model="searchForm.qualityLevel"
          placeholder="质量等级"
          style="width: 150px; margin-right: 10px;"
          clearable
        >
          <el-option label="优秀" value="EXCELLENT" />
          <el-option label="良好" value="GOOD" />
          <el-option label="合格" value="PASS" />
          <el-option label="不合格" value="FAIL" />
        </el-select>
        <el-button type="primary" @click="loadReportList">查询</el-button>
      </div>
      <el-table :data="reportList" border stripe>
        <el-table-column prop="reportNo" label="报告编号" width="150" />
        <el-table-column prop="batchNo" label="批次号" width="120" />
        <el-table-column prop="thickness" label="厚度(mm)" width="100" />
        <el-table-column prop="density" label="密度(g/cm³)" width="120" />
        <el-table-column prop="tensileStrength" label="抗张强度" width="100" />
        <el-table-column prop="whiteness" label="白度(%)" width="100" />
        <el-table-column prop="qualityLevel" label="质量等级" width="100">
          <template #default="{ row }">
            <el-tag :type="getQualityLevelType(row.qualityLevel)">
              {{ getQualityLevelText(row.qualityLevel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="result" label="结果" width="80">
          <template #default="{ row }">
            <el-tag :type="row.result === 'PASS' ? 'success' : 'danger'">
              {{ row.result === 'PASS' ? '通过' : '不通过' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="inspectorName" label="检验员" width="100" />
        <el-table-column prop="inspectTime" label="检验时间" width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
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
        @size-change="loadReportList"
        @current-change="loadReportList"
      />
    </div>

    <el-dialog v-model="showReportDialog" title="创建质检报告" width="600px">
      <el-form :model="reportForm" label-width="120px">
        <el-form-item label="批次号">
          <el-input v-model="reportForm.batchNo" placeholder="请输入批次号" />
        </el-form-item>
        <el-form-item label="厚度(mm)">
          <el-input-number v-model="reportForm.thickness" :step="0.001" :precision="3" />
        </el-form-item>
        <el-form-item label="密度(g/cm³)">
          <el-input-number v-model="reportForm.density" :step="0.001" :precision="3" />
        </el-form-item>
        <el-form-item label="抗张强度">
          <el-input-number v-model="reportForm.tensileStrength" :step="0.1" :precision="2" />
        </el-form-item>
        <el-form-item label="白度(%)">
          <el-input-number v-model="reportForm.whiteness" :step="0.1" :precision="2" />
        </el-form-item>
        <el-form-item label="外观描述">
          <el-input
            v-model="reportForm.appearance"
            type="textarea"
            :rows="3"
            placeholder="请输入外观描述"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="reportForm.remark"
            type="textarea"
            :rows="2"
            placeholder="请输入备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateReport">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'
import { createQualityReport, getQualityReportList } from '../api/quality'

const userStore = useUserStore()

const searchForm = ref({
  batchNo: '',
  qualityLevel: ''
})

const pagination = ref({
  page: 1,
  size: 10,
  total: 0
})

const reportList = ref([])
const showReportDialog = ref(false)

const reportForm = ref({
  batchNo: '',
  thickness: 0.1,
  density: 0.7,
  tensileStrength: 30,
  whiteness: 85,
  appearance: '',
  remark: ''
})

const loadReportList = async () => {
  try {
    const res = await getQualityReportList({
      page: pagination.value.page,
      size: pagination.value.size,
      batchNo: searchForm.value.batchNo,
      qualityLevel: searchForm.value.qualityLevel
    })
    reportList.value = res.data.records || []
    pagination.value.total = res.data.total || 0
  } catch (error) {
    console.error('加载质检报告列表失败:', error)
  }
}

const handleCreateReport = async () => {
  if (!reportForm.value.batchNo) {
    ElMessage.warning('请输入批次号')
    return
  }

  try {
    const userInfo = userStore.userInfo
    await createQualityReport({
      ...reportForm.value,
      inspectorId: userInfo?.userId,
      inspectorName: userInfo?.realName || userInfo?.username
    })
    ElMessage.success('质检报告创建成功')
    showReportDialog.value = false
    loadReportList()
    reportForm.value = {
      batchNo: '',
      thickness: 0.1,
      density: 0.7,
      tensileStrength: 30,
      whiteness: 85,
      appearance: '',
      remark: ''
    }
  } catch (error) {
    console.error('创建质检报告失败:', error)
  }
}

const getQualityLevelText = (level) => {
  const map = {
    'EXCELLENT': '优秀',
    'GOOD': '良好',
    'PASS': '合格',
    'FAIL': '不合格'
  }
  return map[level] || level
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

const viewDetail = (row) => {
  ElMessage.info('详情功能开发中')
}

onMounted(() => {
  loadReportList()
})
</script>
