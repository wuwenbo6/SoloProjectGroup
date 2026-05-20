<template>
  <div class="craft-list">
    <div class="page-header">
      <h1>竹编工艺作品</h1>
      <p>探索传统竹编艺术之美</p>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索工艺作品..."
        prefix-icon="Search"
        style="width: 300px;"
        @input="handleSearch"
      />
      <el-select v-model="selectedCategory" placeholder="选择分类" style="width: 150px; margin-left: 20px;">
        <el-option label="全部" value="" />
        <el-option label="日用器具" value="daily" />
        <el-option label="装饰摆件" value="decor" />
        <el-option label="茶具套装" value="tea" />
        <el-option label="收纳用品" value="storage" />
      </el-select>
      <el-select v-model="sortBy" placeholder="排序方式" style="width: 150px; margin-left: 20px;">
        <el-option label="默认排序" value="default" />
        <el-option label="相似度优先" value="similarity" />
        <el-option label="最新发布" value="newest" />
        <el-option label="最多浏览" value="views" />
        <el-option label="最多点赞" value="likes" />
      </el-select>
      <el-button type="primary" style="margin-left: auto;" @click="$router.push('/upload')">
        <el-icon><Plus /></el-icon>
        上传作品
      </el-button>
    </div>

    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="item in sortedCraftList" :key="item.id">
        <el-card class="craft-card" shadow="hover" @click="$router.push(`/craft/${item.id}`)">
          <div class="card-image">
            <el-image :src="item.image" fit="cover" style="width: 100%; height: 200px;" />
            <div class="category-tag">{{ item.category }}</div>
            <div v-if="item.similarity" class="similarity-tag">
              <el-icon><Connection /></el-icon>
              {{ item.similarity }}%
            </div>
          </div>
          <div class="card-content">
            <h3 class="craft-title">{{ item.title }}</h3>
            <p class="craft-desc">{{ item.description }}</p>
            <div class="craft-artisan">
              <el-avatar :size="32" :src="item.artisanAvatar" />
              <span>{{ item.artisanName }}</span>
            </div>
          </div>
          <template #footer>
            <div class="card-footer">
              <div class="stats">
                <span><el-icon><View /></el-icon> {{ item.views }}</span>
                <span><el-icon><Star /></el-icon> {{ item.likes }}</span>
                <span><el-icon><ChatDotRound /></el-icon> {{ item.comments }}</span>
              </div>
              <span class="date">{{ item.createTime }}</span>
            </div>
          </template>
        </el-card>
      </el-col>
    </el-row>

    <div class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next, jumper"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { craftApi } from '../api'

const searchKeyword = ref('')
const selectedCategory = ref('')
const sortBy = ref('default')
const currentPage = ref(1)
const pageSize = ref(12)
const total = ref(0)

const calculateSimilarity = (item, keyword) => {
  if (!keyword) return 0
  let score = 0
  const lowerKeyword = keyword.toLowerCase()
  if (item.title.toLowerCase().includes(lowerKeyword)) score += 50
  if (item.description.toLowerCase().includes(lowerKeyword)) score += 30
  if (item.category.toLowerCase().includes(lowerKeyword)) score += 20
  if (item.artisanName.toLowerCase().includes(lowerKeyword)) score += 15
  return Math.min(100, score)
}

const craftListWithSimilarity = computed(() => {
  return craftList.value.map(item => ({
    ...item,
    similarity: calculateSimilarity(item, searchKeyword.value)
  }))
})

const sortedCraftList = computed(() => {
  let list = [...craftListWithSimilarity.value]
  
  if (selectedCategory.value) {
    list = list.filter(item => item.category.includes(selectedCategory.value))
  }
  
  switch (sortBy.value) {
    case 'similarity':
      return list.sort((a, b) => b.similarity - a.similarity)
    case 'newest':
      return list.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
    case 'views':
      return list.sort((a, b) => b.views - a.views)
    case 'likes':
      return list.sort((a, b) => b.likes - a.likes)
    default:
      return list
  }
})

watch(searchKeyword, () => {
  if (searchKeyword.value) {
    sortBy.value = 'similarity'
  }
})

const craftList = ref([
  {
    id: 1,
    title: '传统竹编花篮',
    description: '采用千年传承技法，纯手工编织而成',
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
    category: '日用器具',
    artisanName: '张师傅',
    artisanAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    views: 1234,
    likes: 89,
    comments: 23,
    createTime: '2024-01-15'
  },
  {
    id: 2,
    title: '竹编茶具套装',
    description: '精美竹编工艺与茶文化的完美结合',
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400',
    category: '茶具套装',
    artisanName: '李师傅',
    artisanAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    views: 856,
    likes: 67,
    comments: 15,
    createTime: '2024-01-12'
  },
  {
    id: 3,
    title: '竹编收纳盒',
    description: '精致实用的竹编收纳，让生活更有条理',
    image: 'https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=400',
    category: '收纳用品',
    artisanName: '王师傅',
    artisanAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    views: 2341,
    likes: 156,
    comments: 42,
    createTime: '2024-01-10'
  },
  {
    id: 4,
    title: '竹编装饰灯罩',
    description: '温馨的灯光透过竹编纹路，营造独特氛围',
    image: 'https://images.unsplash.com/photo-1574169208507-84376144848b?w=400',
    category: '装饰摆件',
    artisanName: '陈师傅',
    artisanAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    views: 678,
    likes: 45,
    comments: 8,
    createTime: '2024-01-08'
  },
  {
    id: 5,
    title: '竹编果盘',
    description: '天然竹材编织，健康环保的用餐选择',
    image: 'https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=400',
    category: '日用器具',
    artisanName: '赵师傅',
    artisanAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    views: 543,
    likes: 38,
    comments: 12,
    createTime: '2024-01-05'
  },
  {
    id: 6,
    title: '竹编花瓶',
    description: '艺术品级别的竹编花瓶，点缀生活',
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
    category: '装饰摆件',
    artisanName: '刘师傅',
    artisanAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    views: 987,
    likes: 72,
    comments: 19,
    createTime: '2024-01-03'
  },
  {
    id: 7,
    title: '竹编手提包',
    description: '时尚与传统的碰撞，独特的手工包',
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400',
    category: '日用器具',
    artisanName: '周师傅',
    artisanAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    views: 765,
    likes: 54,
    comments: 11,
    createTime: '2024-01-01'
  },
  {
    id: 8,
    title: '竹编茶垫套装',
    description: '保护桌面的同时，增添艺术气息',
    image: 'https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=400',
    category: '茶具套装',
    artisanName: '吴师傅',
    artisanAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    views: 432,
    likes: 31,
    comments: 7,
    createTime: '2023-12-28'
  }
])

total.value = craftList.value.length

const handleSearch = () => {
  console.log('搜索:', searchKeyword.value)
}

const handlePageChange = (page) => {
  console.log('页码:', page)
}

onMounted(() => {
})
</script>

<style scoped>
.craft-list {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h1 {
  font-size: 36px;
  color: #2d5016;
  margin-bottom: 10px;
}

.page-header p {
  font-size: 16px;
  color: #666;
}

.filter-bar {
  display: flex;
  align-items: center;
  background: white;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 30px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.craft-card {
  cursor: pointer;
  transition: transform 0.3s;
  margin-bottom: 20px;
}

.craft-card:hover {
  transform: translateY(-5px);
}

.card-image {
  position: relative;
  overflow: hidden;
  height: 200px;
  background: #f5f5f5;
}

:deep(.card-image .el-image) {
  width: 100%;
  height: 100%;
}

:deep(.card-image .el-image__inner) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #f5f5f5;
}

.category-tag {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(74, 124, 35, 0.9);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  z-index: 10;
}

.card-content {
  padding: 15px;
}

.craft-title {
  font-size: 18px;
  color: #333;
  margin-bottom: 8px;
}

.craft-desc {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.craft-artisan {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #888;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-footer .stats {
  display: flex;
  gap: 15px;
  font-size: 14px;
  color: #666;
}

.card-footer .stats span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-footer .date {
  font-size: 12px;
  color: #999;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 40px;
}

.similarity-tag {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(64, 158, 255, 0.9);
  color: white;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
}

@media (max-width: 768px) {
  .filter-bar {
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .filter-bar .el-input,
  .filter-bar .el-select {
    width: 100% !important;
    margin-left: 0 !important;
  }
  
  .filter-bar .el-button {
    width: 100%;
    margin-left: 0 !important;
  }
  
  .page-header h1 {
    font-size: 28px;
  }
}
</style>
