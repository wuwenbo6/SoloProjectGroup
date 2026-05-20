<template>
  <div class="knowledge-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>方言知识库</span>
          <el-button type="primary" size="small" :icon="Plus" @click="showDialog = true">
            添加方言
          </el-button>
        </div>
      </template>

      <el-table :data="dialects" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="方言名称" width="120" />
        <el-table-column prop="branch" label="语系分支" width="150" />
        <el-table-column prop="region" label="地区" width="150" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
              {{ row.is_active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" @click="viewPatterns(row.id)">语调模式</el-button>
            <el-button size="small" type="primary" @click="editDialect(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showDialog" :title="isEdit ? '编辑方言' : '添加方言'" width="500px">
      <el-form :model="dialectForm" label-width="80px">
        <el-form-item label="方言名称">
          <el-input v-model="dialectForm.name" />
        </el-form-item>
        <el-form-item label="语系分支">
          <el-input v-model="dialectForm.branch" />
        </el-form-item>
        <el-form-item label="地区">
          <el-input v-model="dialectForm.region" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="dialectForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="saveDialect">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { knowledgeApi } from '@/utils/api'

const dialects = ref([])
const showDialog = ref(false)
const isEdit = ref(false)
const dialectForm = ref({
  name: '',
  branch: '',
  region: '',
  description: ''
})

const loadDialects = async () => {
  try {
    const response = await knowledgeApi.getDialects()
    dialects.value = response.data.dialects || []
    
    if (dialects.value.length === 0) {
      await knowledgeApi.initSampleData()
      const res = await knowledgeApi.getDialects()
      dialects.value = res.data.dialects || []
    }
  } catch (error) {
    ElMessage.error('加载方言列表失败')
  }
}

const editDialect = (row) => {
  isEdit.value = true
  dialectForm.value = { ...row }
  showDialog.value = true
}

const saveDialect = async () => {
  if (!dialectForm.value.name) {
    ElMessage.warning('请输入方言名称')
    return
  }
  try {
    if (isEdit.value) {
      await knowledgeApi.updateDialect(dialectForm.value.id, dialectForm.value)
      ElMessage.success('更新成功')
    } else {
      await knowledgeApi.createDialect(dialectForm.value)
      ElMessage.success('添加成功')
    }
    showDialog.value = false
    loadDialects()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const viewPatterns = (id) => {
  ElMessage.info(`查看方言ID ${id} 的语调模式`)
}

onMounted(() => {
  loadDialects()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
