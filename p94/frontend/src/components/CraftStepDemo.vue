<template>
  <div class="step-demo-container">
    <div class="demo-header">
      <h3>{{ $t('craft.steps') }}</h3>
      <div class="demo-controls">
        <el-button type="primary" @click="toggleDemo" v-if="!isPlaying">
          <el-icon><VideoPlay /></el-icon>
          {{ $t('craft.startDemo') }}
        </el-button>
        <el-button @click="toggleDemo" v-if="isPlaying" type="danger">
          <el-icon><VideoPause /></el-icon>
          停止
        </el-button>
      </div>
    </div>

    <div v-if="steps.length === 0" class="empty-steps">
      <el-empty :description="$t('common.noData')" />
    </div>

    <div v-else class="steps-wrapper">
      <div class="steps-progress">
        <el-progress 
          :percentage="Math.round(((currentStepIndex + 1) / steps.length) * 100)" 
          :show-text="false"
          stroke-width="8"
        />
        <div class="progress-text">
          {{ $t('craft.step') }} {{ currentStepIndex + 1 }} / {{ steps.length }}
        </div>
      </div>

      <div class="step-card-wrapper">
        <div class="step-card" :class="{ 'is-playing': isPlaying }">
          <div class="step-number">
            <span>{{ currentStepIndex + 1 }}</span>
          </div>
          
          <h4 class="step-title">{{ currentStep.title }}</h4>
          
          <div v-if="currentStep.imageUrl" class="step-image">
            <img :src="currentStep.imageUrl" :alt="currentStep.title" />
          </div>
          <div v-else class="step-image-placeholder">
            <el-icon class="placeholder-icon"><Picture /></el-icon>
            <span>暂无图片</span>
          </div>

          <p class="step-description">{{ currentStep.description }}</p>

          <div v-if="currentStep.tips" class="step-tips">
            <el-icon><InfoFilled /></el-icon>
            <span>{{ currentStep.tips }}</span>
          </div>

          <div v-if="currentStep.duration" class="step-duration">
            <el-icon><Timer /></el-icon>
            <span>预计 {{ currentStep.duration }} 分钟</span>
          </div>
        </div>
      </div>

      <div class="step-nav">
        <el-button 
          :disabled="currentStepIndex === 0" 
          @click="prevStep"
          size="large"
        >
          <el-icon><ArrowLeft /></el-icon>
          {{ $t('craft.prevStep') }}
        </el-button>

        <el-button 
          :disabled="currentStepIndex === steps.length - 1" 
          @click="nextStep"
          size="large"
          type="primary"
        >
          {{ $t('craft.nextStep') }}
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>

      <div class="steps-carousel">
        <div 
          v-for="(step, index) in steps" 
          :key="step.id"
          class="carousel-item"
          :class="{ 'is-active': index === currentStepIndex }"
          @click="goToStep(index)"
        >
          <span class="carousel-number">{{ index + 1 }}</span>
          <span class="carousel-title">{{ step.title }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  steps: {
    type: Array,
    default: () => []
  }
})

const currentStepIndex = ref(0)
const isPlaying = ref(false)
let playTimer = null

const currentStep = computed(() => {
  return props.steps[currentStepIndex.value] || {}
})

const prevStep = () => {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--
  }
}

const nextStep = () => {
  if (currentStepIndex.value < props.steps.length - 1) {
    currentStepIndex.value++
  } else if (isPlaying.value) {
    stopDemo()
  }
}

const goToStep = (index) => {
  currentStepIndex.value = index
}

const toggleDemo = () => {
  if (isPlaying.value) {
    stopDemo()
  } else {
    startDemo()
  }
}

const startDemo = () => {
  isPlaying.value = true
  currentStepIndex.value = 0
  playNextStep()
}

const playNextStep = () => {
  if (playTimer) clearTimeout(playTimer)
  if (currentStepIndex.value < props.steps.length - 1) {
    const duration = (props.steps[currentStepIndex.value].duration || 5) * 1000
    playTimer = setTimeout(() => {
      if (isPlaying.value) {
        currentStepIndex.value++
        playNextStep()
      }
    }, duration)
  }
}

const stopDemo = () => {
  isPlaying.value = false
  if (playTimer) {
    clearTimeout(playTimer)
    playTimer = null
  }
}

watch(() => props.steps, () => {
  currentStepIndex.value = 0
  stopDemo()
})

onUnmounted(() => {
  stopDemo()
})
</script>

<style scoped>
.step-demo-container {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.demo-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.empty-steps {
  padding: 40px 0;
}

.steps-progress {
  margin-bottom: 24px;
}

.progress-text {
  text-align: center;
  margin-top: 8px;
  color: #666;
  font-size: 14px;
}

.step-card-wrapper {
  margin-bottom: 24px;
}

.step-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  border-radius: 16px;
  padding: 32px;
  transition: all 0.5s ease;
}

.step-card.is-playing {
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.2);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.step-card.is-playing .step-number,
.step-card.is-playing .step-title,
.step-card.is-playing .step-description,
.step-card.is-playing .step-duration,
.step-card.is-playing .step-duration span {
  color: #fff;
}

.step-card.is-playing .step-tips {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.step-card.is-playing .step-tips .el-icon {
  color: #ffd700;
}

.step-number {
  width: 60px;
  height: 60px;
  background: #667eea;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.step-number span {
  color: #fff;
  font-size: 24px;
  font-weight: bold;
}

.step-title {
  margin: 0 0 16px 0;
  font-size: 22px;
  color: #333;
}

.step-image {
  width: 100%;
  max-height: 300px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-image img {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
}

.step-image-placeholder {
  width: 100%;
  height: 200px;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  margin-bottom: 16px;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.step-description {
  margin: 0 0 16px 0;
  color: #666;
  line-height: 1.8;
  font-size: 15px;
}

.step-tips {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: #fff9e6;
  border-radius: 8px;
  color: #8a6d3b;
  margin-bottom: 12px;
}

.step-duration {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #666;
  font-size: 14px;
}

.step-nav {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.step-nav .el-button {
  flex: 1;
}

.steps-carousel {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
}

.carousel-item {
  flex-shrink: 0;
  min-width: 120px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.carousel-item:hover {
  background: #e4e8ec;
}

.carousel-item.is-active {
  background: #667eea;
  color: #fff;
}

.carousel-number {
  font-weight: bold;
  font-size: 14px;
}

.carousel-title {
  font-size: 12px;
  opacity: 0.8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .step-demo-container {
    padding: 16px;
  }

  .demo-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .step-card {
    padding: 20px;
  }

  .step-title {
    font-size: 18px;
  }

  .steps-carousel {
    flex-wrap: wrap;
  }

  .carousel-item {
    min-width: calc(50% - 4px);
  }
}
</style>
