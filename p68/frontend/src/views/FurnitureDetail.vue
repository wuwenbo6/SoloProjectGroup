<template>
  <div class="detail-container">
    <el-header class="header">
      <div class="header-content">
        <el-button @click="$router.push('/')" icon="ArrowLeft">返回</el-button>
        <h1 class="title">{{ furniture?.name }}</h1>
      </div>
    </el-header>
    <el-main class="main-content">
      <el-row :gutter="20">
        <el-col :span="16">
          <el-card class="info-card">
            <template #header>
              <span>家具信息</span>
            </template>
            <div class="furniture-info">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="名称">{{ furniture?.name }}</el-descriptions-item>
                <el-descriptions-item label="分类">{{ furniture?.category }}</el-descriptions-item>
                <el-descriptions-item label="难度">
                  <el-rate v-model="furniture.difficulty" disabled show-score text-color="#ff9900" />
                </el-descriptions-item>
                <el-descriptions-item label="总步骤">{{ furniture?.totalSteps }}</el-descriptions-item>
                <el-descriptions-item label="描述" :span="2">{{ furniture?.description }}</el-descriptions-item>
              </el-descriptions>
            </div>
            <div class="parts-section">
              <h3>部件列表</h3>
              <el-table :data="parts" style="width: 100%">
                <el-table-column prop="stepOrder" label="拆解顺序" width="100" align="center" />
                <el-table-column prop="name" label="部件名称" />
                <el-table-column prop="mortiseType" label="榫卯类型" width="150" />
                <el-table-column label="操作" width="120" align="center">
                  <template #default="{ row }">
                    <el-button type="primary" size="small" link @click="showPartDetail(row)">查看详情</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div class="actions">
              <el-button type="primary" size="large" @click="startLearn">开始学习拆解</el-button>
            </div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="preview-card">
            <template #header>
              <span>模型预览</span>
            </template>
            <ThreeViewer :parts="parts" :current-step="0" />
          </el-card>
        </el-col>
      </el-row>
    </el-main>
    <el-dialog v-model="partDialogVisible" title="部件详情" width="600px">
      <div v-if="selectedPart">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="部件名称">{{ selectedPart.name }}</el-descriptions-item>
          <el-descriptions-item label="拆解顺序">第 {{ selectedPart.stepOrder }} 步</el-descriptions-item>
          <el-descriptions-item label="榫卯类型">{{ selectedPart.mortiseType || '暂无' }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ selectedPart.description }}</el-descriptions-item>
          <el-descriptions-item label="组装提示">{{ selectedPart.assemblyTip || '暂无' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFurnitureDetail, getFurnitureParts } from '@/api/furniture'
import ThreeViewer from '@/components/ThreeViewer.vue'
import { ArrowLeft } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const furniture = ref({})
const parts = ref([])
const partDialogVisible = ref(false)
const selectedPart = ref(null)

onMounted(() => {
  loadData()
})

const loadData = async () => {
  try {
    const [furnitureRes, partsRes] = await Promise.all([
      getFurnitureDetail(route.params.id),
      getFurnitureParts(route.params.id)
    ])
    furniture.value = furnitureRes.data
    parts.value = partsRes.data
  } catch (error) {
    console.error('加载数据失败', error)
  }
}

const showPartDetail = (part) => {
  selectedPart.value = part
  partDialogVisible.value = true
}

const startLearn = () => {
  router.push(`/learn/${route.params.id}`)
}
</script>

<style scoped>
.detail-container {
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
  gap: 20px;
}

.title {
  font-size: 18px;
  margin: 0;
  color: #333;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.info-card {
  margin-bottom: 20px;
}

.furniture-info {
  margin-bottom: 30px;
}

.parts-section h3 {
  margin: 20px 0 15px 0;
  color: #333;
}

.actions {
  text-align: center;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

.preview-card {
  height: 700px;
}
</style>
