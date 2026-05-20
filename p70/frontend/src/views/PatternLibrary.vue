<template>
  <div class="pattern-library">
    <div class="page-header">
      <h2>纹样库</h2>
      <div class="filters">
        <el-select v-model="filterCategory" placeholder="选择分类" clearable>
          <el-option label="生角" value="生角" />
          <el-option label="旦角" value="旦角" />
          <el-option label="净角" value="净角" />
          <el-option label="末角" value="末角" />
          <el-option label="丑角" value="丑角" />
          <el-option label="未分类" value="未分类" />
        </el-select>
        
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索纹样" 
          prefix-icon="Search"
          style="width: 200px"
        />
      </div>
    </div>
    
    <div v-if="patternStore.loading" class="loading-wrapper">
      <el-skeleton :rows="5" animated />
    </div>
    
    <div v-else class="pattern-grid">
      <div 
        v-for="pattern in patternStore.patterns" 
        :key="pattern._id"
        class="pattern-card"
        @click="goToDetail(pattern._id)"
      >
        <div class="pattern-image">
          <img :src="pattern.imageUrl" :alt="pattern.name" />
          <div class="pattern-overlay">
            <el-button type="primary" size="small">查看详情</el-button>
          </div>
        </div>
        <div class="pattern-info">
          <h3 class="pattern-name">{{ pattern.name }}</h3>
          <el-tag size="small" type="info">{{ pattern.category }}</el-tag>
          <div class="pattern-meta">
            <span v-if="pattern.createdBy">
              <el-avatar :size="16" :src="pattern.createdBy.avatar" />
              {{ pattern.createdBy.username }}
            </span>
            <span>{{ formatDate(pattern.createdAt) }}</span>
          </div>
        </div>
      </div>
      
      <el-empty v-if="patternStore.patterns.length === 0" description="暂无纹样" />
    </div>
    
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="patternStore.currentPage"
        :page-size="12"
        :total="patternStore.totalPages * 12"
        layout="prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePatternStore } from '../stores/pattern'

const router = useRouter()
const patternStore = usePatternStore()

const filterCategory = ref('')
const searchKeyword = ref('')

onMounted(() => {
  loadPatterns()
})

const loadPatterns = () => {
  const params = {
    page: patternStore.currentPage,
    limit: 12
  }
  if (filterCategory.value) {
    params.category = filterCategory.value
  }
  patternStore.fetchPatterns(params)
}

const handlePageChange = (page) => {
  patternStore.currentPage = page
  loadPatterns()
}

const goToDetail = (id) => {
  router.push(`/pattern/${id}`)
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.pattern-library {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  h2 {
    font-size: 24px;
    color: #303133;
  }
  
  .filters {
    display: flex;
    gap: 12px;
  }
}

.loading-wrapper {
  padding: 20px;
}

.pattern-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
  align-content: start;
}

.pattern-card {
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}

.pattern-image {
  position: relative;
  height: 180px;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .pattern-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  &:hover .pattern-overlay {
    opacity: 1;
  }
}

.pattern-info {
  padding: 16px;
  
  .pattern-name {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #303133;
  }
  
  .pattern-meta {
    margin-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: #909399;
    
    span {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}
</style>
