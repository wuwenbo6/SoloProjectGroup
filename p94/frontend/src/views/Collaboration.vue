<template>
  <div class="collaboration-page">
    <h2 class="page-title">多人协同采集</h2>

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="session-card">
          <template #header>
            <div class="card-header">
              <span>创建会话</span>
            </div>
          </template>
          <el-form :model="sessionForm" label-width="80px">
            <el-form-item label="会话名称">
              <el-input v-model="sessionForm.name" placeholder="输入会话名称" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="createSession" style="width: 100%">创建新会话</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="session-card" style="margin-top: 20px">
          <template #header>
            <span>加入会话</span>
          </template>
          <el-form :model="joinForm" label-width="80px">
            <el-form-item label="会话代码">
              <el-input v-model="joinForm.code" placeholder="输入会话代码" />
            </el-form-item>
            <el-form-item>
              <el-button type="success" @click="joinSession" style="width: 100%">加入会话</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card class="whiteboard-card">
          <template #header>
            <div class="card-header">
              <span>协同采集白板</span>
              <div v-if="currentSession" class="session-info">
                <el-tag>{{ currentSession.name }}</el-tag>
                <el-button type="danger" size="small" @click="leaveSession">离开</el-button>
              </div>
            </div>
          </template>

          <div v-if="!currentSession" class="empty-state">
            <el-empty description="请先创建或加入一个会话开始协同采集" />
          </div>

          <div v-else class="whiteboard-content">
            <div class="participants-section">
              <h4>在线参与者 ({{ participants.length }})</h4>
              <div class="participants-list">
                <el-tag
                  v-for="p in participants"
                  :key="p.id"
                  size="large"
                  :type="p.role === 'host' ? 'danger' : 'primary'"
                >
                  {{ p.name }}
                </el-tag>
              </div>
            </div>

            <div class="chat-section">
              <h4>实时交流</h4>
              <div class="chat-messages">
                <div v-for="msg in messages" :key="msg.id" class="chat-message">
                  <span class="msg-user">{{ msg.user }}:</span>
                  <span class="msg-text">{{ msg.text }}</span>
                  <span class="msg-time">{{ msg.time }}</span>
                </div>
              </div>
              <div class="chat-input">
                <el-input
                  v-model="newMessage"
                  placeholder="输入消息..."
                  @keyup.enter="sendMessage"
                >
                  <template #append>
                    <el-button @click="sendMessage">发送</el-button>
                  </template>
                </el-input>
              </div>
            </div>

            <div class="prop-preview">
              <div class="prop-header">
                <h4>当前采集道具</h4>
                <el-button type="primary" @click="showPropDialog = true">
                  <el-icon><Plus /></el-icon>
                  上传道具
                </el-button>
              </div>
              <div v-if="collabProps.length === 0" class="empty-props">
                暂无采集的道具
              </div>
              <el-row :gutter="15" v-else>
                <el-col :span="8" v-for="prop in collabProps" :key="prop.id">
                  <el-card class="collab-prop-card" shadow="hover">
                    <div v-if="isLocked(prop.id)" class="lock-overlay">
                      <el-icon class="lock-icon"><Lock /></el-icon>
                      <span class="lock-text">{{ getLockerName(prop.id) }} 正在编辑</span>
                    </div>
                    <div class="prop-image-small">
                      <img v-if="prop.imageUrl" :src="prop.imageUrl" />
                      <div v-else class="placeholder-small">
                        <el-icon><Image /></el-icon>
                      </div>
                    </div>
                    <div class="prop-info-small">
                      <div class="prop-name-small">{{ prop.name }}</div>
                      <el-tag size="small" type="info">{{ prop.category }}</el-tag>
                      <div class="prop-uploader">上传者: {{ prop.uploader }}</div>
                      <div class="prop-version">版本: v{{ prop.version }}</div>
                    </div>
                    <div class="prop-actions">
                      <el-button 
                        type="primary" 
                        size="small" 
                        link 
                        @click="editCollabProp(prop)"
                        :disabled="isLocked(prop.id)"
                      >
                        <el-icon><Edit /></el-icon>
                      </el-button>
                      <el-button 
                        type="danger" 
                        size="small" 
                        link 
                        @click="deleteCollabProp(prop)"
                        :disabled="isLocked(prop.id)"
                      >
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                  </el-card>
                </el-col>
              </el-row>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showPropDialog" :title="editingPropId ? '编辑道具' : '上传道具'" width="500px" @close="cancelPropEdit">
      <el-form :model="propForm" label-width="80px">
        <el-form-item label="道具名称">
          <el-input v-model="propForm.name" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="propForm.category" style="width: 100%">
            <el-option label="人物" value="人物" />
            <el-option label="动物" value="动物" />
            <el-option label="场景" value="场景" />
            <el-option label="器物" value="器物" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="propForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelPropEdit">取消</el-button>
        <el-button type="primary" @click="editingPropId ? savePropEdit() : addCollabProp()">
          {{ editingPropId ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const currentSession = ref(null)
const showPropDialog = ref(false)
const newMessage = ref('')
const currentUser = ref({ id: 1, name: '张采集', role: 'host' })
const editingPropId = ref(null)
const dataVersion = ref(0)
const lockMap = ref(new Map())

const sessionForm = reactive({
  name: ''
})

const joinForm = reactive({
  code: ''
})

const propForm = reactive({
  name: '',
  category: '',
  description: ''
})

const participants = ref([
  { id: 1, name: '张采集', role: 'host' }
])

const messages = ref([
  { id: 1, user: '系统', text: '会话已创建，欢迎开始协同采集！', time: '10:00:00' }
])

const collabProps = ref([])

const generateUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${currentUser.value.id}`
}

const acquireLock = (propId) => {
  if (lockMap.value.has(propId) && lockMap.value.get(propId).userId !== currentUser.value.id) {
    const locker = lockMap.value.get(propId)
    ElMessage.warning(`当前道具正被 ${locker.userName} 编辑中，请稍后再试`)
    return false
  }
  lockMap.value.set(propId, {
    userId: currentUser.value.id,
    userName: currentUser.value.name,
    timestamp: Date.now()
  })
  return true
}

const releaseLock = (propId) => {
  if (lockMap.value.has(propId) && lockMap.value.get(propId).userId === currentUser.value.id) {
    lockMap.value.delete(propId)
  }
}

const isLocked = (propId) => {
  return lockMap.value.has(propId) && lockMap.value.get(propId).userId !== currentUser.value.id
}

const getLockerName = (propId) => {
  return lockMap.value.has(propId) ? lockMap.value.get(propId).userName : ''
}

const createSession = () => {
  if (!sessionForm.name) {
    ElMessage.warning('请输入会话名称')
    return
  }
  const code = 'COLLAB-' + Math.random().toString(36).substr(2, 6).toUpperCase()
  currentSession.value = {
    id: Date.now(),
    name: sessionForm.name,
    code: code,
    version: dataVersion.value
  }
  ElMessage.success(`会话创建成功！代码: ${code}`)
  sessionForm.name = ''
}

const joinSession = () => {
  if (!joinForm.code) {
    ElMessage.warning('请输入会话代码')
    return
  }
  currentSession.value = {
    id: Date.now(),
    name: `会话 ${joinForm.code}`,
    code: joinForm.code,
    version: dataVersion.value
  }
  const newParticipantId = participants.value.length + 1
  participants.value.push({ 
    id: newParticipantId, 
    name: `采集员${newParticipantId}`, 
    role: 'participant' 
  })
  messages.value.push({
    id: Date.now(),
    user: '系统',
    text: `采集员${newParticipantId} 加入了会话`,
    time: new Date().toLocaleTimeString()
  })
  ElMessage.success('加入会话成功')
  joinForm.code = ''
}

const leaveSession = () => {
  ElMessageBox.confirm('确定要离开当前会话吗？未保存的数据将会丢失', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    currentSession.value = null
    collabProps.value = []
    lockMap.value.clear()
    dataVersion.value = 0
    messages.value = [{ id: 1, user: '系统', text: '会话已创建，欢迎开始协同采集！', time: new Date().toLocaleTimeString() }]
    participants.value = [{ id: 1, name: '张采集', role: 'host' }]
    ElMessage.info('已离开会话')
  }).catch(() => {})
}

const sendMessage = () => {
  if (!newMessage.value.trim()) return
  messages.value.push({
    id: Date.now(),
    user: currentUser.value.name,
    text: newMessage.value,
    time: new Date().toLocaleTimeString()
  })
  newMessage.value = ''
}

const addCollabProp = () => {
  if (!propForm.name || !propForm.category) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  const propId = generateUniqueId()
  const newProp = {
    id: propId,
    name: propForm.name,
    category: propForm.category,
    description: propForm.description || '',
    imageUrl: '',
    uploader: currentUser.value.name,
    uploaderId: currentUser.value.id,
    version: 1,
    createdAt: new Date().toLocaleTimeString(),
    lastModifiedBy: currentUser.value.name,
    lastModifiedAt: new Date().toLocaleTimeString()
  }
  
  collabProps.value.push(newProp)
  dataVersion.value++
  
  messages.value.push({
    id: Date.now(),
    user: '系统',
    text: `${currentUser.value.name} 上传了道具: ${propForm.name}`,
    time: new Date().toLocaleTimeString()
  })
  
  showPropDialog.value = false
  propForm.name = ''
  propForm.category = ''
  propForm.description = ''
  ElMessage.success('道具添加成功')
}

const editCollabProp = (prop) => {
  if (!acquireLock(prop.id)) return
  
  editingPropId.value = prop.id
  propForm.name = prop.name
  propForm.category = prop.category
  propForm.description = prop.description
  showPropDialog.value = true
}

const savePropEdit = () => {
  if (!editingPropId.value) return
  if (!propForm.name || !propForm.category) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  const propIndex = collabProps.value.findIndex(p => p.id === editingPropId.value)
  if (propIndex === -1) {
    ElMessage.error('道具不存在')
    return
  }
  
  const prop = collabProps.value[propIndex]
  prop.name = propForm.name
  prop.category = propForm.category
  prop.description = propForm.description || ''
  prop.version++
  prop.lastModifiedBy = currentUser.value.name
  prop.lastModifiedAt = new Date().toLocaleTimeString()
  
  dataVersion.value++
  
  messages.value.push({
    id: Date.now(),
    user: '系统',
    text: `${currentUser.value.name} 更新了道具: ${propForm.name}`,
    time: new Date().toLocaleTimeString()
  })
  
  releaseLock(editingPropId.value)
  editingPropId.value = null
  showPropDialog.value = false
  propForm.name = ''
  propForm.category = ''
  propForm.description = ''
  ElMessage.success('道具更新成功')
}

const cancelPropEdit = () => {
  if (editingPropId.value) {
    releaseLock(editingPropId.value)
    editingPropId.value = null
  }
  showPropDialog.value = false
  propForm.name = ''
  propForm.category = ''
  propForm.description = ''
}

const deleteCollabProp = (prop) => {
  ElMessageBox.confirm(`确定要删除道具「${prop.name}」吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const index = collabProps.value.findIndex(p => p.id === prop.id)
    if (index !== -1) {
      collabProps.value.splice(index, 1)
      dataVersion.value++
      releaseLock(prop.id)
      messages.value.push({
        id: Date.now(),
        user: '系统',
        text: `${currentUser.value.name} 删除了道具: ${prop.name}`,
        time: new Date().toLocaleTimeString()
      })
      ElMessage.success('道具删除成功')
    }
  }).catch(() => {})
}

onMounted(() => {
  const userData = localStorage.getItem('user')
  if (userData) {
    const user = JSON.parse(userData)
    currentUser.value = {
      id: user.id,
      name: user.realName || user.username,
      role: 'participant'
    }
  }
})
</script>

<style scoped>
.collaboration-page {
  padding: 0;
}
.page-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  color: #333;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.session-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
.empty-state {
  padding: 60px 0;
}
.whiteboard-content {
  min-height: 500px;
}
.participants-section {
  margin-bottom: 25px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}
.participants-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
}
.participants-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.chat-section {
  margin-bottom: 25px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}
.chat-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
}
.chat-messages {
  height: 200px;
  overflow-y: auto;
  background: #f9f9f9;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 12px;
}
.chat-message {
  margin-bottom: 8px;
  font-size: 14px;
}
.msg-user {
  color: #667eea;
  font-weight: 500;
}
.msg-text {
  color: #333;
  margin: 0 8px;
}
.msg-time {
  color: #999;
  font-size: 12px;
}
.prop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
.prop-header h4 {
  margin: 0;
  font-size: 16px;
}
.empty-props {
  padding: 30px;
  text-align: center;
  color: #999;
  background: #f9f9f9;
  border-radius: 6px;
}
.collab-prop-card {
  margin-top: 15px;
  position: relative;
}
.lock-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  z-index: 10;
}
.lock-icon {
  font-size: 32px;
  color: #ffd700;
  margin-bottom: 8px;
}
.lock-text {
  color: white;
  font-size: 12px;
}
.prop-image-small {
  width: 100%;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}
.prop-image-small img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.placeholder-small {
  color: #ccc;
  font-size: 32px;
}
.prop-name-small {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 5px;
}
.prop-uploader {
  font-size: 12px;
  color: #999;
  margin-top: 3px;
}
.prop-version {
  font-size: 11px;
  color: #667eea;
  margin-top: 2px;
}
.prop-actions {
  display: flex;
  justify-content: flex-end;
  gap: 5px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
}
</style>
