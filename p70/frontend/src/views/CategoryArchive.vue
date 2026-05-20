<template>
  <div class="category-archive">
    <div class="page-header">
      <h2>分类归档</h2>
      <el-button type="primary" @click="showStats = !showStats">
        <el-icon><DataLine /></el-icon>
        {{ showStats ? '隐藏统计' : '显示统计' }}
      </el-button>
    </div>
    
    <div v-if="showStats" class="stats-panel">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <el-icon size="32" color="#409eff"><Picture /></el-icon>
              <div class="stat-info">
                <div class="stat-number">{{ totalPatterns }}</div>
                <div class="stat-label">总纹样数</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <el-icon size="32" color="#67c23a"><FolderOpened /></el-icon>
              <div class="stat-info">
                <div class="stat-number">{{ categories.length }}</div>
                <div class="stat-label">已分类</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <el-icon size="32" color="#e6a23c"><User /></el-icon>
              <div class="stat-info">
                <div class="stat-number">3</div>
                <div class="stat-label">协作成员</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <el-icon size="32" color="#f56c6c"><Edit /></el-icon>
              <div class="stat-info">
                <div class="stat-number">12</div>
                <div class="stat-label">今日编辑</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
    
    <div class="categories-grid">
      <div 
        v-for="category in categories" 
        :key="category.name"
        class="category-card"
        @click="filterByCategory(category.name)"
      >
        <div class="category-header" :style="{ background: category.color }">
          <el-icon size="40" color="#fff"><component :is="category.icon" /></el-icon>
          <span class="category-count">{{ category.count }}</span>
        </div>
        <div class="category-body">
          <h3>{{ category.name }}</h3>
          <p>{{ category.description }}</p>
        </div>
        <div class="category-footer">
          <el-tag size="small" type="info">点击查看</el-tag>
        </div>
      </div>
    </div>
    
    <div v-if="selectedCategory" class="category-patterns">
      <div class="section-header">
        <h3>{{ selectedCategory }} - 纹样列表</h3>
        <el-button link @click="selectedCategory = ''">
          <el-icon><Close /></el-icon>
          关闭
        </el-button>
      </div>
      <div class="patterns-list">
        <div 
          v-for="pattern in filteredPatterns" 
          :key="pattern._id"
          class="pattern-item"
        >
          <img :src="pattern.imageUrl" :alt="pattern.name" />
          <div class="pattern-info">
            <h4>{{ pattern.name }}</h4>
            <p>{{ pattern.description || '暂无描述' }}</p>
            <div class="pattern-tags">
              <el-tag v-for="tag in pattern.tags" :key="tag" size="small">
                {{ tag }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Picture, FolderOpened, User, Edit, DataLine, Close,
  MagicStick, Star, Medal, Trophy, Sunny
} from '@element-plus/icons-vue'

const router = useRouter()
const showStats = ref(true)
const selectedCategory = ref('')

const categories = ref([
  { 
    name: '生角', 
    count: 15, 
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    icon: MagicStick,
    description: '男性角色脸谱，通常为正面角色' 
  },
  { 
    name: '旦角', 
    count: 12, 
    color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    icon: Star,
    description: '女性角色脸谱，妆容柔美细腻' 
  },
  { 
    name: '净角', 
    count: 28, 
    color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    icon: Medal,
    description: '花脸角色，色彩丰富图案复杂' 
  },
  { 
    name: '末角', 
    count: 8, 
    color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    icon: Trophy,
    description: '中年以上男性角色，妆容庄重' 
  },
  { 
    name: '丑角', 
    count: 18, 
    color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    icon: Sunny,
    description: '滑稽角色，鼻梁有白色粉块' 
  },
  { 
    name: '未分类', 
    count: 5, 
    color: 'linear-gradient(135deg, #a8a8a8 0%, #6b6b6b 100%)',
    icon: FolderOpened,
    description: '待归类的纹样素材' 
  }
])

const patterns = ref([
  { _id: '1', name: '关羽红脸', category: '净角', imageUrl: 'https://picsum.photos/200/200?random=1', tags: ['红色', '整脸'], description: '关羽典型红脸，象征忠义' },
  { _id: '2', name: '包公黑脸', category: '净角', imageUrl: 'https://picsum.photos/200/200?random=2', tags: ['黑色', '整脸'], description: '包拯典型黑脸，象征公正' },
  { _id: '3', name: '孙悟空猴脸', category: '丑角', imageUrl: 'https://picsum.photos/200/200?random=3', tags: ['金色', '象形'], description: '孙悟空象形脸，金睛火眼' },
  { _id: '4', name: '旦角俊扮', category: '旦角', imageUrl: 'https://picsum.photos/200/200?random=4', tags: ['柔美', '淡妆'], description: '女性角色标准俊扮' },
  { _id: '5', name: '蒋干白脸', category: '丑角', imageUrl: 'https://picsum.photos/200/200?random=5', tags: ['白色', '豆腐块'], description: '蒋干典型丑角白脸' },
])

const totalPatterns = computed(() => {
  return categories.value.reduce((sum, c) => sum + c.count, 0)
})

const filteredPatterns = computed(() => {
  return patterns.value.filter(p => p.category === selectedCategory.value)
})

const filterByCategory = (categoryName) => {
  selectedCategory.value = categoryName
}
</script>

<style scoped>
.category-archive {
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
}

.stats-panel {
  margin-bottom: 24px;
}

.stat-card {
  .stat-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .stat-info {
    .stat-number {
      font-size: 28px;
      font-weight: 600;
      color: #303133;
    }
    
    .stat-label {
      font-size: 14px;
      color: #909399;
    }
  }
}

.categories-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  align-content: start;
}

.category-card {
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  color: #fff;
  
  .category-count {
    font-size: 32px;
    font-weight: 600;
  }
}

.category-body {
  padding: 20px;
  background: #fff;
  
  h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #303133;
  }
  
  p {
    font-size: 14px;
    color: #909399;
    margin: 0;
  }
}

.category-footer {
  padding: 12px 20px;
  background: #f5f7fa;
  border-top: 1px solid #e4e7ed;
}

.category-patterns {
  margin-top: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  
  h3 {
    font-size: 18px;
    color: #303133;
  }
}

.patterns-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pattern-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  
  img {
    width: 80px;
    height: 80px;
    border-radius: 6px;
    object-fit: cover;
  }
  
  .pattern-info {
    flex: 1;
    
    h4 {
      font-size: 16px;
      margin: 0 0 8px;
      color: #303133;
    }
    
    p {
      font-size: 14px;
      color: #909399;
      margin: 0 0 8px;
    }
    
    .pattern-tags {
      display: flex;
      gap: 6px;
    }
  }
}
</style>
