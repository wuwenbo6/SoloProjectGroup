<template>
  <div class="home">
    <div class="hero-section">
      <div class="hero-content">
        <h1>传承竹编工艺 · 弘扬非遗文化</h1>
        <p>探索千年竹编艺术，记录传统工艺之美</p>
        <el-button type="primary" size="large" @click="$router.push('/crafts')">
          探索工艺
        </el-button>
        <el-button size="large" @click="$router.push('/upload')">
          上传作品
        </el-button>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">精选工艺</h2>
      <el-row :gutter="20">
        <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="item in featuredCrafts" :key="item.id">
          <el-card class="craft-card" shadow="hover" @click="$router.push(`/craft/${item.id}`)">
            <div class="card-image">
              <img :src="item.image" :alt="item.title" />
            </div>
            <template #footer>
              <div class="card-footer">
                <span class="title">{{ item.title }}</span>
                <div class="stats">
                  <span><el-icon><View /></el-icon> {{ item.views }}</span>
                  <span><el-icon><Star /></el-icon> {{ item.likes }}</span>
                </div>
              </div>
            </template>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <div class="section stats-section">
      <el-row :gutter="20">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-number">{{ stats.crafts }}</div>
            <div class="stat-label">工艺作品</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-number">{{ stats.artisans }}</div>
            <div class="stat-label">手工艺人</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-number">{{ stats.views }}</div>
            <div class="stat-label">浏览次数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-number">{{ stats.comments }}</div>
            <div class="stat-label">互动评论</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <div class="section">
      <h2 class="section-title">工艺流程</h2>
      <el-steps :active="4" finish-status="success" align-center>
        <el-step title="选材" description="精选优质竹材" />
        <el-step title="破竹" description="劈削成均匀竹篾" />
        <el-step title="编织" description="传统技法编织" />
        <el-step title="打磨" description="精细打磨处理" />
        <el-step title="成品" description="精美工艺作品" />
      </el-steps>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const featuredCrafts = ref([
  {
    id: 1,
    title: '竹编花篮',
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
    views: 1234,
    likes: 89
  },
  {
    id: 2,
    title: '竹编茶具',
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400',
    views: 856,
    likes: 67
  },
  {
    id: 3,
    title: '竹编收纳盒',
    image: 'https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=400',
    views: 2341,
    likes: 156
  },
  {
    id: 4,
    title: '竹编灯罩',
    image: 'https://images.unsplash.com/photo-1574169208507-84376144848b?w=400',
    views: 678,
    likes: 45
  }
])

const stats = ref({
  crafts: 128,
  artisans: 36,
  views: 52341,
  comments: 1892
})
</script>

<style scoped>
.home {
  max-width: 1400px;
  margin: 0 auto;
}

.hero-section {
  background: linear-gradient(135deg, #2d5016 0%, #4a7c23 50%, #6b9b37 100%);
  color: white;
  padding: 100px 50px;
  text-align: center;
  border-radius: 16px;
  margin-bottom: 50px;
}

.hero-content h1 {
  font-size: 42px;
  margin-bottom: 20px;
}

.hero-content p {
  font-size: 18px;
  margin-bottom: 40px;
  opacity: 0.9;
}

.hero-content .el-button {
  margin: 0 10px;
  padding: 20px 40px;
  font-size: 16px;
}

.section {
  margin-bottom: 60px;
}

.section-title {
  font-size: 28px;
  color: #2d5016;
  text-align: center;
  margin-bottom: 40px;
  position: relative;
}

.section-title::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 3px;
  background: #4a7c23;
  border-radius: 2px;
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
  height: 200px;
  overflow: hidden;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.craft-card:hover .card-image img {
  transform: scale(1.05);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-footer .title {
  font-weight: 600;
  color: #333;
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

.stats-section {
  background: white;
  padding: 50px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 48px;
  font-weight: bold;
  color: #4a7c23;
  margin-bottom: 10px;
}

.stat-label {
  font-size: 16px;
  color: #666;
}
</style>
