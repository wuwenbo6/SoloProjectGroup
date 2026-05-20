<template>
  <div class="qa-page">
    <el-card class="qa-card">
      <template #header>
        <div class="card-header">
          <el-icon size="20"><ChatDotRound /></el-icon>
          <span>智能文档问答</span>
        </div>
      </template>

      <div class="document-selector">
        <el-select
          v-model="selectedDocument"
          placeholder="选择要查询的文档（可选）"
          clearable
          style="width: 100%; max-width: 400px"
        >
          <el-option
            v-for="doc in documents"
            :key="doc.document_id"
            :label="doc.filename"
            :value="doc.document_id"
          />
        </el-select>
      </div>

      <div class="chat-container">
        <div class="chat-messages" ref="messagesContainer">
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            :class="['message', msg.type]"
          >
            <div class="message-avatar">
              <el-icon v-if="msg.type === 'user'" size="24"><User /></el-icon>
              <el-icon v-else size="24"><Robot /></el-icon>
            </div>
            <div class="message-content">
              <div class="message-text">
                <template v-if="msg.content.includes('⚠️')">
                  <span
                    v-for="(part, partIdx) in splitMessage(msg.content)"
                    :key="partIdx"
                    :class="{'warning-inline': part.includes('⚠️')}"
                  >
                    {{ part }}
                  </span>
                </template>
                <template v-else>{{ msg.content }}</template>
              </div>
              <div v-if="msg.sources && msg.sources.length > 0" class="sources">
                <el-divider content-position="left">引用来源</el-divider>
                <el-timeline>
                  <el-timeline-item
                    v-for="(source, sIdx) in msg.sources"
                    :key="sIdx"
                    :timestamp="`${source.filename} - 第${source.page_num + 1}页`"
                    placement="top"
                  >
                    <el-card shadow="never" class="source-card">
                      {{ source.content.slice(0, 200) }}...
                    </el-card>
                  </el-timeline-item>
                </el-timeline>
              </div>
            </div>
          </div>

          <div v-if="loading" class="message assistant">
            <div class="message-avatar">
              <el-icon size="24"><Robot /></el-icon>
            </div>
            <div class="message-content">
              <el-skeleton :rows="3" animated />
            </div>
          </div>
        </div>

        <div class="input-area">
          <el-input
            v-model="query"
            type="textarea"
            :rows="3"
            placeholder="请输入您的问题..."
            @keydown.enter.ctrl="sendQuery"
            disabled
          />
          <div class="input-actions">
            <el-button type="primary" @click="sendQuery" :loading="loading">
              <el-icon><Promotion /></el-icon>
              发送 (Ctrl+Enter)
            </el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, User, Robot, Promotion } from '@element-plus/icons-vue'
import { queryDocument, getDocuments } from '@/api'

const selectedDocument = ref(null)
const documents = ref([])
const query = ref('')
const messages = ref([])
const loading = ref(false)
const messagesContainer = ref(null)

const splitMessage = (content) => {
  const parts = content.split(/(⚠️.*?。)/g).filter(p => p)
  return parts
}

onMounted(async () => {
  await loadDocuments()
  messages.value.push({
    type: 'assistant',
    content: '您好！我是文档问答助手。请上传文档后，向我提问关于文档的任何问题。'
  })
})

const loadDocuments = async () => {
  try {
    const response = await getDocuments()
    documents.value = response.data
  } catch (error) {
    console.error('加载文档列表失败:', error)
  }
}

const sendQuery = async () => {
  if (!query.value.trim()) {
    ElMessage.warning('请输入问题')
    return
  }

  messages.value.push({
    type: 'user',
    content: query.value
  })

  const userQuery = query.value
  query.value = ''
  loading.value = true

  await nextTick()
  scrollToBottom()

  try {
    const response = await queryDocument(userQuery, selectedDocument.value)

    messages.value.push({
      type: 'assistant',
      content: response.data.answer,
      sources: response.data.sources
    })
  } catch (error) {
    ElMessage.error('查询失败，请稍后重试')
    messages.value.push({
      type: 'assistant',
      content: '抱歉，查询过程中出现错误，请稍后重试。'
    })
  } finally {
    loading.value = false
    await nextTick()
    scrollToBottom()
  }
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}
</script>

<style scoped>
.qa-page {
  height: 100%;
}

.qa-card {
  height: calc(100vh - 130px);
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
}

.document-selector {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #fafafa;
  border-radius: 8px;
}

.message {
  display: flex;
  gap: 15px;
  margin-bottom: 25px;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.message.assistant .message-avatar {
  background: #e4e7ed;
  color: #606266;
}

.message-content {
  max-width: 70%;
}

.warning-inline {
  display: block;
  margin-top: 12px;
  padding: 10px 15px;
  background: #fff7e6;
  border-left: 4px solid #faad14;
  color: #d46b08;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
}

.message.user .message-content {
  text-align: right;
}

.message-text {
  padding: 12px 18px;
  border-radius: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message.user .message-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: inline-block;
  text-align: left;
}

.message.assistant .message-text {
  background: white;
  border: 1px solid #e4e7ed;
}

.sources {
  margin-top: 15px;
}

.source-card {
  background: #f5f7fa;
  font-size: 13px;
  color: #606266;
}

.input-area {
  margin-top: 20px;
}

.input-actions {
  margin-top: 15px;
  text-align: right;
}
</style>
