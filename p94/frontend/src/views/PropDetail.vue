<template>
  <div class="prop-detail-page">
    <div class="page-header">
      <el-button @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon>
        {{ $t('common.back') }}
      </el-button>
      <h2 class="page-title">{{ $t('prop.title') }}详情</h2>
    </div>

    <el-row :gutter="20" v-if="prop">
      <el-col :span="10">
        <el-card class="image-card">
          <div class="main-image">
            <img v-if="prop.imageUrl" :src="prop.imageUrl" :alt="prop.name" />
            <div v-else class="placeholder-image">
              <el-icon><Image /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card class="info-card">
          <h3 class="prop-name">{{ prop.name }}</h3>
          <el-tag type="info" size="large" class="category-tag">{{ prop.category }}</el-tag>
          
          <el-descriptions :column="2" border class="prop-desc">
            <el-descriptions-item :label="$t('prop.material')">{{ prop.material || '-' }}</el-descriptions-item>
            <el-descriptions-item :label="$t('prop.size')">{{ prop.size || '-' }}</el-descriptions-item>
            <el-descriptions-item :label="$t('prop.origin')">{{ prop.origin || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="prop.status === 1 ? 'success' : 'warning'">
                {{ prop.status === 1 ? '已审核' : '草稿' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="采集时间">{{ formatDate(prop.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatDate(prop.updatedAt) }}</el-descriptions-item>
          </el-descriptions>

          <div class="description-section">
            <h4>道具描述</h4>
            <p>{{ prop.description || '暂无描述' }}</p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div class="similar-section" v-if="similarProps.length > 0">
      <h3 class="section-title">
        <el-icon><CopyDocument /></el-icon>
        {{ $t('prop.similar') }}
      </h3>
      <el-row :gutter="16">
        <el-col :span="6" v-for="item in similarProps" :key="item.id">
          <el-card class="similar-card" shadow="hover" @click.native="goToDetail(item.id)">
            <div class="similar-image">
              <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" />
              <div v-else class="similar-placeholder">
                <el-icon><Image /></el-icon>
              </div>
            </div>
            <div class="similar-info">
              <h4 class="similar-name">{{ item.name }}</h4>
              <el-tag size="small" type="info">{{ item.category }}</el-tag>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { propApi, propSearchApi } from '../api'

const route = useRoute()
const router = useRouter()
const prop = ref(null)
const similarProps = ref([])

const loadProp = async () => {
  try {
    const res = await propApi.get(route.params.id)
    prop.value = res.data
    loadSimilarProps()
  } catch (error) {
    console.error('加载道具详情失败:', error)
  }
}

const loadSimilarProps = async () => {
  try {
    const res = await propSearchApi.searchSimilar(route.params.id)
    similarProps.value = res.data || []
  } catch (error) {
    console.error('加载相似道具失败:', error)
  }
}

const goToDetail = (id) => {
  router.push(`/prop/${id}`)
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

onMounted(() => {
  loadProp()
})
</script>

<style scoped>
.prop-detail-page {
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
}
.image-card {
  border-radius: 8px;
}
.main-image {
  width: 100%;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 6px;
  overflow: hidden;
}
.main-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.placeholder-image {
  color: #ccc;
  font-size: 64px;
}
.info-card {
  border-radius: 8px;
}
.prop-name {
  margin: 0 0 15px 0;
  font-size: 24px;
  color: #333;
}
.category-tag {
  margin-bottom: 20px;
}
.prop-desc {
  margin-bottom: 20px;
}
.description-section h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #333;
}
.description-section p {
  margin: 0;
  color: #666;
  line-height: 1.6;
}
.similar-section {
  margin-top: 30px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #333;
}
.similar-card {
  cursor: pointer;
  border-radius: 8px;
  transition: transform 0.3s;
}
.similar-card:hover {
  transform: translateY(-4px);
}
.similar-image {
  width: 100%;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 12px;
}
.similar-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.similar-placeholder {
  color: #ccc;
  font-size: 32px;
}
.similar-name {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
  }
  .page-title {
    font-size: 20px;
  }
  .main-image {
    height: 250px;
  }
  .section-title {
    font-size: 18px;
  }
}
</style>
