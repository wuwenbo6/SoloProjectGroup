<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">原料管理</div>
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon>
        添加原料
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
          v-model="searchForm.materialType"
          placeholder="原料类型"
          style="width: 150px; margin-right: 10px;"
          clearable
        >
          <el-option label="竹浆" value="竹浆" />
          <el-option label="木浆" value="木浆" />
          <el-option label="麻浆" value="麻浆" />
          <el-option label="棉浆" value="棉浆" />
        </el-select>
        <el-button type="primary" @click="loadMaterialList">查询</el-button>
      </div>
      <el-table :data="materialList" border stripe>
        <el-table-column prop="batchNo" label="批次号" width="120" />
        <el-table-column prop="materialType" label="原料类型" width="100" />
        <el-table-column prop="materialName" label="原料名称" width="120" />
        <el-table-column prop="origin" label="产地" width="150" />
        <el-table-column prop="quantity" label="数量" width="100" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="qualityLevel" label="质量等级" width="100">
          <template #default="{ row }">
            <el-tag :type="getQualityLevelType(row.qualityLevel)">
              {{ row.qualityLevel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="inspector" label="检验员" width="100" />
        <el-table-column prop="inspectTime" label="检验时间" width="160" />
        <el-table-column prop="remark" label="备注" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small">编辑</el-button>
            <el-button type="danger" size="small">删除</el-button>
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
        @size-change="loadMaterialList"
        @current-change="loadMaterialList"
      />
    </div>

    <el-dialog v-model="showAddDialog" title="添加原料" width="500px">
      <el-form :model="materialForm" label-width="100px">
        <el-form-item label="批次号">
          <el-input v-model="materialForm.batchNo" placeholder="请输入批次号" />
        </el-form-item>
        <el-form-item label="原料类型">
          <el-select v-model="materialForm.materialType" placeholder="请选择原料类型" style="width: 100%;">
            <el-option label="竹浆" value="竹浆" />
            <el-option label="木浆" value="木浆" />
            <el-option label="麻浆" value="麻浆" />
            <el-option label="棉浆" value="棉浆" />
          </el-select>
        </el-form-item>
        <el-form-item label="原料名称">
          <el-input v-model="materialForm.materialName" placeholder="请输入原料名称" />
        </el-form-item>
        <el-form-item label="产地">
          <el-input v-model="materialForm.origin" placeholder="请输入产地" />
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="materialForm.quantity" :step="0.01" :precision="2" />
        </el-form-item>
        <el-form-item label="单位">
          <el-select v-model="materialForm.unit" placeholder="请选择单位" style="width: 100%;">
            <el-option label="kg" value="kg" />
            <el-option label="吨" value="吨" />
            <el-option label="包" value="包" />
          </el-select>
        </el-form-item>
        <el-form-item label="质量等级">
          <el-select v-model="materialForm.qualityLevel" placeholder="请选择质量等级" style="width: 100%;">
            <el-option label="A级" value="A级" />
            <el-option label="B级" value="B级" />
            <el-option label="C级" value="C级" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="materialForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddMaterial">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const searchForm = ref({
  batchNo: '',
  materialType: ''
})

const pagination = ref({
  page: 1,
  size: 10,
  total: 20
})

const materialList = ref([
  {
    batchNo: 'BATCH001',
    materialType: '竹浆',
    materialName: '优质竹浆',
    origin: '四川宜宾',
    quantity: 1000,
    unit: 'kg',
    qualityLevel: 'A级',
    inspector: '李质检',
    inspectTime: '2024-01-15 10:30:00',
    remark: '优质原料'
  },
  {
    batchNo: 'BATCH002',
    materialType: '木浆',
    materialName: '进口木浆',
    origin: '巴西',
    quantity: 500,
    unit: 'kg',
    qualityLevel: 'B级',
    inspector: '李质检',
    inspectTime: '2024-01-16 14:20:00',
    remark: ''
  }
])

const showAddDialog = ref(false)
const materialForm = ref({
  batchNo: '',
  materialType: '',
  materialName: '',
  origin: '',
  quantity: 0,
  unit: 'kg',
  qualityLevel: 'A级',
  remark: ''
})

const loadMaterialList = () => {
  ElMessage.info('查询功能开发中')
}

const handleAddMaterial = () => {
  if (!materialForm.value.batchNo || !materialForm.value.materialName) {
    ElMessage.warning('请填写必填项')
    return
  }
  ElMessage.success('原料添加成功')
  showAddDialog.value = false
}

const getQualityLevelType = (level) => {
  const map = {
    'A级': 'success',
    'B级': 'warning',
    'C级': 'info'
  }
  return map[level] || 'info'
}
</script>
