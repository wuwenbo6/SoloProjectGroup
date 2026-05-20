<template>
  <div class="qa-container">
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button @click="goBack" :icon="ArrowLeft">返回</el-button>
          <h1>互动问答</h1>
        </div>
        <div class="header-right">
          <el-badge :value="onlineUsers" class="item">
            <el-button :icon="User">在线学员: {{ onlineUsers }}</el-button>
          </el-badge>
        </div>
      </el-header>
      
      <el-main class="main">
        <el-row :gutter="20">
          <el-col :span="16">
            <el-card class="questions-card">
              <template #header>
                <div class="card-header">
                  <span>问题列表</span>
                  <el-button type="primary" @click="showAskDialog = true">
                    <el-icon><Edit /></el-icon> 我要提问
                  </el-button>
                </div>
              </template>
              
              <div class="questions-list">
                <div 
                  v-for="question in questions" 
                  :key="question.id" 
                  class="question-item"
                  @click="selectQuestion(question)"
                >
                  <div class="question-header">
                    <span class="question-title">{{ question.title }}</span>
                    <el-tag size="small" type="info">{{ question.username }}</el-tag>
                  </div>
                  <p class="question-content">{{ question.content }}</p>
                  <div class="question-meta">
                    <span class="stitch-name" v-if="question.stitch_name">
                      相关针法: {{ question.stitch_name }}
                    </span>
                    <span class="answer-count">{{ question.answers?.length || 0 }} 个回答</span>
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>
          
          <el-col :span="8">
            <el-card class="answers-card" v-if="selectedQuestion">
              <template #header>
                <span>问题详情</span>
              </template>
              
              <div class="question-detail">
                <h3>{{ selectedQuestion.title }}</h3>
                <p class="question-author">提问者: {{ selectedQuestion.username }}</p>
                <p class="question-full-content">{{ selectedQuestion.content }}</p>
              </div>
              
              <div class="answers-section">
                <h4>回答 ({{ selectedQuestion.answers?.length || 0 }})</h4>
                <div class="answers-list">
                  <div 
                    v-for="answer in selectedQuestion.answers" 
                    :key="answer.id" 
                    class="answer-item"
                    :class="{ 'teacher-answer': answer.is_teacher }"
                  >
                    <div class="answer-header">
                      <span class="answer-user">{{ answer.username }}</span>
                      <el-tag v-if="answer.is_teacher" type="success" size="small">教师</el-tag>
                    </div>
                    <p class="answer-content">{{ answer.content }}</p>
                  </div>
                </div>
              </div>
              
              <div class="answer-input">
                <el-input 
                  v-model="answerContent" 
                  type="textarea" 
                  :rows="3" 
                  placeholder="写下您的回答..."
                />
                <el-button 
                  type="primary" 
                  style="margin-top: 10px" 
                  @click="submitAnswer"
                >
                  提交回答
                </el-button>
              </div>
            </el-card>
            
            <el-card class="chat-card" style="margin-top: 20px">
              <template #header>
                <span>实时交流</span>
              </template>
              
              <div class="chat-messages" ref="chatContainer">
                <div v-for="(msg, index) in messages" :key="index" class="chat-message">
                  <span class="chat-user">{{ msg.user }}:</span>
                  <span class="chat-text">{{ msg.text }}</span>
                </div>
              </div>
              
              <div class="chat-input">
                <el-input 
                  v-model="chatMessage" 
                  placeholder="输入消息..."
                  @keyup.enter="sendMessage"
                />
                <el-button type="primary" @click="sendMessage">发送</el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-main>
    </el-container>
    
    <el-dialog v-model="showAskDialog" title="发布问题" width="600px">
      <el-form :model="questionForm" label-width="80px">
        <el-form-item label="问题标题">
          <el-input v-model="questionForm.title" placeholder="请输入问题标题" />
        </el-form-item>
        <el-form-item label="问题描述">
          <el-input 
            v-model="questionForm.content" 
            type="textarea" 
            :rows="4" 
            placeholder="请详细描述您的问题..."
          />
        </el-form-item>
        <el-form-item label="相关针法">
          <el-select v-model="questionForm.stitch_id" placeholder="选择相关针法" style="width: 100%">
            <el-option 
              v-for="stitch in stitches" 
              :key="stitch.id" 
              :label="stitch.name" 
              :value="stitch.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAskDialog = false">取消</el-button>
        <el-button type="primary" @click="submitQuestion">发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user'
import { qaAPI, stitchAPI } from '@/api'
import { io } from 'socket.io-client'

const router = useRouter()
const userStore = useUserStore()

const questions = ref([])
const stitches = ref([])
const selectedQuestion = ref(null)
const showAskDialog = ref(false)
const questionForm = ref({
  title: '',
  content: '',
  stitch_id: null
})
const answerContent = ref('')
const chatMessage = ref('')
const messages = ref([])
const onlineUsers = ref(0)
const socketConnected = ref(false)
const reconnectAttempts = ref(0)
const maxReconnectAttempts = 5

let socket = null
let reconnectTimer = null

const goBack = () => {
  router.push('/')
}

const selectQuestion = async (question) => {
  try {
    const cacheKey = `question_${question.id}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      selectedQuestion.value = JSON.parse(cached)
    }
    
    const res = await qaAPI.getQuestion(question.id)
    if (res.success) {
      selectedQuestion.value = res.question
      localStorage.setItem(cacheKey, JSON.stringify(res.question))
    }
  } catch (error) {
    ElMessage.error('加载问题详情失败')
  }
}

const submitQuestion = async () => {
  try {
    const res = await qaAPI.createQuestion({
      user_id: userStore.user.id,
      ...questionForm.value
    })
    
    if (res.success) {
      ElMessage.success('问题发布成功')
      showAskDialog.value = false
      questionForm.value = { title: '', content: '', stitch_id: null }
      loadQuestions()
    }
  } catch (error) {
    ElMessage.error('发布失败')
  }
}

const submitAnswer = async () => {
  if (!answerContent.value.trim()) {
    ElMessage.warning('请输入回答内容')
    return
  }
  
  try {
    const res = await qaAPI.addAnswer(selectedQuestion.value.id, {
      user_id: userStore.user.id,
      content: answerContent.value,
      is_teacher: userStore.isTeacher
    })
    
    if (res.success) {
      ElMessage.success('回答提交成功')
      
      if (socketConnected.value && userStore.isTeacher) {
        socket.emit('teacherAnswer', {
          questionId: selectedQuestion.value.id,
          content: answerContent.value,
          user: userStore.user.username
        })
      }
      
      answerContent.value = ''
      selectQuestion(selectedQuestion.value)
    }
  } catch (error) {
    ElMessage.error('提交失败')
  }
}

const sendMessage = () => {
  if (!chatMessage.value.trim()) return
  
  const msg = {
    user: userStore.user.username,
    text: chatMessage.value
  }
  
  if (socketConnected.value) {
    socket.emit('sendMessage', msg)
  } else {
    messages.value.push({ ...msg, offline: true })
  }
  
  messages.value.push(msg)
  chatMessage.value = ''
  
  nextTick(() => {
    const chatContainer = document.querySelector('.chat-messages')
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }
  })
}

const initSocket = () => {
  socket = io('http://localhost:3000', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: maxReconnectAttempts,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  })
  
  socket.on('connect', () => {
    console.log('Socket连接成功')
    socketConnected.value = true
    reconnectAttempts.value = 0
    socket.emit('join', userStore.user.id)
  })
  
  socket.on('disconnect', () => {
    console.log('Socket断开连接')
    socketConnected.value = false
  })
  
  socket.on('connect_error', (error) => {
    console.error('Socket连接错误:', error)
    socketConnected.value = false
  })
  
  socket.on('reconnect_attempt', (attemptNumber) => {
    reconnectAttempts.value = attemptNumber
    console.log(`正在尝试重连... (${attemptNumber}/${maxReconnectAttempts})`)
  })
  
  socket.on('reconnect_failed', () => {
    ElMessage.error('连接服务器失败，请刷新页面重试')
  })
  
  socket.on('userOnline', (users) => {
    onlineUsers.value = users.length
  })
  
  socket.on('newMessage', (msg) => {
    const exists = messages.value.some(m => m.id === msg.id)
    if (!exists) {
      messages.value.push(msg)
      nextTick(() => {
        const chatContainer = document.querySelector('.chat-messages')
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight
        }
      })
    }
    if (msg.id) {
      socket.emit('messageAck', msg.id)
    }
  })
  
  socket.on('newAnswer', (data) => {
    ElMessage.info(`收到新回答: ${data.content?.substring(0, 20) || ''}...`)
    if (selectedQuestion.value?.id === data.questionId) {
      selectQuestion(selectedQuestion.value)
    }
    loadQuestions()
  })
  
  socket.on('notification', (notification) => {
    ElMessage.info(notification.title)
  })
}

const loadQuestions = async () => {
  try {
    const res = await qaAPI.getQuestions()
    if (res.success) {
      questions.value = res.questions
    }
  } catch (error) {
    console.error('加载问题列表失败', error)
  }
}

const loadStitches = async () => {
  try {
    const res = await stitchAPI.getStitches()
    if (res.success) {
      stitches.value = res.stitches
    }
  } catch (error) {
    console.error('加载针法列表失败', error)
  }
}

onMounted(() => {
  userStore.restoreUser()
  loadQuestions()
  loadStitches()
  initSocket()
  
  const savedMessages = localStorage.getItem('chatMessages')
  if (savedMessages) {
    messages.value = JSON.parse(savedMessages)
  }
})

onUnmounted(() => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
  }
  
  localStorage.setItem('chatMessages', JSON.stringify(messages.value.slice(-100)))
})
</script>

<style scoped>
.qa-container {
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

.main {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.questions-list {
  max-height: 600px;
  overflow-y: auto;
}

.question-item {
  padding: 20px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background 0.3s;
}

.question-item:hover {
  background: #f5f7fa;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.question-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.question-content {
  color: #666;
  margin-bottom: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #999;
}

.question-detail {
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
}

.question-detail h3 {
  margin-bottom: 10px;
  color: #333;
}

.question-author {
  color: #667eea;
  font-size: 14px;
  margin-bottom: 15px;
}

.question-full-content {
  color: #666;
  line-height: 1.6;
}

.answers-section h4 {
  margin-bottom: 15px;
  color: #333;
}

.answer-item {
  padding: 15px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 10px;
}

.answer-item.teacher-answer {
  background: #f0f9ff;
  border-left: 3px solid #67c23a;
}

.answer-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.answer-user {
  font-weight: bold;
  color: #667eea;
}

.answer-content {
  color: #666;
  margin: 0;
}

.answer-input {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.chat-messages {
  height: 250px;
  overflow-y: auto;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 15px;
}

.chat-message {
  margin-bottom: 10px;
  font-size: 14px;
}

.chat-user {
  font-weight: bold;
  color: #667eea;
}

.chat-text {
  color: #333;
}

.chat-input {
  display: flex;
  gap: 10px;
}
</style>
