<template>
  <div class="home-page">
    <h2 class="page-title">欢迎使用皮影道具采集系统</h2>
    
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon prop-icon"><Grid /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.propCount }}</div>
              <div class="stat-label">道具总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon craft-icon"><Document /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.craftCount }}</div>
              <div class="stat-label">工艺说明</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon user-icon"><User /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.userCount }}</div>
              <div class="stat-label">用户数量</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon collab-icon"><Connection /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.collabCount }}</div>
              <div class="stat-label">协同任务</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="action-row">
      <el-col :span="12">
        <el-card class="action-card">
          <template #header>
            <span>快捷操作</span>
          </template>
          <div class="action-buttons">
            <el-button type="primary" size="large" @click="$router.push('/collection')">
              <el-icon><Plus /></el-icon>
              新增道具
            </el-button>
            <el-button type="success" size="large" @click="$router.push('/craft/edit/new')">
              <el-icon><Edit /></el-icon>
              编辑工艺
            </el-button>
            <el-button type="warning" size="large" @click="$router.push('/collaboration')">
              <el-icon><User /></el-icon>
              协同采集
            </el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="action-card">
          <template #header>
            <span>快速导航</span>
          </template>
          <div class="nav-links">
            <div class="nav-item" @click="$router.push('/props')">
              <el-icon class="nav-icon"><Grid /></el-icon>
              <span>浏览所有道具</span>
            </div>
            <div class="nav-item" @click="$router.push('/crafts')">
              <el-icon class="nav-icon"><Document /></el-icon>
              <span>查看工艺说明</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="recent-card">
      <template #header>
        <span>最近采集的道具</span>
      </template>
      <el-table :data="recentProps" style="width: 100%">
        <el-table-column prop="name" label="道具名称" />
        <el-table-column prop="category" label="分类" />
        <el-table-column prop="material" label="材质" />
        <el-table-column prop="createdAt" label="采集时间">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewProp(row.id)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { propApi, craftApi, userApi } from '../api'

const router = useRouter()
const stats = ref({
  propCount: 0,
  craftCount: 0,
  userCount: 0,
  collabCount: 0
})
const recentProps = ref([])

const loadStats = async () => {
  try {
    const [propsRes, craftsRes, usersRes] = await Promise.all([
      propApi.list({ page: 1, size: 1 }),
      craftApi.list({ page: 1, size: 1 }),
      userApi.list()
    ])
    stats.value.propCount = propsRes.data?.total || 0
    stats.value.craftCount = craftsRes.data?.total || 0
    stats.value.userCount = usersRes.data?.length || 0
    stats.value.collabCount = 0
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

const loadRecentProps = async () => {
  try {
    const res = await propApi.list({ page: 1, size: 5 })
    recentProps.value = res.data?.records || []
  } catch (error) {
    console.error('加载最近道具失败:', error)
  }
}

const viewProp = (id) => {
  router.push(`/prop/${id}`)
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

onMounted(() => {
  loadStats()
  loadRecentProps()
})
</script>

<style scoped>
.home-page {
  padding: 0;
}
.page-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  color: #333;
}
.stats-row {
  margin-bottom: 20px;
}
.stat-card {
  border-radius: 8px;
}
.stat-content {
  display: flex;
  align-items: center;
  gap: 15px;
}
.stat-icon {
  font-size: 40px;
  padding: 15px;
  border-radius: 10px;
}
.prop-icon {
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
}
.craft-icon {
  color: #f093fb;
  background: rgba(240, 147, 251, 0.1);
}
.user-icon {
  color: #4facfe;
  background: rgba(79, 172, 254, 0.1);
}
.collab-icon {
  color: #43e97b;
  background: rgba(67, 233, 123, 0.1);
}
.stat-info {
  flex: 1;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}
.stat-label {
  font-size: 14px;
  color: #999;
  margin-top: 5px;
}
.action-row {
  margin-bottom: 20px;
}
.action-card {
  border-radius: 8px;
}
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.action-buttons .el-button {
  justify-content: flex-start;
}
.nav-links {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s;
}
.nav-item:hover {
  background: #f5f7fa;
}
.nav-icon {
  font-size: 20px;
  color: #667eea;
}
.recent-card {
  border-radius: 8px;
}

@media (max-width: 768px) {
  .page-title {
    font-size: 20px;
  }
  .stat-content {
    flex-direction: column;
    text-align: center;
  }
  .stat-icon {
    font-size: 32px;
    padding: 10px;
  }
  .stat-value {
    font-size: 24px;
  }
  .action-buttons {
    gap: 10px;
  }
  .nav-links {
    gap: 10px;
  }
}
</style>
