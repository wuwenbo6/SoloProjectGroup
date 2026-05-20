<template>
  <div class="learn-container">
    <el-header class="header">
      <div class="header-content">
        <el-button @click="$router.push('/')" icon="ArrowLeft">返回</el-button>
        <h1 class="title">{{ furniture?.name }} - 拆解教学</h1>
        <div class="progress-info">
          <span>步骤：{{ currentStep + 1 }} / {{ totalSteps }}</span>
        </div>
      </div>
    </el-header>
    <el-main class="main-content">
      <el-row :gutter="20">
        <el-col :span="16">
          <el-card class="viewer-card">
            <ThreeViewer :parts="parts" :currentStep="currentStep" @part-click="handlePartClick" />
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="steps-card">
            <template #header>
              <div class="card-header">
                <span>拆解步骤</span>
              </div>
            </template>
            <div class="steps-container">
              <el-steps direction="vertical" :active="currentStep" finish-status="success">
                <el-step v-for="(step, index) in steps" :key="index" :title="`步骤 ${index + 1}`" :description="step.title">
                  <template #icon>
                    <el-icon v-if="index < currentStep" color="#67c23a"><CircleCheck /></el-icon>
                    <el-icon v-else-if index === currentStep color="#409eff"><VideoPlay /></el-icon>
                    <el-icon v-else color="#c0c4cc"><CircleClose /></el-icon>
                  </template>
                </el-step>
              </el-steps>
            </div>
            <div v-if="steps[currentStep]" class="current-step-detail">
              <h3>{{ steps[currentStep].title }}</h3>
              
              <!-- 视频讲解嵌入 -->
              <div v-if="steps[currentStep].videoUrl" class="video-container">
                <h4><el-icon><VideoCamera /></el-icon> 视频讲解</h4>
                <div class="video-wrapper">
                  <video 
                    :src="steps[currentStep].videoUrl" 
                    controls 
                    preload="metadata"
                    poster="/video-placeholder.png"
                    class="step-video"
                  >
                    您的浏览器不支持视频播放
                  </video>
                </div>
              </div>

              <!-- 步骤图片 -->
              <div v-if="steps[currentStep].imageUrl" class="image-container">
                <el-image 
                  :src="steps[currentStep].imageUrl" 
                  fit="cover" 
                  :preview-src-list="[steps[currentStep].imageUrl]"
                  class="step-image"
                />
              </div>

              <p class="description">{{ steps[currentStep].description }}</p>
              
              <div v-if="steps[currentStep].operationGuide" class="operation-guide">
                <h4><el-icon><Operation /></el-icon> 操作指南</h4>
                <p>{{ steps[currentStep].operationGuide }}</p>
              </div>
              
              <div v-if="steps[currentStep].attentionPoints" class="attention-points">
                <el-alert :title="steps[currentStep].attentionPoints" type="warning" :closable="false" show-icon />
              </div>

              <div class="step-meta">
                <el-tag type="info" size="small">
                  <el-icon><Timer /></el-icon> 预计用时：{{ steps[currentStep].estimatedTime }}秒
                </el-tag>
              </div>
            </div>
            <div class="step-controls">
              <el-button :disabled="currentStep === 0" @click="prevStep">上一步</el-button>
              <el-button type="primary" :disabled="currentStep >= totalSteps - 1" @click="nextStep">下一步</el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </el-main>
    <el-dialog v-model="partDialogVisible" title="部件详情" width="500px">
      <div v-if="selectedPart">
        <p><strong>名称：</strong>{{ selectedPart.name }}</p>
        <p><strong>描述：</strong>{{ selectedPart.description }}</p>
        <p><strong>榫卯类型：</strong>{{ selectedPart.mortiseType || '暂无' }}</p>
        <p v-if="selectedPart.assemblyTip"><strong>组装提示：</strong>{{ selectedPart.assemblyTip }}</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { getFurnitureParts, getFurnitureDetail } from '@/api/furniture'
import { getDisassembleSteps } from '@/api/teaching'
import { startLearning, updateProgress, updateProgressAsync } from '@/api/progress'
import ThreeViewer from '@/components/ThreeViewer.vue'
import { CircleCheck, VideoPlay, CircleClose, ArrowLeft, VideoCamera, Timer, Operation } from '@element-plus/icons-vue'

const route = useRoute()
const furniture = ref(null)
const parts = ref([])
const steps = ref([])
const currentStep = ref(0)
const partDialogVisible = ref(false)
const selectedPart = ref(null)
const lastSyncTime = ref(0)
const pendingUpdate = ref(false)

const SYNC_THROTTLE = 2000

const totalSteps = computed(() => steps.value.length)

onMounted(() => {
  loadFurnitureData()
  initLearning()
})

onUnmounted(() => {
  flushPendingUpdate()
})

const loadFurnitureData = async () => {
  const furnitureId = route.params.id
  try {
    const [furnitureRes, partsRes, stepsRes] = await Promise.all([
      getFurnitureDetail(furnitureId),
      getFurnitureParts(furnitureId),
      getDisassembleSteps(furnitureId)
    ])
    furniture.value = furnitureRes.data
    parts.value = partsRes.data
    steps.value = stepsRes.data
  } catch (error) {
    console.error('加载数据失败', error)
  }
}

const initLearning = async () => {
  try {
    await startLearning(route.params.id)
  } catch (error) {
    console.error('初始化学习失败', error)
  }
}

const nextStep = async () => {
  if (currentStep.value < totalSteps.value - 1) {
    currentStep.value++
    throttledUpdateProgress()
  }
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const throttledUpdateProgress = () => {
  const now = Date.now()
  if (now - lastSyncTime.value < SYNC_THROTTLE) {
    pendingUpdate.value = true
    return
  }
  performUpdate()
}

const performUpdate = async () => {
  lastSyncTime.value = Date.now()
  pendingUpdate.value = false
  
  try {
    await updateProgressAsync({
      furnitureId: route.params.id,
      step: currentStep.value + 1,
      timeSpent: 30
    })
  } catch (error) {
    console.error('更新进度失败', error)
    pendingUpdate.value = true
  }
}

const flushPendingUpdate = () => {
  if (pendingUpdate.value) {
    performUpdate()
  }
}

const handlePartClick = (partId) => {
  selectedPart.value = parts.value.find(p => p.modelId === partId)
  partDialogVisible.value = true
}
</script>

<style scoped>
.learn-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.header {
  background: white;
  border-bottom: 1px solid #e4e7ed;
  padding: 0;
  height: 60px;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 20px;
  gap: 20px;
}

.title {
  flex: 1;
  font-size: 18px;
  margin: 0;
  color: #333;
}

.progress-info {
  color: #666;
  font-size: 14px;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.viewer-card {
  height: 600px;
}

.steps-card {
  height: 600px;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.steps-container {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
}

.current-step-detail {
  border-top: 1px solid #e4e7ed;
  padding-top: 15px;
  margin-top: 15px;
}

.current-step-detail h3 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 16px;
}

.current-step-detail h4 {
  margin: 10px 0 5px 0;
  color: #666;
  font-size: 14px;
}

.description {
  color: #666;
  line-height: 1.6;
}

.operation-guide p {
  color: #666;
  line-height: 1.6;
}

.attention-points {
  margin-top: 10px;
}

.step-controls {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #e4e7ed;
}

.video-container {
  margin: 15px 0;
}

.video-wrapper {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.step-video {
  width: 100%;
  height: auto;
  display: block;
  background: #000;
}

.image-container {
  margin: 15px 0;
}

.step-image {
  width: 100%;
  height: 200px;
  border-radius: 8px;
}

.step-meta {
  margin-top: 15px;
  display: flex;
  align-items: center;
}
</style>
