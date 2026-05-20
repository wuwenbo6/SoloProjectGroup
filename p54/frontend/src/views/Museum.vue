<template>
  <div class="museum-page">
    <el-card class="page-header-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <h2>金石拓片馆藏数据库</h2>
            <span class="total-count">共 {{ stats.total }} 件馆藏</span>
          </div>
          <el-button
            type="primary"
            @click="syncMuseumData"
            :loading="syncLoading"
            v-if="isAdminOrExpert"
          >
            同步馆藏数据
          </el-button>
        </div>
      </template>

      <el-form :model="filters" inline class="search-form">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索名称、内容描述"
            clearable
            style="width: 200px"
            @keyup.enter="loadCollections"
          />
        </el-form-item>

        <el-form-item label="朝代">
          <el-select
            v-model="filters.dynasty"
            placeholder="选择朝代"
            clearable
            style="width: 120px"
            @change="loadCollections"
          >
            <el-option
              v-for="d in filterOptions.dynasties"
              :key="d"
              :label="d"
              :value="d"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="书体">
          <el-select
            v-model="filters.scriptType"
            placeholder="选择书体"
            clearable
            style="width: 120px"
            @change="loadCollections"
          >
            <el-option
              v-for="s in filterOptions.scriptTypes"
              :key="s"
              :label="s"
              :value="s"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="分类">
          <el-select
            v-model="filters.category"
            placeholder="选择分类"
            clearable
            style="width: 120px"
            @change="loadCollections"
          >
            <el-option
              v-for="c in filterOptions.categories"
              :key="c"
              :label="c"
              :value="c"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="来源博物馆">
          <el-select
            v-model="filters.museumCode"
            placeholder="选择博物馆"
            clearable
            style="width: 160px"
            @change="loadCollections"
          >
            <el-option
              v-for="m in filterOptions.museums"
              :key="m.code"
              :label="m.name"
              :value="m.code"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="loadCollections" :loading="loading">
            搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <div class="stats-bar">
        <el-space>
          <span class="stat-item">
            <strong>按朝代分布:</strong>
            <span
              v-for="item in stats.byDynasty"
              :key="item.dynasty"
              class="stat-tag"
            >
              {{ item.dynasty }}: {{ item.count }}
            </span>
          </span>
        </el-space>
      </div>
    </el-card>

    <div class="collection-list">
      <el-row :gutter="20">
        <el-col :span="6" v-for="item in collections" :key="item.id">
          <el-card class="collection-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <span class="collection-title">{{ item.title }}</span>
                <el-tag size="small" type="info">{{ item.dynasty }}</el-tag>
              </div>
            </template>

            <div class="collection-cover">
              <img v-if="item.imageUrl" :src="getFullImageUrl(item.imageUrl)" alt="拓片封面" />
              <div v-else class="no-image">
                <el-icon size="48"><Picture /></el-icon>
                <p>暂无图片</p>
              </div>
            </div>

            <div class="collection-info">
              <p v-if="item.originalTitle">原碑: {{ item.originalTitle }}</p>
              <p>书体: {{ item.scriptType || '未知' }}</p>
              <p>分类: {{ item.category || '未知' }}</p>
              <p>博物馆: {{ item.museumName }}</p>
              <p v-if="item.rubbingsDate">拓制: {{ item.rubbingsDate }}</p>
              <p v-if="item.charactersCount">字数: {{ item.charactersCount }} 字</p>
              <p v-if="item.preservation" class="preservation">
                保存状况:
                <el-tag :type="getPreservationType(item.preservation)" size="small">
                  {{ item.preservation }}
                </el-tag>
              </p>
            </div>

            <div class="collection-actions" v-if="isAdminOrExpert">
              <el-button
                type="primary"
                size="small"
                @click="importRubbing(item)"
                :loading="importingId === item.id"
              >
                导入为拓片
              </el-button>
              <el-button size="small" @click="viewDetail(item)">详情</el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[12, 24, 48]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadCollections"
        @current-change="loadCollections"
        class="pagination"
      />
    </div>

    <el-dialog v-model="showDetail" title="馆藏详情" width="600px">
      <div v-if="currentItem" class="detail-content">
        <div class="detail-header">
          <h3>{{ currentItem.title }}</h3>
          <el-tag type="info">{{ currentItem.dynasty }}</el-tag>
        </div>
        <div class="detail-info">
          <p><strong>原碑名称:</strong> {{ currentItem.originalTitle || '-' }}</p>
          <p><strong>博物馆:</strong> {{ currentItem.museumName }}</p>
          <p><strong>馆藏编号:</strong> {{ currentItem.collectionNo }}</p>
          <p><strong>书体类型:</strong> {{ currentItem.scriptType || '-' }}</p>
          <p><strong>分类:</strong> {{ currentItem.category || '-' }}</p>
          <p><strong>材质:</strong> {{ currentItem.material || '-' }}</p>
          <p><strong>出土地:</strong> {{ currentItem.location || '-' }}</p>
          <p><strong>拓制年代:</strong> {{ currentItem.rubbingsDate || '-' }}</p>
          <p><strong>拓片类型:</strong> {{ currentItem.rubbingsType || '-' }}</p>
          <p><strong>尺寸:</strong> {{ currentItem.size || '-' }}</p>
          <p><strong>文字数量:</strong> {{ currentItem.charactersCount || 0 }}</p>
          <p v-if="currentItem.tags?.length"><strong>标签:</strong>
            <el-tag v-for="tag in currentItem.tags" :key="tag" size="small" style="margin-right: 4px">
              {{ tag }}
            </el-tag>
          </p>
        </div>
        <div class="detail-desc" v-if="currentItem.description">
          <h4>描述</h4>
          <p>{{ currentItem.description }}</p>
        </div>
        <div class="detail-preview" v-if="currentItem.contentPreview">
          <h4>内容预览</h4>
          <p class="preview-text">{{ currentItem.contentPreview }}</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="showDetail = false">关闭</el-button>
        <el-button type="primary" @click="importRubbing(currentItem)" :loading="importingId === currentItem?.id">
          导入为拓片
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Picture } from '@element-plus/icons-vue'
import api from '@/services/api'
import { useAuthStore } from '@/store'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const syncLoading = ref(false)
const collections = ref([])
const filterOptions = ref({
  dynasties: [],
  scriptTypes: [],
  categories: [],
  materials: [],
  museums: []
})
const stats = ref({
  total: 0,
  byDynasty: [],
  byScriptType: [],
  byCategory: [],
  byMuseum: []
})
const pagination = ref({
  page: 1,
  pageSize: 12,
  total: 0
})
const filters = ref({
  keyword: '',
  dynasty: '',
  scriptType: '',
  category: '',
  museumCode: '',
  material: ''
})
const importingId = ref(null)
const showDetail = ref(false)
const currentItem = ref(null)

const isAdminOrExpert = computed(() => {
  return ['admin', 'expert'].includes(authStore.user?.role)
})

function getFullImageUrl(path) {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  return import.meta.env.VITE_API_BASE_URL + path
}

function getPreservationType(preservation) {
  const types = { '完好': 'success', '残损': 'warning', '破碎': 'danger' }
  return types[preservation] || 'info'
}

async function loadFilterOptions() {
  try {
    const res = await api.get('/museum/filters/options')
    filterOptions.value = res.data
  } catch (err) {
    console.error('加载筛选选项失败:', err)
  }
}

async function loadStats() {
  try {
    const res = await api.get('/museum/stats/summary')
    stats.value = res.data
  } catch (err) {
    console.error('加载统计数据失败:', err)
  }
}

async function loadCollections() {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      ...filters.value
    }
    const res = await api.get('/museum/list', { params })
    collections.value = res.data.collections || []
    pagination.value.total = res.data.total || 0
  } catch (err) {
    console.error('加载馆藏列表失败:', err)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

async function syncMuseumData() {
  syncLoading.value = true
  try {
    const res = await api.post('/museum/sync')
    ElMessage.success(res.data.message)
    loadCollections()
    loadStats()
  } catch (err) {
    ElMessage.error('同步失败: ' + (err.response?.data?.error || err.message))
  } finally {
    syncLoading.value = false
  }
}

async function importRubbing(item) {
  importingId.value = item.id
  try {
    const res = await api.post(`/museum/${item.id}/import`)
    ElMessage.success('导入成功，即将跳转到拓片页面')
    setTimeout(() => {
      router.push(`/rubbing/${res.data.rubbingId}`)
    }, 1000)
  } catch (err) {
    ElMessage.error('导入失败: ' + (err.response?.data?.error || err.message))
  } finally {
    importingId.value = null
  }
}

function viewDetail(item) {
  currentItem.value = item
  showDetail.value = true
}

function resetFilters() {
  filters.value = {
    keyword: '',
    dynasty: '',
    scriptType: '',
    category: '',
    museumCode: '',
    material: ''
  }
  loadCollections()
}

onMounted(() => {
  loadFilterOptions()
  loadStats()
  loadCollections()
})
</script>

<style scoped>
.museum-page {
  padding: 20px;
}

.page-header-card {
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-left h2 {
  margin: 0;
}

.total-count {
  color: #909399;
}

.search-form {
  padding: 15px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 15px;
}

.stats-bar {
  padding: 10px 0;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 10px 15px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-tag {
  background: #ecf5ff;
  color: #409eff;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.collection-list {
  margin-top: 20px;
}

.collection-card {
  margin-bottom: 20px;
  height: 100%;
}

.collection-card .collection-title {
  font-weight: bold;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-cover {
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 15px;
  overflow: hidden;
}

.collection-cover img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.no-image {
  text-align: center;
  color: #909399;
}

.no-image p {
  margin-top: 10px;
}

.collection-info p {
  margin: 6px 0;
  font-size: 13px;
  color: #606266;
}

.preservation {
  margin-top: 10px;
}

.collection-actions {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #ebeef5;
  display: flex;
  gap: 8px;
}

.pagination {
  text-align: center;
  margin-top: 20px;
}

.detail-content h3 {
  margin: 0 0 20px 0;
}

.detail-info p {
  margin: 10px 0;
  line-height: 1.6;
}

.detail-desc, .detail-preview {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.detail-desc h4, .detail-preview h4 {
  margin: 0 0 10px 0;
}

.preview-text {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  line-height: 1.8;
  color: #606266;
}
</style>
