<template>
  <div class="detail-container">
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button @click="goBack" :icon="ArrowLeft">返回</el-button>
          <h1>{{ stitch?.name }}</h1>
        </div>
        <div class="header-right">
          <span class="user-info">{{ userStore.user?.username }}</span>
          <el-button type="danger" size="small" @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      
      <el-main class="main">
        <el-row :gutter="20">
          <el-col :span="16">
            <el-card class="steps-card">
              <template #header>
                <div class="card-header">
                  <span>针法步骤演示</span>
                  <el-progress :percentage="currentStepProgress" :show-text="false" style="width: 200px" />
                </div>
              </template>
              
              <div class="step-display">
                <div class="step-navigation">
                  <el-button 
                    :icon="ArrowUp" 
                    @click="prevStep" 
                    :disabled="currentStepIndex === 0 || isStepTransitioning"
                  >上一步</el-button>
                  <span class="step-indicator">
                    第 {{ currentStepIndex + 1 }} / {{ stitch?.steps?.length || 0 }} 步
                  </span>
                  <el-button 
                    :icon="ArrowDown" 
                    @click="nextStep" 
                    :disabled="currentStepIndex === (stitch?.steps?.length - 1) || isStepTransitioning"
                  >下一步</el-button>
                </div>
                
                <transition name="step-fade" mode="out-in">
                  <div class="step-content" v-if="currentStep" :key="currentStepIndex">
                    <h2 class="step-title">{{ currentStep.title }}</h2>
                    <div class="step-image-container">
                      <el-icon :size="120" style="color: #9b59b6"><Picture /></el-icon>
                    </div>
                    <p class="step-description">{{ currentStep.description }}</p>
                  </div>
                </transition>
              </div>
            </el-card>
            
            <el-card class="feedback-card" style="margin-top: 20px">
              <template #header>
                <span>学员操作反馈</span>
              </template>
              
              <el-form :model="feedbackForm" label-width="80px">
                <el-form-item label="评分">
                  <el-rate v-model="feedbackForm.rating" show-score />
                </el-form-item>
                <el-form-item label="反馈内容">
                  <el-input 
                    v-model="feedbackForm.content" 
                    type="textarea" 
                    :rows="4" 
                    placeholder="请输入您的学习反馈或遇到的问题..."
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="submitFeedback">提交反馈</el-button>
                </el-form-item>
              </el-form>
              
              <div class="feedback-list" v-if="feedbackList.length > 0">
                <h4>历史反馈</h4>
                <div v-for="(item, index) in feedbackList" :key="index" class="feedback-item">
                  <div class="feedback-header">
                    <span class="feedback-user">{{ item.username }}</span>
                    <el-rate :model-value="item.rating" disabled show-score />
                  </div>
                  <p class="feedback-content">{{ item.content }}</p>
                </div>
              </div>
            </el-card>
          </el-col>
          
          <el-col :span="8">
            <el-card class="info-card">
              <template #header>
                <span>针法信息</span>
              </template>
              <div class="stitch-info">
                <p><strong>难度：</strong>
                  <el-tag :type="getDifficultyType(stitch?.difficulty)">
                    {{ stitch?.difficulty }} 级
                  </el-tag>
                </p>
                <p v-if="stitch?.category"><strong>分类：</strong>{{ stitch.category }}</p>
                <p v-if="stitch?.description"><strong>描述：</strong>{{ stitch.description }}</p>
              </div>
            </el-card>
            
            <el-card class="video-card" style="margin-top: 20px">
              <template #header>
                <span>教学视频</span>
              </template>
              <div v-if="stitch?.videos?.length > 0" class="video-list">
                <div 
                  v-for="video in stitch.videos" 
                  :key="video.id" 
                  class="video-item"
                  @click="playVideo(video)"
                >
                  <el-icon :size="40"><VideoPlay /></el-icon>
                  <div class="video-info">
                    <div class="video-title">{{ video.title }}</div>
                    <div class="video-duration">{{ video.duration }} 秒</div>
                  </div>
                </div>
              </div>
              <div v-else class="no-video">
                <el-icon :size="60" style="color: #ccc"><VideoPlay /></el-icon>
                <p>暂无教学视频</p>
              </div>
            </el-card>
            
            <el-card class="progress-card" style="margin-top: 20px">
              <template #header>
                <span>学习进度</span>
              </template>
              <div class="progress-info">
                <el-progress :percentage="totalProgress" :status="totalProgress === 100 ? 'success' : ''" />
                <p class="progress-text">
                  已完成 {{ Math.round(totalProgress) }}% 的学习内容
                </p>
                <el-checkbox 
                  v-model="isCompleted" 
                  @change="updateProgress"
                  style="margin-top: 15px"
                >
                  标记为已完成
                </el-checkbox>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-main>
    </el-container>
    
    <el-dialog v-model="videoDialogVisible" title="视频播放" width="800px">
      <div class="video-player">
        <el-icon :size="100" style="color: #9b59b6; display: block; margin: 0 auto"><VideoPlay /></el-icon>
        <p style="text-align: center; margin-top: 20px">{{ playingVideo?.title }}</p>
        <p style="text-align: center; color: #666">（视频播放区域）</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user'
import { stitchAPI, videoAPI, progressAPI } from '@/api'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const stitch = ref(null)
const currentStepIndex = ref(0)
const isCompleted = ref(false)
const feedbackForm = ref({
  rating: 5,
  content: ''
})
const feedbackList = ref([])
const videoDialogVisible = ref(false)
const playingVideo = ref(null)
const preloadedSteps = ref({})
const isStepTransitioning = ref(false)
const progressUpdateTimer = ref(null)
const lastProgressUpdate = ref(0)

const currentStep = computed(() => {
  return stitch.value?.steps?.[currentStepIndex.value]
})

const currentStepProgress = computed(() => {
  if (!stitch.value?.steps?.length) return 0
  return Math.round(((currentStepIndex.value + 1) / stitch.value.steps.length) * 100)
})

const totalProgress = computed(() => {
  return currentStepProgress.value
})

const getDifficultyType = (level) => {
  if (!level) return 'info'
  if (level <= 2) return 'success'
  if (level <= 4) return 'warning'
  return 'danger'
}

const goBack = () => {
  router.push('/')
}

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
  ElMessage.success('已退出登录')
}

const preloadStep = (index) => {
  if (!stitch.value?.steps?.[index] || preloadedSteps.value[index]) return
  preloadedSteps.value[index] = true
}

const prevStep = () => {
  if (currentStepIndex.value > 0 && !isStepTransitioning.value) {
    isStepTransitioning.value = true
    currentStepIndex.value--
    preloadStep(currentStepIndex.value - 1)
    nextTick(() => {
      isStepTransitioning.value = false
      updateLocalProgress()
    })
  }
}

const nextStep = () => {
  if (currentStepIndex.value < stitch.value.steps.length - 1 && !isStepTransitioning.value) {
    isStepTransitioning.value = true
    currentStepIndex.value++
    preloadStep(currentStepIndex.value + 1)
    nextTick(() => {
      isStepTransitioning.value = false
      updateLocalProgress()
    })
  }
}

const updateLocalProgress = () => {
  const now = Date.now()
  if (now - lastProgressUpdate.value < 2000) return
  lastProgressUpdate.value = now
  
  const cacheKey = `progress_${userStore.user?.id}_${route.params.id}`
  localStorage.setItem(cacheKey, JSON.stringify({
    progress: totalProgress.value,
    step: currentStepIndex.value,
    timestamp: now
  }))
  
  debouncedSyncProgress()
}

const debouncedSyncProgress = () => {
  if (progressUpdateTimer.value) clearTimeout(progressUpdateTimer.value)
  progressUpdateTimer.value = setTimeout(async () => {
    try {
      await progressAPI.updateProgress({
        user_id: userStore.user.id,
        stitch_id: route.params.id,
        progress: totalProgress.value,
        completed: isCompleted.value
      })
    } catch (error) {
      console.error('同步进度失败', error)
    }
  }, 1500)
}

const playVideo = (video) => {
  playingVideo.value = video
  videoDialogVisible.value = true
}

const submitFeedback = async () => {
  try {
    const res = await videoAPI.submitFeedback({
      user_id: userStore.user.id,
      stitch_id: route.params.id,
      step_id: currentStep.value?.id,
      ...feedbackForm.value
    })
    
    if (res.success) {
      ElMessage.success('反馈提交成功')
      feedbackForm.value = { rating: 5, content: '' }
      loadFeedback()
    }
  } catch (error) {
    ElMessage.error('提交失败')
  }
}

const updateProgress = async () => {
  try {
    await progressAPI.updateProgress({
      user_id: userStore.user.id,
      stitch_id: route.params.id,
      progress: totalProgress.value,
      completed: isCompleted.value
    })
    if (isCompleted.value) {
      ElMessage.success('已标记为完成')
    }
  } catch (error) {
    console.error('更新进度失败', error)
  }
}

const loadStitch = async () => {
  try {
    const cacheKey = `stitch_${route.params.id}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      stitch.value = JSON.parse(cached)
      restoreProgressFromCache()
    }
    
    const res = await stitchAPI.getStitch(route.params.id)
    if (res.success) {
      stitch.value = res.stitch
      localStorage.setItem(cacheKey, JSON.stringify(res.stitch))
      
      if (stitch.value.steps) {
        stitch.value.steps.forEach((_, idx) => preloadStep(idx))
      }
      
      if (!cached) restoreProgressFromCache()
    }
  } catch (error) {
    ElMessage.error('加载针法详情失败')
  }
}

const restoreProgressFromCache = () => {
  const cacheKey = `progress_${userStore.user?.id}_${route.params.id}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    const { step, progress } = JSON.parse(cached)
    if (step !== undefined && step < stitch.value?.steps?.length) {
      currentStepIndex.value = step
    }
  }
}

const loadFeedback = async () => {
  try {
    const res = await videoAPI.getFeedback(route.params.id)
    if (res.success) {
      feedbackList.value = res.feedback
    }
  } catch (error) {
    console.error('加载反馈失败', error)
  }
}

watch(() => route.params.id, () => {
  preloadedSteps.value = {}
  loadStitch()
  loadFeedback()
})

onMounted(() => {
  userStore.restoreUser()
  loadStitch()
  loadFeedback()
})

onUnmounted(() => {
  if (progressUpdateTimer.value) {
    clearTimeout(progressUpdateTimer.value)
  }
})
</script>

<style scoped>
.detail-container {
  min-height: 100vh;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 30px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header h1 {
  color: white;
  font-size: 20px;
  margin: 0;
}

.user-info {
  margin-right: 15px;
}

.main {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.step-display {
  padding: 20px 0;
}

.step-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.step-indicator {
  font-size: 16px;
  font-weight: bold;
  color: #667eea;
}

.step-content {
  text-align: center;
}

.step-title {
  font-size: 24px;
  color: #333;
  margin-bottom: 30px;
}

.step-image-container {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 60px;
  border-radius: 12px;
  margin-bottom: 30px;
}

.step-description {
  font-size: 16px;
  color: #666;
  line-height: 1.8;
  text-align: left;
  padding: 0 40px;
}

.stitch-info p {
  margin: 15px 0;
  font-size: 14px;
}

.video-list {
  max-height: 300px;
  overflow-y: auto;
}

.video-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background 0.3s;
}

.video-item:hover {
  background: #f5f7fa;
}

.video-title {
  font-weight: bold;
  margin-bottom: 5px;
}

.video-duration {
  font-size: 12px;
  color: #999;
}

.no-video {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.progress-info {
  padding: 10px 0;
}

.progress-text {
  text-align: center;
  margin-top: 15px;
  color: #666;
}

.feedback-list h4 {
  margin-top: 20px;
  margin-bottom: 15px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.feedback-item {
  padding: 15px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 10px;
}

.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.feedback-user {
  font-weight: bold;
  color: #667eea;
}

.feedback-content {
  color: #666;
  margin: 0;
}

.video-player {
  padding: 40px;
  background: #f5f7fa;
  border-radius: 8px;
}

.step-fade-enter-active,
.step-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.step-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.step-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
