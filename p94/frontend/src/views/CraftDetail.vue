<template>
  <div class="craft-detail-page">
    <div class="page-header">
      <el-button @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon>
        {{ $t('common.back') }}
      </el-button>
      <h2 class="page-title">{{ $t('craft.title') }}详情</h2>
      <el-button type="primary" @click="$router.push(`/craft/edit/${craft?.id}`)">
        <el-icon><Edit /></el-icon>
        {{ $t('common.edit') }}
      </el-button>
    </div>

    <el-card v-if="craft">
      <div class="craft-header">
        <h3 class="craft-title">{{ craft.title }}</h3>
        <div class="craft-tags">
          <el-tag type="info">{{ craft.category }}</el-tag>
          <el-tag :type="getDifficultyType(craft.difficultyLevel)">
            {{ $t('craft.difficulty') }}: {{ getDifficultyText(craft.difficultyLevel) }}
          </el-tag>
        </div>
      </div>

      <el-descriptions :column="3" border class="craft-meta">
        <el-descriptions-item :label="$t('craft.materials')">{{ craft.materials || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="$t('craft.tools')">{{ craft.tools || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="$t('craft.duration')">{{ craft.duration || '-' }}</el-descriptions-item>
        <el-descriptions-item label="浏览次数">{{ craft.viewCount || 0 }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="craft.status === 1 ? 'success' : 'warning'">
            {{ craft.status === 1 ? '已发布' : '草稿' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(craft.createdAt) }}</el-descriptions-item>
      </el-descriptions>

      <div class="craft-content-section">
        <h4>工艺说明</h4>
        <div class="content-text">{{ craft.content }}</div>
      </div>
    </el-card>

    <CraftStepDemo :steps="steps" v-if="steps.length > 0" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { craftApi, craftStepApi } from '../api'
import CraftStepDemo from '../components/CraftStepDemo.vue'

const route = useRoute()
const craft = ref(null)
const steps = ref([])

const loadCraft = async () => {
  try {
    const res = await craftApi.get(route.params.id)
    craft.value = res.data
    loadSteps()
  } catch (error) {
    console.error('加载工艺详情失败:', error)
  }
}

const loadSteps = async () => {
  try {
    const res = await craftStepApi.list(route.params.id)
    steps.value = res.data || []
  } catch (error) {
    console.error('加载步骤失败:', error)
  }
}

const getDifficultyType = (level) => {
  const types = { 1: 'success', 2: '', 3: 'warning', 4: 'danger' }
  return types[level] || ''
}

const getDifficultyText = (level) => {
  const map = { 1: '简单', 2: '中等', 3: '困难', 4: '专家' }
  return map[level] || '-'
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

onMounted(() => {
  loadCraft()
})
</script>

<style scoped>
.craft-detail-page {
  padding: 0;
}
.page-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}
.page-title {
  margin: 0;
  font-size: 24px;
  color: #333;
  flex: 1;
}
.craft-header {
  margin-bottom: 20px;
}
.craft-title {
  margin: 0 0 15px 0;
  font-size: 22px;
  color: #333;
}
.craft-tags {
  display: flex;
  gap: 10px;
}
.craft-meta {
  margin-bottom: 25px;
}
.craft-content-section h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}
.content-text {
  color: #666;
  line-height: 1.8;
  white-space: pre-wrap;
  background: #f9f9f9;
  padding: 20px;
  border-radius: 6px;
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 15px;
  }
  .page-title {
    font-size: 18px;
    order: -1;
    width: 100%;
  }
  .craft-title {
    font-size: 18px;
  }
  .craft-tags {
    flex-wrap: wrap;
  }
  .craft-meta :deep(.el-descriptions__label),
  .craft-meta :deep(.el-descriptions__content) {
    display: block;
    width: 100%;
  }
  .content-text {
    padding: 12px;
    font-size: 14px;
  }
}
</style>
