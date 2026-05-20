<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { patternApi } from '../api'
import { searchSimilarPatterns, extractPatternFeatures, getSimilarityColorClass } from '../utils/imageSimilarity'

const router = useRouter()
const patterns = ref([])
const loading = ref(true)
const filterTag = ref('')
const sortBy = ref('createdAt')
const currentPage = ref(0)
const pageSize = ref(12)
const hasMore = ref(true)
const loadingMore = ref(false)
const imageCache = ref(new Map())
const featuresCache = ref(new Map())

const similaritySearchMode = ref(false)
const selectedPattern = ref(null)
const similarPatterns = ref([])
const searchingSimilar = ref(false)
const similarityThreshold = ref(60)

const loadPatterns = async (reset = true) => {
  if (reset) {
    loading.value = true
    currentPage.value = 0
    patterns.value = []
    hasMore.value = true
    similaritySearchMode.value = false
    similarPatterns.value = []
    selectedPattern.value = null
  }
  
  if (!hasMore.value) return
  
  loadingMore.value = !reset
  
  try {
    const data = await patternApi.listPaged(currentPage.value, pageSize.value, sortBy.value)
    const newPatterns = data.content || []
    
    for (const pattern of newPatterns) {
      if (pattern.imageData && !featuresCache.value.has(pattern.id)) {
        const features = await extractPatternFeatures(pattern.imageData)
        if (features) {
          featuresCache.value.set(pattern.id, features)
          pattern.features = features
        }
      }
    }
    
    if (reset) {
      patterns.value = newPatterns
    } else {
      patterns.value = [...patterns.value, ...newPatterns]
    }
    
    hasMore.value = !data.last
    currentPage.value++
  } catch (error) {
    ElMessage.error('加载作品失败')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return
  await loadPatterns(false)
}

const viewPattern = (id) => {
  router.push(`/share/${id}`)
}

const deletePattern = async (pattern) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除纹样「${pattern.name}」吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await patternApi.delete(pattern.id)
    ElMessage.success('删除成功')
    patterns.value = patterns.value.filter(p => p.id !== pattern.id)
    imageCache.value.delete(pattern.id)
    featuresCache.value.delete(pattern.id)
    
    if (selectedPattern.value?.id === pattern.id) {
      similaritySearchMode.value = false
      selectedPattern.value = null
      similarPatterns.value = []
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const sharePattern = (pattern) => {
  const shareUrl = `${window.location.origin}/share/${pattern.id}`
  navigator.clipboard.writeText(shareUrl)
  ElMessage.success('分享链接已复制到剪贴板')
}

const startSimilaritySearch = (pattern) => {
  selectedPattern.value = pattern
  similaritySearchMode.value = true
  ElMessage.info(`已选择「${pattern.name}」作为检索基准`)
}

const findSimilarPatterns = async () => {
  if (!selectedPattern.value) {
    ElMessage.warning('请先选择一个纹样作为基准')
    return
  }
  
  searchingSimilar.value = true
  try {
    const allPatternsWithFeatures = await Promise.all(
      patterns.value.map(async (p) => {
        if (!p.features && p.imageData) {
          p.features = await extractPatternFeatures(p.imageData)
        }
        return p
      })
    )
    
    const results = await searchSimilarPatterns(
      selectedPattern.value,
      allPatternsWithFeatures,
      similarityThreshold.value / 100
    )
    similarPatterns.value = results
    
    if (results.length === 0) {
      ElMessage.info('未找到相似纹样，请尝试降低相似度阈值')
    } else {
      ElMessage.success(`找到 ${results.length} 个相似纹样`)
    }
  } catch (error) {
    ElMessage.error('相似度检索失败')
  } finally {
    searchingSimilar.value = false
  }
}

const exitSimilarityMode = () => {
  similaritySearchMode.value = false
  selectedPattern.value = null
  similarPatterns.value = []
}

const getSimilarityBadgeColor = (similarity) => {
  const colorClass = getSimilarityColorClass(similarity)
  const colors = {
    high: '#4caf50',
    medium: '#ff9800',
    low: '#f44336'
  }
  return colors[colorClass]
}

const handleSortChange = () => {
  loadPatterns(true)
}

const displayPatterns = computed(() => {
  return similaritySearchMode.value && similarPatterns.value.length > 0
    ? similarPatterns.value
    : patterns.value
})

onMounted(() => {
  loadPatterns(true)
})
</script>

<template>
  <div class="works-page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">我的纹样作品</h1>
        <p class="page-desc">共 {{ patterns.length }} 个作品</p>
      </div>
      <div class="header-right">
        <div class="filter-group">
          <input
            v-model="filterTag"
            type="text"
            class="input-field"
            placeholder="按标签筛选..."
            @keyup.enter="loadPatterns(true)"
          >
          <select v-model="sortBy" class="input-field select-input" @change="handleSortChange">
            <option value="createdAt">最新创建</option>
            <option value="likeCount">最多点赞</option>
            <option value="shareCount">最多分享</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="similaritySearchMode" class="similarity-search-bar card">
      <div class="search-info">
        <div class="selected-pattern-preview">
          <img :src="selectedPattern.imageData" alt="基准纹样">
          <span class="pattern-name">{{ selectedPattern.name }}</span>
        </div>
        <div class="search-controls">
          <div class="threshold-control">
            <label>相似度阈值: {{ similarityThreshold }}%</label>
            <input
              type="range"
              v-model="similarityThreshold"
              min="30"
              max="95"
              step="5"
              class="threshold-slider"
            >
          </div>
          <button 
            class="btn-primary search-btn"
            @click="findSimilarPatterns"
            :disabled="searchingSimilar"
          >
            {{ searchingSimilar ? '检索中...' : '🔍 开始检索' }}
          </button>
          <button class="btn-secondary" @click="exitSimilarityMode">退出检索</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="patterns.length === 0" class="empty-state">
      <div class="empty-icon">🎨</div>
      <h3>还没有作品</h3>
      <p>去纹样操作台创作你的第一个脸谱纹样吧！</p>
      <button class="btn-primary" @click="$router.push('/studio')">去创作</button>
    </div>

    <div v-else>
      <div class="patterns-grid">
        <div v-for="pattern in displayPatterns" :key="pattern.id" class="pattern-card card">
          <div class="card-image" @click="viewPattern(pattern.id)">
            <img 
              :src="imageCache.get(pattern.id) || pattern.imageData" 
              :alt="pattern.name"
              loading="lazy"
            >
            <div v-if="pattern.similarityPercent !== undefined" class="similarity-badge"
                 :style="{ backgroundColor: getSimilarityBadgeColor(pattern.similarity / 100) }">
              {{ pattern.similarityPercent }}% 相似
            </div>
          </div>
          <div class="card-info">
            <h3 class="pattern-title">{{ pattern.name }}</h3>
            <div class="pattern-tags">
              <span v-for="tag in pattern.tags?.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
            </div>
            <div class="pattern-stats">
              <span class="stat-item">❤️ {{ pattern.likeCount || 0 }}</span>
              <span class="stat-item">💬 {{ pattern.commentCount || 0 }}</span>
              <span class="stat-item">🔗 {{ pattern.shareCount || 0 }}</span>
            </div>
            <div class="card-actions">
              <button class="action-btn" @click="viewPattern(pattern.id)">查看</button>
              <button class="action-btn similarity-btn" @click="startSimilaritySearch(pattern)">
                找相似
              </button>
              <button class="action-btn" @click="sharePattern(pattern)">分享</button>
              <button class="action-btn delete-btn" @click="deletePattern(pattern)">删除</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasMore && !similaritySearchMode" class="load-more-section">
        <button 
          class="btn-secondary load-more-btn" 
          @click="loadMore"
          :disabled="loadingMore"
        >
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.works-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left h1 {
  font-size: 32px;
  color: white;
  margin: 0 0 8px 0;
}

.page-desc {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  margin: 0;
}

.filter-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.select-input {
  width: 140px;
  cursor: pointer;
}

.similarity-search-bar {
  padding: 20px;
  margin-bottom: 24px;
}

.search-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px;
}

.selected-pattern-preview {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-pattern-preview img {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  object-fit: cover;
  border: 2px solid var(--primary-color);
}

.selected-pattern-preview .pattern-name {
  color: white;
  font-weight: 500;
  font-size: 15px;
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.threshold-control {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.threshold-control label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}

.threshold-slider {
  width: 150px;
}

.search-btn {
  white-space: nowrap;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: rgba(255, 255, 255, 0.6);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.empty-state h3 {
  color: white;
  margin: 0 0 8px 0;
}

.empty-state p {
  margin-bottom: 20px;
}

.patterns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
}

.pattern-card {
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.pattern-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}

.card-image {
  position: relative;
  height: 200px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.05);
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.pattern-card:hover .card-image img {
  transform: scale(1.05);
}

.similarity-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 4px 10px;
  border-radius: 12px;
  color: white;
  font-size: 12px;
  font-weight: 500;
}

.card-info {
  padding: 20px;
}

.pattern-title {
  font-size: 18px;
  color: white;
  margin: 0 0 12px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pattern-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.tag {
  background: rgba(233, 69, 96, 0.2);
  color: #ff6b6b;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
}

.pattern-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.stat-item {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  flex: 1;
  min-width: 60px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.similarity-btn {
  background: rgba(77, 150, 255, 0.2);
  color: #4d96ff;
}

.similarity-btn:hover {
  background: rgba(77, 150, 255, 0.3);
}

.delete-btn {
  background: rgba(233, 69, 96, 0.2);
  color: #ff6b6b;
}

.delete-btn:hover {
  background: rgba(233, 69, 96, 0.3);
}

.load-more-section {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.load-more-btn {
  min-width: 160px;
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .works-page {
    padding: 0 10px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-left h1 {
    font-size: 24px;
  }

  .filter-group {
    width: 100%;
  }

  .filter-group .input-field {
    flex: 1;
  }

  .patterns-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  }

  .card-info {
    padding: 12px;
  }

  .pattern-title {
    font-size: 15px;
  }

  .pattern-stats {
    gap: 8px;
  }

  .card-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .action-btn {
    padding: 6px 8px;
    font-size: 12px;
  }

  .similarity-badge {
    font-size: 10px;
    padding: 3px 8px;
  }

  .search-info {
    flex-direction: column;
    align-items: stretch;
  }

  .search-controls {
    justify-content: space-between;
  }

  .threshold-slider {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .patterns-grid {
    grid-template-columns: 1fr;
  }

  .card-image {
    height: 180px;
  }
}
</style>
