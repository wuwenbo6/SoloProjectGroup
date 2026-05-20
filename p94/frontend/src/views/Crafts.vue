<template>
  <div class="crafts-page">
    <div class="page-header">
      <h2 class="page-title">皮影工艺说明</h2>
      <el-button type="primary" @click="$router.push('/craft/edit/new')">
        <el-icon><Plus /></el-icon>
        新增工艺
      </el-button>
    </div>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="分类">
          <el-select v-model="filterForm.category" placeholder="全部分类" clearable style="width: 150px" @change="onFilterChange">
            <el-option label="雕刻" value="雕刻" />
            <el-option label="染色" value="染色" />
            <el-option label="装订" value="装订" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input
            v-model="filterForm.keyword"
            placeholder="搜索工艺名称"
            style="width: 200px"
            clearable
            @keyup.enter="onFilterChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onFilterChange" :loading="loading">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div v-if="loading && craftsList.length === 0" class="skeleton-grid">
      <el-row :gutter="20">
        <el-col :span="8" v-for="i in 6" :key="i">
          <el-card class="skeleton-card">
            <el-skeleton :rows="4" animated />
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-row :gutter="20" class="crafts-grid" v-else>
      <el-col :span="8" v-for="craft in craftsList" :key="craft.id">
        <el-card class="craft-card" shadow="hover" @click.native="viewDetail(craft.id)">
          <div class="craft-header">
            <h3 class="craft-title">{{ craft.title }}</h3>
            <el-tag size="small" type="info">{{ craft.category }}</el-tag>
          </div>
          <p class="craft-content">{{ craft.content }}</p>
          <div class="craft-meta">
            <div class="meta-item">
              <el-icon><Star /></el-icon>
              <span>难度: {{ getDifficultyText(craft.difficultyLevel) }}</span>
            </div>
            <div class="meta-item" v-if="craft.duration">
              <el-icon><Timer /></el-icon>
              <span>{{ craft.duration }}</span>
            </div>
            <div class="meta-item">
              <el-icon><View /></el-icon>
              <span>{{ craft.viewCount || 0 }} 次浏览</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-pagination
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      :total="pagination.total"
      :page-sizes="[6, 12, 18, 24]"
      layout="total, sizes, prev, pager, next, jumper"
      @size-change="onPageChange"
      @current-change="onPageChange"
      class="pagination"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { craftApi } from '../api'

const router = useRouter()
const craftsList = ref([])
const loading = ref(false)
let debounceTimer = null

const filterForm = reactive({
  category: '',
  keyword: ''
})

const pagination = reactive({
  page: 1,
  size: 6,
  total: 0
})

const loadCrafts = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      size: pagination.size,
      category: filterForm.category || undefined,
      keyword: filterForm.keyword || undefined
    }
    const res = await craftApi.list(params)
    craftsList.value = res.data?.records || []
    pagination.total = res.data?.total || 0
  } catch (error) {
    console.error('加载工艺列表失败:', error)
  } finally {
    loading.value = false
  }
}

const debounceLoad = (delay = 300) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    pagination.page = 1
    loadCrafts()
  }, delay)
}

const onFilterChange = () => {
  debounceLoad()
}

const onPageChange = () => {
  loadCrafts()
}

const resetFilter = () => {
  filterForm.category = ''
  filterForm.keyword = ''
  pagination.page = 1
  loadCrafts()
}

const viewDetail = (id) => {
  router.push(`/craft/${id}`)
}

const getDifficultyText = (level) => {
  const map = { 1: '简单', 2: '中等', 3: '困难', 4: '专家' }
  return map[level] || '-'
}

onMounted(() => {
  loadCrafts()
})

onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})
</script>

<style scoped>
.crafts-page {
  padding: 0;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-title {
  margin: 0;
  font-size: 24px;
  color: #333;
}
.filter-card {
  margin-bottom: 20px;
  border-radius: 8px;
}
.crafts-grid {
  margin-bottom: 20px;
}
.craft-card {
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 20px;
  height: 100%;
}
.craft-header {
  margin-bottom: 12px;
}
.craft-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.craft-content {
  margin: 12px 0;
  font-size: 13px;
  color: #666;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  min-height: 58px;
}
.craft-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #999;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}
.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pagination {
  display: flex;
  justify-content: center;
}
.skeleton-grid {
  margin-bottom: 20px;
}
.skeleton-card {
  border-radius: 8px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .page-title {
    font-size: 20px;
  }
  .filter-card .el-form {
    flex-direction: column;
  }
  .filter-card .el-form-item {
    margin-bottom: 12px;
  }
  .craft-card {
    margin-bottom: 12px;
  }
  .craft-content {
    display: none;
  }
  .craft-meta {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
