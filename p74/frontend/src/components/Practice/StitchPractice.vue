<template>
  <div class="stitch-practice">
    <div class="practice-header">
      <h2>{{ t('practice.mode.title') }}</h2>
      <p class="subtitle">{{ t('practice.mode.description') }}</p>
    </div>
    
    <el-card class="select-stitch-card" v-if="currentPhase === 'select'">
      <template #header>
        <span>{{ t('practice.mode.selectStitch') }}</span>
      </template>
      <el-row :gutter="20">
        <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="stitch in stitches" :key="stitch.id">
          <div class="stitch-option" @click="selectStitch(stitch)">
            <div class="stitch-icon">
              <el-icon :size="40"><Brush /></el-icon>
            </div>
            <h4>{{ stitch.name }}</h4>
            <el-tag :type="getDifficultyType(stitch.difficulty)" size="small">
              {{ getDifficultyLabel(stitch.difficulty) }}
            </el-tag>
            <div class="practice-btn">
              <el-button type="primary" size="small">
                {{ t('practice.mode.startPractice') }}
              </el-button>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="practice-card" v-if="currentPhase === 'quiz'">
      <template #header>
        <div class="quiz-header">
          <span>{{ selectedStitch?.name }} - {{ t('practice.quiz.title') }}</span>
          <el-progress 
            :percentage="Math.round((currentQuestionIndex + 1) / questions.length * 100)" 
            style="width: 150px"
          />
        </div>
      </template>
      
      <div class="question-content" v-if="currentQuestion">
        <h3>{{ t('practice.quiz.question', { current: currentQuestionIndex + 1, total: questions.length }) }}</h3>
        <p class="question-text">{{ currentQuestion.question }}</p>
        
        <div class="options">
          <div 
            v-for="(option, idx) in currentQuestion.options" 
            :key="idx"
            class="option-item"
            :class="{ 
              selected: selectedAnswer === idx,
              correct: showResult && idx === currentQuestion.correctAnswer,
              wrong: showResult && selectedAnswer === idx && idx !== currentQuestion.correctAnswer
            }"
            @click="selectOption(idx)"
          >
            <span class="option-label">{{ String.fromCharCode(65 + idx) }}</span>
            <span class="option-text">{{ option }}</span>
            <el-icon v-if="showResult && idx === currentQuestion.correctAnswer" class="result-icon success">
              <CircleCheck />
            </el-icon>
            <el-icon v-if="showResult && selectedAnswer === idx && idx !== currentQuestion.correctAnswer" class="result-icon error">
              <CircleClose />
            </el-icon>
          </div>
        </div>

        <div class="result-feedback" v-if="showResult">
          <el-alert 
            :type="isCorrect ? 'success' : 'error'"
            :title="isCorrect ? t('practice.quiz.correct') : t('practice.quiz.wrong') + currentQuestion.options[currentQuestion.correctAnswer]"
            show-icon
          />
          <div class="explanation" v-if="currentQuestion.explanation">
            <strong>{{ t('practice.quiz.explanation') }}:</strong>
            <p>{{ currentQuestion.explanation }}</p>
          </div>
        </div>

        <div class="quiz-actions" v-if="showResult">
          <el-button type="primary" @click="nextQuestion" v-if="currentQuestionIndex < questions.length - 1">
            {{ t('practice.quiz.nextQuestion') }}
          </el-button>
          <el-button type="success" @click="showResults" v-else>
            {{ t('practice.quiz.seeResult') }}
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card class="result-card" v-if="currentPhase === 'result'">
      <template #header>
        <span>{{ t('practice.result.title') }}</span>
      </template>
      
      <div class="result-content">
        <div class="score-circle">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" stroke-width="8"/>
            <circle 
              cx="60" cy="60" r="50" fill="none" 
              :stroke="scoreColor" stroke-width="8"
              stroke-dasharray="314"
              :stroke-dashoffset="314 - (314 * score / 100)"
              stroke-linecap="round"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div class="score-text">
            <span class="score-number">{{ score }}</span>
            <span class="score-label">分</span>
          </div>
        </div>

        <div class="result-stats">
          <div class="stat-item">
            <span class="stat-value success">{{ correctCount }}</span>
            <span class="stat-label">{{ t('practice.result.correctCount') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value error">{{ wrongCount }}</span>
            <span class="stat-label">{{ t('practice.result.wrongCount') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value primary">{{ accuracy }}%</span>
            <span class="stat-label">{{ t('practice.result.accuracy') }}</span>
          </div>
        </div>

        <div class="result-message" :class="messageType">
          <el-icon :size="40">
            <Trophy v-if="score >= 80" />
            <Star v-else-if="score >= 60" />
            <Warning v-else />
          </el-icon>
          <p>{{ resultMessage }}</p>
        </div>

        <div class="result-actions">
          <el-button @click="resetPractice">{{ t('practice.result.backToPractice') }}</el-button>
          <el-button type="primary" @click="resetPractice">{{ t('practice.result.tryAgain') }}</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { stitchAPI } from '@/api'

const { t } = useI18n()

const stitches = ref([])
const selectedStitch = ref(null)
const currentPhase = ref('select')
const currentQuestionIndex = ref(0)
const selectedAnswer = ref(null)
const showResult = ref(false)
const answers = ref([])

const questions = ref([
  {
    question: '刺绣时针法的主要作用是什么？',
    options: ['装饰布料', '固定布料', '形成图案和装饰', '加快刺绣速度'],
    correctAnswer: 2,
    explanation: '针法是刺绣的基础，不仅能形成精美的图案，同时也起到装饰布料的作用。'
  },
  {
    question: '平针绣的特点是什么？',
    options: ['针脚长短不一', '针脚均匀排列整齐', '形成立体效果', '适合厚重面料'],
    correctAnswer: 1,
    explanation: '平针绣的特点是针脚排列整齐均匀，是最基础也是最常用的刺绣针法。'
  },
  {
    question: '进行刺绣练习时，应该注意什么？',
    options: ['越快越好', '针脚越密越好', '保持手腕放松', '用尽可能多的线'],
    correctAnswer: 2,
    explanation: '刺绣时应保持手腕放松，这样既能保证刺绣质量，也能避免手部疲劳。'
  },
  {
    question: '刺绣完成后，应该如何处理线头？',
    options: ['直接剪掉', '在背面打结固定', '用胶水粘贴', '留在布料上'],
    correctAnswer: 1,
    explanation: '刺绣完成后，线头应在背面打结固定，确保刺绣作品更加牢固耐用。'
  },
  {
    question: '缎面绣适合表现什么效果？',
    options: ['线条勾勒', '填充大面积色块', '立体花朵', '镂空效果'],
    correctAnswer: 1,
    explanation: '缎面绣适合填充大面积色块，能产生平滑、光亮的缎面效果。'
  }
])

const currentQuestion = computed(() => questions.value[currentQuestionIndex.value])

const score = computed(() => {
  const correct = answers.value.filter(a => a.isCorrect).length
  return Math.round((correct / questions.value.length) * 100)
})

const correctCount = computed(() => answers.value.filter(a => a.isCorrect).length)
const wrongCount = computed(() => answers.value.filter(a => !a.isCorrect).length)
const accuracy = computed(() => Math.round((correctCount.value / questions.value.length) * 100))

const isCorrect = computed(() => {
  if (selectedAnswer.value === null) return false
  return selectedAnswer.value === currentQuestion.value.correctAnswer
})

const scoreColor = computed(() => {
  if (score.value >= 80) return '#67c23a'
  if (score.value >= 60) return '#e6a23c'
  return '#f56c6c'
})

const messageType = computed(() => {
  if (score.value >= 80) return 'excellent'
  if (score.value >= 60) return 'good'
  return 'need-practice'
})

const resultMessage = computed(() => {
  if (score.value >= 80) return t('practice.result.greatJob')
  if (score.value >= 60) return t('practice.result.keepGoing')
  return t('practice.result.needPractice')
})

const getDifficultyType = (level) => {
  if (level <= 2) return 'success'
  if (level <= 4) return 'warning'
  return 'danger'
}

const getDifficultyLabel = (level) => {
  if (level <= 2) return t('stitch.easy')
  if (level <= 4) return t('stitch.medium')
  return t('stitch.hard')
}

const selectStitch = (stitch) => {
  selectedStitch.value = stitch
  currentPhase.value = 'quiz'
  currentQuestionIndex.value = 0
  selectedAnswer.value = null
  showResult.value = false
  answers.value = []
}

const selectOption = (idx) => {
  if (showResult.value) return
  selectedAnswer.value = idx
}

const nextQuestion = () => {
  if (selectedAnswer.value === null) {
    ElMessage.warning('请选择答案')
    return
  }
  
  if (!showResult.value) {
    showResult.value = true
    answers.value.push({
      questionIndex: currentQuestionIndex.value,
      selectedAnswer: selectedAnswer.value,
      isCorrect: selectedAnswer.value === currentQuestion.value.correctAnswer
    })
  } else {
    currentQuestionIndex.value++
    selectedAnswer.value = null
    showResult.value = false
  }
}

const showResults = () => {
  if (selectedAnswer.value !== null && !showResult.value) {
    answers.value.push({
      questionIndex: currentQuestionIndex.value,
      selectedAnswer: selectedAnswer.value,
      isCorrect: selectedAnswer.value === currentQuestion.value.correctAnswer
    })
  }
  currentPhase.value = 'result'
}

const resetPractice = () => {
  currentPhase.value = 'select'
  selectedStitch.value = null
  currentQuestionIndex.value = 0
  selectedAnswer.value = null
  showResult.value = false
  answers.value = []
}

onMounted(async () => {
  try {
    const res = await stitchAPI.getStitches()
    if (res.success) {
      stitches.value = res.stitches
    }
  } catch (error) {
    console.error('加载针法列表失败', error)
  }
})
</script>

<style scoped>
.stitch-practice {
  padding: 20px;
}

.practice-header {
  text-align: center;
  margin-bottom: 30px;
}

.practice-header h2 {
  color: #303133;
  margin-bottom: 10px;
}

.subtitle {
  color: #909399;
}

.stitch-option {
  text-align: center;
  padding: 25px 15px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  background: white;
}

.stitch-option:hover {
  border-color: #409eff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.15);
  transform: translateY(-2px);
}

.stitch-icon {
  color: #67c23a;
  margin-bottom: 15px;
}

.stitch-option h4 {
  margin: 10px 0;
  color: #303133;
}

.practice-btn {
  margin-top: 15px;
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.question-content h3 {
  color: #303133;
  margin-bottom: 20px 0;
}

.question-text {
  font-size: 18px;
  color: #606266;
  margin-bottom: 30px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.options {
  margin-bottom: 30px;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 15px 20px;
  margin-bottom: 10px;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.option-item:hover {
  border-color: #409eff;
}

.option-item.selected {
  border-color: #409eff;
  background: #ecf5ff;
}

.option-item.correct {
  border-color: #67c23a;
  background: #f0f9eb;
}

.option-item.wrong {
  border-color: #f56c6c;
  background: #fef0f0;
}

.option-label {
  width: 30px;
  height: 30px;
  line-height: 30px;
  text-align: center;
  background: #e4e7ed;
  border-radius: 50%;
  margin-right: 15px;
  font-weight: bold;
}

.option-text {
  flex: 1;
}

.result-icon {
  margin-left: 10px;
}

.result-icon.success {
  color: #67c23a;
}

.result-icon.error {
  color: #f56c6c;
}

.result-feedback {
  margin-bottom: 20px 0;
}

.explanation {
  margin-top: 15px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

.quiz-actions {
  text-align: center;
}

.result-content {
  text-align: center;
  padding: 20px;
}

.score-circle {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 30px;
}

.score-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.score-number {
  display: block;
  font-size: 32px;
  font-weight: bold;
  color: #303133;
}

.score-label {
  font-size: 14px;
  color: #909399;
}

.result-stats {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-bottom: 30px 0;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: bold;
}

.stat-value.success {
  color: #67c23a;
}

.stat-value.error {
  color: #f56c6c;
}

.stat-value.primary {
  color: #409eff;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.result-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.result-message.excellent {
  background: #f0f9eb;
  color: #67c23a;
}

.result-message.good {
  background: #fdf6ec;
  color: #e6a23c;
}

.result-message.need-practice {
  background: #fef0f0;
  color: #f56c6c;
}

.result-message p {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}

.result-actions {
  display: flex;
  justify-content: center;
  gap: 15px;
}

@media (max-width: 768px) {
  .stitch-practice {
    padding: 10px;
  }
  
  .result-stats {
    gap: 20px;
  }
  
  .stat-value {
    font-size: 22px;
  }
}
</style>
