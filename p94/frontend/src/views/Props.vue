<template>
  <div class="props-page">
    <div class="page-header">
      <h2 class="page-title">皮影道具展示</h2>
      <el-button type="primary" @click="$router.push('/collection')">
        <el-icon><Plus /></el-icon>
        新增道具
      </el-button>
    </div>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="分类">
          <el-select v-model="filterForm.category" placeholder="全部分类" clearable style="width: 150px">
            <el-option label="人物" value="人物" />
            <el-option label="动物" value="动物" />
            <el-option label="场景" value="场景" />
            <el-option label="器物" value="器物" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input
            v-model="filterForm.keyword"
            placeholder="搜索道具名称"
            style="width: 200px"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadProps">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="20" class="props-grid">
      <el-col :span="6" v-for="prop in propsList" :key="prop.id">
        <el-card class="prop-card" shadow="hover" @click.native="viewDetail(prop.id)">
          <div class="prop-image">
            <img v-if="prop.imageUrl" :src="prop.imageUrl" :alt="prop.name" />
            <div v-else class="placeholder-image">
              <el-icon><Image /></el-icon>
            </div>
          </div>
          <div class="prop-info">
            <h3 class="prop-name">{{ prop.name }}</h3>
            <el-tag size="small" type="info">{{ prop.category }}</el-tag>
            <p class="prop-desc">{{ prop.description || '暂无描述' }}</p>
            <div class="prop-meta">
              <span v-if="prop.material"><el-icon><Brush /></el-icon> {{ prop.material }}</span>
              <span v-if="prop.origin"><el-icon><Location /></el-icon> {{ prop.origin }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-pagination
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      :total="pagination.total"
      :page-sizes="[8, 16, 24, 32]"
      layout="total, sizes, prev, pager, next, jumper"
      @size-change="loadProps"
      @current-change="loadProps"
      class="pagination"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { propApi } from '../api'

const router = useRouter()
const propsList = ref([])
const filterForm = reactive({
  category: '',
  keyword: ''
})
const pagination = reactive({
  page: 1,
  size: 8,
  total: 0
})

const loadProps = async () => {
  try {
    const params = {
      page: pagination.page,
      size: pagination.size,
      category: filterForm.category || undefined,
      keyword: filterForm.keyword || undefined
    }
    const res = await propApi.list(params)
    propsList.value = res.data?.records || []
    pagination.total = res.data?.total || 0
  } catch (error) {
    console.error('加载道具列表失败:', error)
  }
}

const resetFilter = () => {
  filterForm.category = ''
  filterForm.keyword = ''
  pagination.page = 1
  loadProps()
}

const viewDetail = (id) => {
  router.push(`/prop/${id}`)
}

onMounted(() => {
  loadProps()
})
</script>

<style scoped>
.props-page {
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
.props-grid {
  margin-bottom: 20px;
}
.prop-card {
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 20px;
  height: 100%;
}
.prop-image {
  width: 100%;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 12px;
}
.prop-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.placeholder-image {
  color: #ccc;
  font-size: 48px;
}
.prop-name {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prop-desc {
  margin: 8px 0;
  font-size: 13px;
  color: #666;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}
.prop-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #999;
}
.prop-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}
.pagination {
  display: flex;
  justify-content: center;
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
  .prop-card {
    margin-bottom: 12px;
  }
  .prop-image {
    height: 150px;
  }
}

@media (max-width: 480px) {
  .prop-image {
    height: 120px;
  }
}
</style>
