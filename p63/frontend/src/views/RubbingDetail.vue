<template>
  <div class="detail-page" v-loading="loading">
    <el-card v-if="rubbing" class="main-card">
      <template #header>
        <div class="card-header">
          <span>{{ rubbing.title }}</span>
          <div class="header-actions">
            <el-tag type="success" size="large">
              进度: {{ rubbing.progress || 0 }}%
            </el-tag>
            <el-button @click="goToInterpret">进入释读</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="24">
        <el-col :span="16">
          <div class="image-section">
            <h3>拓片图像</h3>
            <div class="image-container">
              <img
                :src="getImageUrl(rubbing.processedImage || rubbing.originalImage)"
                alt="拓片图像"
                class="main-image"
              />
            </div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="info-section">
            <h3>基本信息</h3>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="标题">{{ rubbing.title }}</el-descriptions-item>
              <el-descriptions-item label="描述">{{ rubbing.description || '-' }}</el-descriptions-item>
              <el-descriptions-item label="朝代">{{ rubbing.dynasty || '-' }}</el-descriptions-item>
              <el-descriptions-item label="出土地点">{{ rubbing.location || '-' }}</el-descriptions-item>
              <el-descriptions-item label="材质">{{ rubbing.material || '-' }}</el-descriptions-item>
              <el-descriptions-item label="文字数量">{{ rubbing.characters?.length || 0 }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="getStatusType(rubbing.status)">
                  {{ getStatusText(rubbing.status) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">
                {{ formatDate(rubbing.createdAt) }}
              </el-descriptions-item>
            </el-descriptions>

            <div class="tags-section" v-if="rubbing.tags?.length">
              <h4>标签</h4>
              <el-tag v-for="tag in rubbing.tags" :key="tag" style="margin-right: 8px; margin-bottom: 8px;">
                {{ tag }}
              </el-tag>
            </div>

            <div class="collaborators-section">
              <h4>协作者</h4>
              <el-avatar-group v-if="rubbing.collaborators?.length">
                <el-avatar
                  v-for="user in rubbing.collaborators"
                  :key="user._id"
                  :title="user.username"
                >
                  {{ user.username.charAt(0) }}
                </el-avatar>
              </el-avatar-group>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { rubbingAPI } from '@/api'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const rubbing = ref(null)

const loadRubbing = async () => {
  loading.value = true
  try {
    const response = await rubbingAPI.get(route.params.id)
    rubbing.value = response.data.rubbing
  } catch (error) {
    ElMessage.error('加载拓片详情失败')
  } finally {
    loading.value = false
  }
}

const getImageUrl = (path) => {
  if (path.startsWith('http')) return path
  return path
}

const getStatusType = (status) => {
  const map = {
    uploaded: 'info',
    processing: 'warning',
    ready: 'primary',
    completed: 'success'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    uploaded: '已上传',
    processing: '处理中',
    ready: '待释读',
    completed: '已完成'
  }
  return map[status] || status
}

const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN')
}

const goToInterpret = () => {
  router.push(`/rubbings/${route.params.id}/interpret`)
}

onMounted(() => {
  loadRubbing()
})
</script>

<style scoped>
.detail-page {
  padding: 0;
}

.main-card {
  border: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.image-section h3,
.info-section h3 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #333;
}

.image-container {
  text-align: center;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
}

.main-image {
  max-width: 100%;
  max-height: 500px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.tags-section,
.collaborators-section {
  margin-top: 20px;
}

.tags-section h4,
.collaborators-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #666;
}
</style>
