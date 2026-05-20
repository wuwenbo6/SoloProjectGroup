<template>
  <div class="home-page">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon">📚</div>
            <div class="stat-info">
              <div class="stat-number">{{ stats.totalBooks }}</div>
              <div class="stat-label">古籍总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon">🔄</div>
            <div class="stat-info">
              <div class="stat-number">{{ stats.restoring }}</div>
              <div class="stat-label">修复中</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon">✅</div>
            <div class="stat-info">
              <div class="stat-number">{{ stats.completed }}</div>
              <div class="stat-label">已完成</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon">📝</div>
            <div class="stat-info">
              <div class="stat-number">{{ stats.interpretations }}</div>
              <div class="stat-label">释义条目</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card class="quick-actions" shadow="hover">
          <template #header>
            <span>快捷操作</span>
          </template>
          <el-row :gutter="10">
            <el-col :span="12">
              <el-button type="primary" size="large" @click="goToUpload" style="width: 100%; height: 80px;">
                <div>📤</div>
                <div>上传古籍</div>
              </el-button>
            </el-col>
            <el-col :span="12">
              <el-button type="success" size="large" @click="goToRestoration" style="width: 100%; height: 80px;">
                <div>🔧</div>
                <div>开始修复</div>
              </el-button>
            </el-col>
          </el-row>
          <el-row :gutter="10" style="margin-top: 10px;">
            <el-col :span="12">
              <el-button type="warning" size="large" @click="goToInterpretation" style="width: 100%; height: 80px;">
                <div>📖</div>
                <div>古文释义</div>
              </el-button>
            </el-col>
            <el-col :span="12">
              <el-button type="info" size="large" @click="goToLibrary" style="width: 100%; height: 80px;">
                <div>🏛️</div>
                <div>古籍库</div>
              </el-button>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="recent-activity" shadow="hover">
          <template #header>
            <span>最近活动</span>
          </template>
          <el-timeline>
            <el-timeline-item
                v-for="(activity, index) in recentActivities"
                :key="index"
                :timestamp="activity.time"
                :type="activity.type"
            >
              {{ activity.content }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const stats = ref({
  totalBooks: 128,
  restoring: 15,
  completed: 89,
  interpretations: 2567
})

const recentActivities = ref([
  { content: '上传了《论语》第3页', time: '10分钟前', type: 'primary' },
  { content: '完成了《孟子》残页自动排版', time: '30分钟前', type: 'success' },
  { content: 'AI完成了12个异体字转换', time: '1小时前', type: 'warning' },
  { content: '新增了3条释义对照数据', time: '2小时前', type: 'info' }
])

const goToUpload = () => router.push('/upload')
const goToRestoration = () => router.push('/library')
const goToInterpretation = () => router.push('/interpretation')
const goToLibrary = () => router.push('/library')
</script>

<style scoped>
.home-page {
  padding: 0;
}

.stat-card {
  background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  font-size: 40px;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #8b5a2b;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.quick-actions .el-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.recent-activity {
  height: 100%;
}
</style>
