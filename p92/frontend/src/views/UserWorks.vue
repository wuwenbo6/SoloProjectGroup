<template>
  <div class="user-works">
    <el-card class="profile-card" v-loading="profileLoading">
      <div class="profile-content">
        <el-avatar :size="100" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
        <div class="profile-info">
          <h2>竹编艺人</h2>
          <p class="profile-desc">非遗竹编传承人，专注传统工艺30年</p>
          <div class="profile-stats">
            <div class="stat-item">
              <span class="stat-number">{{ works.length }}</span>
              <span class="stat-label">作品数量</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ totalViews }}</span>
              <span class="stat-label">总浏览</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ totalLikes }}</span>
              <span class="stat-label">获赞数</span>
            </div>
          </div>
        </div>
        <el-button type="primary" @click="$router.push('/upload')">
          <el-icon><Plus /></el-icon>
          发布新作品
        </el-button>
      </div>
    </el-card>

    <el-card class="works-card" v-loading="worksLoading" element-loading-text="正在加载作品...">
      <template #header>
        <div class="works-header">
          <span>我的作品</span>
          <el-radio-group v-model="filterStatus" size="small" @change="filterWorks">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="published">已发布</el-radio-button>
            <el-radio-button value="pending">审核中</el-radio-button>
            <el-radio-button value="draft">草稿</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <el-table 
        :data="filteredWorks" 
        style="width: 100%"
        :virtual-scroll="true"
        height="600"
      >
        <el-table-column label="作品预览" width="120">
          <template #default="{ row }">
            <el-image 
              :src="row.image" 
              fit="cover" 
              style="width: 80px; height: 80px; border-radius: 8px;"
              :lazy="true"
              loading="lazy"
            />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="作品名称" width="200" />
        <el-table-column prop="category" label="分类" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="数据统计" width="200">
          <template #default="{ row }">
            <span style="margin-right: 15px;"><el-icon><View /></el-icon> {{ row.views }}</span>
            <span style="margin-right: 15px;"><el-icon><Star /></el-icon> {{ row.likes }}</span>
            <span><el-icon><ChatDotRound /></el-icon> {{ row.comments }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="发布时间" width="150" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row)">查看</el-button>
            <el-button link type="primary" size="small" @click="editWork(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="deleteWork(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { craftApi } from '../api'

const router = useRouter()
const filterStatus = ref('all')
const currentPage = ref(1)
const pageSize = ref(10)
const profileLoading = ref(false)
const worksLoading = ref(false)

const works = ref([
  {
    id: 1,
    title: '传统竹编花篮',
    category: '日用器具',
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200',
    views: 1234,
    likes: 89,
    comments: 23,
    createTime: '2024-01-15',
    status: 'published'
  },
  {
    id: 2,
    title: '竹编茶具套装',
    category: '茶具套装',
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200',
    views: 856,
    likes: 67,
    comments: 15,
    createTime: '2024-01-12',
    status: 'published'
  },
  {
    id: 3,
    title: '竹编收纳盒',
    category: '收纳用品',
    image: 'https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=200',
    views: 2341,
    likes: 156,
    comments: 42,
    createTime: '2024-01-10',
    status: 'published'
  },
  {
    id: 4,
    title: '竹编装饰灯罩',
    category: '装饰摆件',
    image: 'https://images.unsplash.com/photo-1574169208507-84376144848b?w=200',
    views: 678,
    likes: 45,
    comments: 8,
    createTime: '2024-01-08',
    status: 'pending'
  },
  {
    id: 5,
    title: '竹编果盘',
    category: '日用器具',
    image: 'https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=200',
    views: 0,
    likes: 0,
    comments: 0,
    createTime: '2024-01-20',
    status: 'draft'
  }
])

const total = ref(works.value.length)

const filteredWorks = computed(() => {
  if (filterStatus.value === 'all') return works.value
  return works.value.filter(w => w.status === filterStatus.value)
})

const totalViews = computed(() => works.value.reduce((sum, w) => sum + w.views, 0))
const totalLikes = computed(() => works.value.reduce((sum, w) => sum + w.likes, 0))

const getStatusType = (status) => {
  const map = {
    published: 'success',
    pending: 'warning',
    draft: 'info'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    published: '已发布',
    pending: '审核中',
    draft: '草稿'
  }
  return map[status] || status
}

const loadUserWorks = async (page = currentPage.value) => {
  worksLoading.value = true
  try {
    const userId = 1
    const result = await craftApi.getUserWorks(userId, page, pageSize.value)
    if (result && result.data) {
      works.value = result.data.records || works.value
      total.value = result.data.total || works.value.length
    }
  } catch (error) {
    console.warn('加载作品列表失败，使用模拟数据:', error)
  } finally {
    worksLoading.value = false
  }
}

const handlePageChange = (page) => {
  currentPage.value = page
  loadUserWorks(page)
}

const filterWorks = () => {
  currentPage.value = 1
  if (filterStatus.value !== 'all') {
    const filtered = works.value.filter(w => w.status === filterStatus.value)
    total.value = filtered.length
  } else {
    total.value = works.value.length
  }
}

const viewDetail = (row) => {
  router.push(`/craft/${row.id}`)
}

const editWork = (row) => {
  ElMessage.info(`编辑作品: ${row.title}`)
}

const deleteWork = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除作品「${row.title}」吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const index = works.value.findIndex(w => w.id === row.id)
    if (index > -1) {
      works.value.splice(index, 1)
      total.value--
    }
    ElMessage.success('删除成功')
  } catch {
    // 用户取消删除
  }
}

onMounted(() => {
  loadUserWorks()
})
</script>

<style scoped>
.user-works {
  max-width: 1200px;
  margin: 0 auto;
}

.profile-card {
  margin-bottom: 30px;
}

.profile-content {
  display: flex;
  align-items: center;
  gap: 30px;
  padding: 20px;
}

.profile-info {
  flex: 1;
}

.profile-info h2 {
  font-size: 24px;
  color: #333;
  margin-bottom: 10px;
}

.profile-desc {
  font-size: 14px;
  color: #666;
  margin-bottom: 20px;
}

.profile-stats {
  display: flex;
  gap: 50px;
}

.stat-item {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 28px;
  font-weight: bold;
  color: #2d5016;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #888;
}

.works-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.works-header span {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 30px;
}
</style>
