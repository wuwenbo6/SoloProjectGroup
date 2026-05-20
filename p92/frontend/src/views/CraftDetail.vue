<template>
  <div class="craft-detail">
    <el-row :gutter="30">
      <el-col :xs="24" :sm="24" :md="14">
        <el-card class="image-card">
          <el-image :src="craft.image" fit="contain" style="width: 100%; height: 500px; background: #f5f5f5;" />
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="24" :md="10">
        <div class="craft-info">
          <h1 class="craft-title">{{ craft.title }}</h1>
          <div class="craft-category">
            <el-tag type="success">{{ craft.category }}</el-tag>
          </div>
          <p class="craft-description">{{ craft.description }}</p>
          
          <div class="artisan-info">
            <el-avatar :size="64" :src="craft.artisanAvatar" />
            <div class="artisan-detail">
              <div class="artisan-name">{{ craft.artisanName }}</div>
              <div class="artisan-desc">非遗传承人 · 从业30年</div>
            </div>
          </div>

          <div class="action-buttons">
            <el-button type="primary" size="large" @click="handleLike">
              <el-icon><Star /></el-icon>
              点赞 ({{ craft.likes }})
            </el-button>
            <el-button size="large" @click="handleShare">
              <el-icon><Share /></el-icon>
              分享
            </el-button>
          </div>

          <div class="stats-row">
            <div class="stat-item">
              <el-icon><View /></el-icon>
              <span>{{ craft.views }} 次浏览</span>
            </div>
            <div class="stat-item">
              <el-icon><ChatDotRound /></el-icon>
              <span>{{ comments.length }} 条评论</span>
            </div>
            <div class="stat-item">
              <el-icon><Clock /></el-icon>
              <span>发布于 {{ craft.createTime }}</span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-card class="steps-section">
      <template #header>
        <div class="section-header">
          <span><el-icon><Guide /></el-icon> 工艺步骤演示</span>
          <div class="step-controls">
            <el-switch v-model="autoPlay" active-text="自动播放" style="margin-right: 15px;" />
            <el-button-group>
              <el-button :icon="ArrowLeft" size="small" @click="prevStep" :disabled="currentStep === 0" />
              <el-button size="small">{{ currentStep + 1 }} / {{ craftSteps.length }}</el-button>
              <el-button :icon="ArrowRight" size="small" @click="nextStep" :disabled="currentStep === craftSteps.length - 1" />
            </el-button-group>
          </div>
        </div>
      </template>

      <div class="step-demo">
        <div class="step-progress">
          <div 
            v-for="(step, index) in craftSteps" 
            :key="index" 
            class="progress-item"
            :class="{ active: index === currentStep, completed: index < currentStep }"
            @click="jumpToStep(index)"
          >
            <div class="step-number">{{ index + 1 }}</div>
            <div class="step-title-mini">{{ step.title }}</div>
          </div>
        </div>

        <div class="step-content" :key="currentStep">
          <div class="step-image">
            <el-image :src="stepImages[currentStep] || craft.image" fit="cover" style="width: 100%; height: 300px;" />
          </div>
          <div class="step-detail">
            <h3>第 {{ currentStep + 1 }} 步：{{ craftSteps[currentStep]?.title }}</h3>
            <p class="step-desc">{{ craftSteps[currentStep]?.desc }}</p>
            <div class="step-tips">
              <el-alert title="技巧提示" :type="tipTypes[currentStep % tipTypes.length]" show-icon>
                <template #default>
                  {{ stepTips[currentStep] || '仔细观察匠人手法，注意力度与节奏。' }}
                </template>
              </el-alert>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="comments-section">
      <template #header>
        <div class="comments-header">
          <span>评论互动 ({{ comments.length }})</span>
        </div>
      </template>

      <div class="comment-input">
        <el-input
          v-model="newComment"
          type="textarea"
          :rows="3"
          placeholder="分享您对这件作品的看法..."
        />
        <el-button type="primary" style="margin-top: 15px;" @click="submitComment">
          发表评论
        </el-button>
      </div>

      <div class="comments-list">
        <div v-for="comment in comments" :key="comment.id" class="comment-item">
          <el-avatar :size="40" :src="comment.userAvatar" />
          <div class="comment-content">
            <div class="comment-header">
              <span class="username">{{ comment.username }}</span>
              <span class="time">{{ comment.time }}</span>
            </div>
            <p class="comment-text">{{ comment.content }}</p>
            <div class="comment-actions">
              <el-button text size="small" @click="likeComment(comment.id)">
                <el-icon><Thumb /></el-icon>
                {{ comment.likes }}
              </el-button>
              <el-button text size="small" @click="replyComment(comment.id)">
                <el-icon><Promotion /></el-icon>
                回复
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { interactionApi } from '../api'
import websocket from '../utils/websocket'

const route = useRoute()
const newComment = ref('')
const newCommentNotification = ref(null)

const craft = ref({
  id: 1,
  title: '传统竹编花篮',
  description: '采用千年传承技法，纯手工编织而成。精选优质毛竹，经过选材、破竹、刮青、分丝、编织等十几道工序，每件作品都凝聚着匠人的心血与智慧。',
  image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800',
  category: '日用器具',
  artisanName: '张师傅',
  artisanAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
  views: 1234,
  likes: 89,
  createTime: '2024-01-15'
})

const currentStep = ref(0)
const autoPlay = ref(false)
let autoPlayTimer = null

const craftSteps = ref([
  { title: '选材备料', desc: '选取3年以上优质毛竹，竹身挺直、色泽均匀、无虫蛀、无损伤。根据制品大小截取合适长度。' },
  { title: '破竹刮青', desc: '使用特制破竹刀将竹筒劈成宽度均匀的竹片，然后用刮刀刮去竹青表面，露出内部竹黄。' },
  { title: '分丝拉丝', desc: '将竹片逐次分割成细竹丝，使用拉丝工具将竹丝打磨光滑，粗细一致，柔韧度适中。' },
  { title: '编织底架', desc: '采用十字交叉法编织底部，注意经纬线的均匀分布，确保底座平整牢固，为后续编织打好基础。' },
  { title: '盘编成型', desc: '使用盘编技法编织篮身，采用挑一压一或挑二压二的编织纹路，保持张力均匀，造型美观。' },
  { title: '收口处理', desc: '篮身编织完成后进行收口，将多余竹丝巧妙收编，形成圆润光滑的口沿，增加整体质感。' },
  { title: '打磨上油', desc: '使用砂纸精细打磨表面，去除毛刺后涂抹天然桐油，既防腐防虫又增添光泽，提升艺术价值。' }
])

const stepImages = [
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600',
  'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600',
  'https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=600',
  'https://images.unsplash.com/photo-1574169208507-84376144848b?w=600',
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600',
  'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600',
  'https://images.unsplash.com/photo-1595408076683-5d0c8f0e3a3e?w=600'
]

const stepTips = [
  '选材时注意观察竹节间距，间距均匀的竹子韧性更佳。',
  '破竹时用力要稳，沿竹纹方向劈开，避免劈偏。',
  '分丝要耐心，初学者可先练习较粗的竹丝，逐步提高精度。',
  '底架编织时，可用重物压住中心，防止移位。',
  '盘编时保持竹丝湿润，可喷水增加韧性，避免断裂。',
  '收口是关键，多练习才能收得整齐美观。',
  '上油要薄而均匀，风干后再上第二遍，效果更佳。'
]

const tipTypes = ['success', 'warning', 'info', 'error']

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const nextStep = () => {
  if (currentStep.value < craftSteps.value.length - 1) {
    currentStep.value++
  } else {
    currentStep.value = 0
  }
}

const jumpToStep = (index) => {
  currentStep.value = index
}

watch(autoPlay, (val) => {
  if (val) {
    autoPlayTimer = setInterval(() => {
      nextStep()
    }, 5000)
  } else {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer)
      autoPlayTimer = null
    }
  }
})

const comments = ref([
  {
    id: 1,
    username: '竹编爱好者',
    userAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    content: '太精美了！这编织的纹理太有艺术感了，不愧是传统工艺！',
    time: '2024-01-16 10:30',
    likes: 12
  },
  {
    id: 2,
    username: '手艺人小王',
    userAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    content: '请问这个花篮的尺寸是多少？想学习一下编织技法',
    time: '2024-01-16 14:20',
    likes: 5
  },
  {
    id: 3,
    username: '收藏家老李',
    userAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    content: '已经收藏了好几件张师傅的作品，每件都是精品！',
    time: '2024-01-17 09:15',
    likes: 8
  }
])

const setupWebSocket = async () => {
  try {
    await websocket.connect()
    const craftId = route.params.id || 1
    
    websocket.subscribe(`/topic/craft/${craftId}/comments`, (message) => {
      const newCommentData = message.data || message
      
      const exists = comments.value.some(c => c.id === newCommentData.id)
      if (!exists) {
        comments.value.unshift({
          id: newCommentData.id || Date.now(),
          username: newCommentData.username || '匿名用户',
          userAvatar: newCommentData.userAvatar || 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
          content: newCommentData.content,
          time: newCommentData.time || new Date().toLocaleString(),
          likes: newCommentData.likes || 0
        })
        
        newCommentNotification.value = {
          username: newCommentData.username || '匿名用户',
          content: newCommentData.content
        }
        
        setTimeout(() => {
          newCommentNotification.value = null
        }, 3000)
      }
    })
    
    websocket.subscribe(`/topic/craft/${craftId}/likes`, (message) => {
      if (message.likes) {
        craft.value.likes = message.likes
      }
    })
    
    console.log('WebSocket订阅成功')
  } catch (error) {
    console.warn('WebSocket连接失败，将使用轮询方式:', error)
    startPolling()
  }
}

let pollingInterval = null

const startPolling = () => {
  const craftId = route.params.id || 1
  pollingInterval = setInterval(async () => {
    try {
      const result = await interactionApi.comments(craftId)
      if (result && result.data) {
        const newComments = result.data.filter(
          newC => !comments.value.some(oldC => oldC.id === newC.id)
        )
        if (newComments.length > 0) {
          comments.value = [...newComments, ...comments.value]
        }
      }
    } catch (error) {
      console.error('轮询获取评论失败:', error)
    }
  }, 5000)
}

const handleLike = () => {
  craft.value.likes++
  ElMessage.success('点赞成功！')
}

const handleShare = () => {
  ElMessage.success('分享链接已复制！')
}

const submitComment = async () => {
  if (!newComment.value.trim()) {
    ElMessage.warning('请输入评论内容')
    return
  }
  
  const comment = {
    id: Date.now(),
    username: '游客用户',
    userAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
    content: newComment.value,
    time: new Date().toLocaleString(),
    likes: 0
  }
  
  comments.value.unshift(comment)
  newComment.value = ''
  ElMessage.success('评论发表成功！')
}

const likeComment = (id) => {
  const comment = comments.value.find(c => c.id === id)
  if (comment) {
    comment.likes++
  }
}

const replyComment = (id) => {
  ElMessage.info('回复功能开发中...')
}

onMounted(() => {
  const craftId = route.params.id
  console.log('工艺ID:', craftId)
  setupWebSocket()
})

onUnmounted(() => {
  const craftId = route.params.id || 1
  websocket.unsubscribe(`/topic/craft/${craftId}/comments`)
  websocket.unsubscribe(`/topic/craft/${craftId}/likes`)
  
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
})
</script>

<style scoped>
.craft-detail {
  max-width: 1400px;
  margin: 0 auto;
}

.image-card {
  overflow: hidden;
  background: #f5f5f5;
}

:deep(.image-card .el-image) {
  width: 100%;
  height: 500px;
}

:deep(.image-card .el-image__inner) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #f5f5f5;
}

.craft-info {
  background: white;
  border-radius: 12px;
  padding: 30px;
  height: 100%;
}

.craft-title {
  font-size: 28px;
  color: #333;
  margin-bottom: 15px;
}

.craft-category {
  margin-bottom: 20px;
}

.craft-description {
  font-size: 15px;
  color: #666;
  line-height: 1.8;
  margin-bottom: 30px;
}

.artisan-info {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 10px;
  margin-bottom: 30px;
}

.artisan-name {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 5px;
}

.artisan-desc {
  font-size: 14px;
  color: #888;
}

.action-buttons {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
}

.action-buttons .el-button {
  flex: 1;
}

.stats-row {
  display: flex;
  gap: 30px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
}

.comments-section {
  margin-top: 30px;
}

.comments-header {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.comment-input {
  margin-bottom: 30px;
}

.comment-item {
  display: flex;
  gap: 15px;
  padding: 20px 0;
  border-bottom: 1px solid #f0f0f0;
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-content {
  flex: 1;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.username {
  font-weight: 600;
  color: #333;
}

.time {
  font-size: 12px;
  color: #999;
}

.comment-text {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 10px;
}

.comment-actions {
  display: flex;
  gap: 10px;
}

.steps-section {
  margin-top: 30px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.section-header span {
  font-weight: 600;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-demo {
  padding: 20px 0;
}

.step-progress {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  overflow-x: auto;
  padding-bottom: 10px;
}

.progress-item {
  flex: 1;
  min-width: 100px;
  text-align: center;
  cursor: pointer;
  padding: 10px;
  border-radius: 8px;
  transition: all 0.3s;
  border: 2px solid #e5e7eb;
}

.progress-item.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.progress-item.completed {
  border-color: #67c23a;
  background: #f0f9eb;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 8px;
  font-weight: 600;
}

.progress-item.active .step-number {
  background: #409eff;
  color: white;
}

.progress-item.completed .step-number {
  background: #67c23a;
  color: white;
}

.step-title-mini {
  font-size: 12px;
  color: #666;
}

.progress-item.active .step-title-mini {
  color: #409eff;
}

.step-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.step-detail h3 {
  font-size: 20px;
  color: #333;
  margin-bottom: 15px;
}

.step-desc {
  font-size: 15px;
  color: #666;
  line-height: 1.8;
  margin-bottom: 20px;
}

.step-tips {
  margin-top: 20px;
}

@media (max-width: 768px) {
  .step-content {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .step-progress {
    flex-wrap: nowrap;
    justify-content: flex-start;
  }

  .progress-item {
    min-width: 80px;
    flex: none;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .step-controls {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
