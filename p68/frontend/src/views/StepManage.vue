<template>
  <div class="step-manage">
    <el-header class="header">
      <div class="header-content">
        <el-button @click="$router.push('/')" icon="ArrowLeft">返回</el-button>
        <h1 class="title">教学步骤管理</h1>
        <el-select v-model="selectedFurniture" placeholder="选择家具" @change="loadSteps" style="width: 200px;">
          <el-option v-for="item in furnitureList" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-button type="primary" icon="Plus" @click="openDialog()">新增步骤</el-button>
      </div>
    </el-header>

    <el-main class="main-content">
      <el-table :data="steps" style="width: 100%;">
        <el-table-column prop="stepNumber" label="步骤序号" width="100" align="center" />
        <el-table-column prop="title" label="步骤标题" width="200" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column label="视频讲解" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.videoUrl" type="success" size="small">已上传</el-tag>
            <el-tag v-else type="info" size="small">未上传</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="estimatedTime" label="预计用时(秒)" width="120" align="center" />
        <el-table-column label="操作" width="200" align="center">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="openDialog(row)">编辑</el-button>
            <el-button type="warning" size="small" link @click="uploadVideo(row)">上传视频</el-button>
            <el-button type="danger" size="small" link @click="deleteStep(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-main>

    <!-- 步骤编辑对话框 -->
    <el-dialog v-model="dialogVisible" title="编辑步骤" width="800px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="步骤序号">
          <el-input-number v-model="form.stepNumber" :min="1" />
        </el-form-item>
        <el-form-item label="步骤标题">
          <el-input v-model="form.title" placeholder="请输入步骤标题" />
        </el-form-item>
        <el-form-item label="步骤描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入步骤描述" />
        </el-form-item>
        <el-form-item label="视频地址">
          <el-input v-model="form.videoUrl" placeholder="请输入视频地址或上传视频">
            <template #append>
              <el-button @click="showUploadDialog = true">上传</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="图片地址">
          <el-input v-model="form.imageUrl" placeholder="请输入图片地址" />
        </el-form-item>
        <el-form-item label="目标部件ID">
          <el-input v-model="form.targetPartId" placeholder="请输入部件ID" />
        </el-form-item>
        <el-form-item label="操作指南">
          <el-input v-model="form.operationGuide" type="textarea" :rows="3" placeholder="请输入操作指南" />
        </el-form-item>
        <el-form-item label="注意事项">
          <el-input v-model="form.attentionPoints" type="textarea" :rows="2" placeholder="请输入注意事项" />
        </el-form-item>
        <el-form-item label="预计用时">
          <el-input-number v-model="form.estimatedTime" :min="1" :suffix="'秒'" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveStep">保存</el-button>
      </template>
    </el-dialog>

    <!-- 视频上传对话框 -->
    <el-dialog v-model="showUploadDialog" title="上传视频" width="600px">
      <VideoUploader v-model="form.videoUrl" @success="handleVideoSuccess" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Plus } from '@element-plus/icons-vue'
import { getFurnitureList } from '@/api/furniture'
import { getDisassembleSteps, createStep } from '@/api/teaching'
import VideoUploader from '@/components/VideoUploader.vue'

const furnitureList = ref([])
const selectedFurniture = ref(null)
const steps = ref([])
const dialogVisible = ref(false)
const showUploadDialog = ref(false)
const form = ref({
  id: null,
  stepNumber: 1,
  title: '',
  description: '',
  videoUrl: '',
  imageUrl: '',
  targetPartId: '',
  operationGuide: '',
  attentionPoints: '',
  estimatedTime: 60
})

onMounted(() => {
  loadFurnitureList()
})

const loadFurnitureList = async () => {
  try {
    const res = await getFurnitureList()
    furnitureList.value = res.data
    if (res.data.length > 0) {
      selectedFurniture.value = res.data[0].id
      loadSteps()
    }
  } catch (error) {
    console.error('加载家具列表失败', error)
  }
}

const loadSteps = async () => {
  if (!selectedFurniture.value) return
  try {
    const res = await getDisassembleSteps(selectedFurniture.value)
    steps.value = res.data
  } catch (error) {
    console.error('加载步骤失败', error)
  }
}

const openDialog = (row = null) => {
  if (row) {
    form.value = { ...row }
  } else {
    form.value = {
      id: null,
      furnitureId: selectedFurniture.value,
      stepNumber: steps.value.length + 1,
      title: '',
      description: '',
      videoUrl: '',
      imageUrl: '',
      targetPartId: '',
      operationGuide: '',
      attentionPoints: '',
      estimatedTime: 60
    }
  }
  dialogVisible.value = true
}

const uploadVideo = (row) => {
  form.value = { ...row }
  showUploadDialog.value = true
}

const handleVideoSuccess = (data) => {
  ElMessage.success('视频上传成功')
  showUploadDialog.value = false
}

const saveStep = async () => {
  try {
    form.value.furnitureId = selectedFurniture.value
    await createStep(form.value)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadSteps()
  } catch (error) {
    ElMessage.error('保存失败：' + (error.response?.data?.message || error.message))
  }
}

const deleteStep = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除此步骤吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    ElMessage.success('删除成功')
    loadSteps()
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.step-manage {
  min-height: 100vh;
  background: #f5f7fa;
}

.header {
  background: white;
  border-bottom: 1px solid #e4e7ed;
  padding: 0;
  height: 60px;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 20px;
  gap: 15px;
}

.title {
  flex: 1;
  font-size: 18px;
  margin: 0;
  color: #333;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}
</style>
