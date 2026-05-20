<template>
  <div class="interpretation-page">
    <el-page-header @back="goBack" class="page-header">
      <template #title>
        <div class="header-title">
          <span>{{ rubbing?.title || '文字释读' }}</span>
          <el-tag v-if="activeUsers.length > 0" type="success" size="small">
            在线: {{ activeUsers.length }}人
          </el-tag>
          <el-progress 
            :percentage="rubbing?.progress || 0" 
            :stroke-width="8"
            style="width: 200px; margin-left: 16px;"
          />
        </div>
      </template>
    </el-page-header>

    <el-row :gutter="20" class="content-row" v-loading="loading">
      <el-col :span="14" class="image-col">
        <el-card class="image-card">
          <template #header>
            <div class="card-header">
              <span>拓片图像</span>
              <div class="header-tools">
                <el-button-group size="small">
                  <el-button @click="zoomIn">
                    <el-icon><ZoomIn /></el-icon>
                  </el-button>
                  <el-button @click="zoomOut">
                    <el-icon><ZoomOut /></el-icon>
                  </el-button>
                  <el-button @click="resetZoom">
                    <el-icon><Refresh /></el-icon>
                  </el-button>
                </el-button-group>
                
                <el-dropdown @command="handleImageOperation" style="margin-left: 12px;">
                  <el-button size="small" type="primary">
                    <el-icon><MagicStick /></el-icon>
                    图像处理
                    <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="autoPreprocess">
                        <el-icon><MagicStick /></el-icon>
                        自动预处理
                      </el-dropdown-item>
                      <el-dropdown-item command="repair">
                        <el-icon><Tools /></el-icon>
                        图像修复
                      </el-dropdown-item>
                      <el-dropdown-item command="denoise">
                        <el-icon><Picture /></el-icon>
                        降噪处理
                      </el-dropdown-item>
                      <el-dropdown-item command="contrast">
                        <el-icon><Sunny /></el-icon>
                        增强对比度
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>

                <el-dropdown @command="handleExport" style="margin-left: 8px;">
                  <el-button size="small" type="success">
                    <el-icon><Download /></el-icon>
                    导出
                    <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item v-for="fmt in exportFormats" :key="fmt.id" :command="fmt.id">
                        {{ fmt.name }}
                        <span style="color: #999; font-size: 12px;">({{ fmt.description }})</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>

                <el-switch
                  v-model="showBoxes"
                  active-text="显示框选"
                  inactive-text="隐藏框选"
                  style="margin-left: 12px;"
                />
              </div>
            </div>
          </template>

          <div class="image-wrapper" ref="imageWrapper" @wheel="handleWheel">
            <div
              class="image-container"
              :style="{
                transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
                transformOrigin: 'center center'
              }"
              @mousedown="startDrag"
              @mouseup="endDrag"
              @mousemove="onDrag"
              ref="imageContainer"
            >
              <img
                :src="getImageUrl(rubbing?.processedImage || rubbing?.originalImage)"
                alt="拓片"
                class="rubbing-image"
                @load="onImageLoad"
                draggable="false"
              />
              <div
                v-if="showBoxes"
                v-for="char in filteredCharacters"
                :key="char.charId"
                class="char-box"
                :class="{
                  selected: selectedChar?.charId === char.charId,
                  confirmed: char.status === 'confirmed',
                  disputed: char.status === 'disputed',
                  pending: char.status === 'pending'
                }"
                :style="getCharBoxStyle(char)"
                @click.stop="selectCharacter(char)"
              >
                <span class="char-text">{{ char.interpretText || char.recognizedText }}</span>
                <div class="char-confidence" v-if="char.confidence">
                  {{ Math.round(char.confidence) }}%
                </div>
              </div>
            </div>
          </div>

          <div class="image-legend">
            <div class="legend-item">
              <span class="legend-box pending"></span>
              <span>待释读</span>
            </div>
            <div class="legend-item">
              <span class="legend-box confirmed"></span>
              <span>已确认</span>
            </div>
            <div class="legend-item">
              <span class="legend-box disputed"></span>
              <span>有争议</span>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="10" class="editor-col">
        <el-card class="editor-card">
          <template #header>
            <div class="editor-header">
              <span>文字编辑器</span>
              <el-select
                v-model="filterStatus"
                size="small"
                placeholder="筛选状态"
                style="width: 120px;"
                @change="filterCharacters"
                clearable
              >
                <el-option label="全部" value="" />
                <el-option label="待释读" value="pending" />
                <el-option label="已确认" value="confirmed" />
                <el-option label="有争议" value="disputed" />
              </el-select>
            </div>
          </template>

          <div v-if="selectedChar" class="char-editor">
            <div class="char-preview">
              <div class="preview-box">
                <span class="big-char">{{ selectedChar.interpretText || selectedChar.recognizedText || '?' }}</span>
              </div>
              <div class="char-info">
                <el-descriptions :column="1" size="small" border>
                  <el-descriptions-item label="识别置信度">
                    <el-tag :type="getConfidenceType(selectedChar.confidence)">
                      {{ (selectedChar.confidence || 0).toFixed(1) }}%
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="当前状态">
                    <el-tag :type="getStatusType(selectedChar.status)">
                      {{ getStatusText(selectedChar.status) }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="置信度建议">
                    <span v-if="selectedChar.confidence >= 80" class="text-success">
                      识别置信度高，可直接确认
                    </span>
                    <span v-else-if="selectedChar.confidence >= 60" class="text-warning">
                      建议人工核对后确认
                    </span>
                    <span v-else class="text-danger">
                      置信度较低，需仔细核对
                    </span>
                  </el-descriptions-item>
                </el-descriptions>
              </div>
            </div>

            <el-form label-width="80px" class="edit-form">
              <el-form-item label="识别文字">
                <el-input v-model="selectedChar.recognizedText" disabled />
              </el-form-item>
              <el-form-item label="释读文字">
                <el-input
                  v-model="interpretText"
                  placeholder="请输入释读文字"
                  maxlength="4"
                  show-word-limit
                  @input="onInterpretChange"
                >
                  <template #append>
                    <el-button @click="lookupSelectedChar" :disabled="!interpretText.trim()">
                      <el-icon><Search /></el-icon>
                      查询释义
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>
              
              <div v-if="dictionaryResult" class="dictionary-panel">
                <div class="panel-header">
                  <span class="panel-title">
                    <el-icon><Reading /></el-icon>
                    金石文字释义
                  </span>
                  <el-button size="small" text @click="dictionaryResult = null">
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
                <div v-if="dictionaryResult.found" class="dictionary-content">
                  <div class="char-display">
                    <span class="char-main">{{ dictionaryResult.character }}</span>
                  </div>
                  <div class="definition">
                    <strong>释义:</strong> {{ dictionaryResult.definition }}
                  </div>
                  <div class="radical">
                    <strong>部首:</strong> {{ dictionaryResult.radical }}
                  </div>
                  <div class="strokes">
                    <strong>笔画:</strong> {{ dictionaryResult.strokes }}画
                  </div>
                  <div class="variants" v-if="dictionaryResult.variants && dictionaryResult.variants.length">
                    <strong>异体字:</strong> {{ dictionaryResult.variants.join(', ') }}
                  </div>
                  <div class="examples" v-if="dictionaryResult.examples && dictionaryResult.examples.length">
                    <strong>例词:</strong> {{ dictionaryResult.examples.join(', ') }}
                  </div>
                  <div class="bronze-inscription" v-if="dictionaryResult.bronzeInscription">
                    <strong>金文说明:</strong> {{ dictionaryResult.bronzeInscription }}
                  </div>
                </div>
                <div v-else class="dictionary-not-found">
                  <el-icon size="40" color="#999"><Warning /></el-icon>
                  <p>{{ dictionaryResult.message }}</p>
                  <div v-if="dictionaryResult.suggestions && dictionaryResult.suggestions.length > 0" class="suggestions">
                    <span>相关字:</span>
                    <el-tag 
                      v-for="s in dictionaryResult.suggestions" 
                      :key="s" 
                      size="small" 
                      style="margin: 4px; cursor: pointer;"
                      @click="quickLookup(s)"
                    >
                      {{ s }}
                    </el-tag>
                  </div>
                </div>
              </div>

              <el-form-item class="action-buttons">
                <el-button
                  type="primary"
                  @click="saveInterpretation"
                  :loading="saving"
                  :disabled="!interpretText.trim()"
                >
                  <el-icon><Check /></el-icon>
                  保存释读
                </el-button>
                <el-button
                  type="success"
                  @click="confirmCharacter"
                  :loading="saving"
                  :disabled="!canConfirm || !interpretText.trim()"
                >
                  <el-icon><SuccessFilled /></el-icon>
                  确认正确
                </el-button>
                <el-button
                  type="warning"
                  @click="markDisputed"
                  :loading="saving"
                >
                  <el-icon><Warning /></el-icon>
                  标记争议
                </el-button>
              </el-form-item>
            </el-form>

            <div class="history-section">
              <div class="section-title">
                <el-icon><Timer /></el-icon>
                <span>释读历史记录</span>
              </div>
              <el-timeline v-if="historyRecords.length > 0">
                <el-timeline-item
                  v-for="record in historyRecords"
                  :key="record._id"
                  :timestamp="formatDate(record.timestamp)"
                  placement="top"
                >
                  <el-card shadow="hover" size="small">
                    <template #header>
                      <div class="record-header">
                        <el-avatar size="small">
                          {{ record.user?.username?.charAt(0) || '?' }}
                        </el-avatar>
                        <span class="username">{{ record.user?.username || '未知用户' }}</span>
                        <el-tag size="small" type="info">{{ getActionText(record.action) }}</el-tag>
                      </div>
                    </template>
                    <div class="record-content">
                      <span v-if="record.originalText" class="old-text">{{ record.originalText }}</span>
                      <el-icon class="arrow-icon"><ArrowRight /></el-icon>
                      <span class="new-text">{{ record.newText }}</span>
                    </div>
                  </el-card>
                </el-timeline-item>
              </el-timeline>
              <el-empty v-else description="暂无释读历史" />
            </div>
          </div>

          <div v-else class="no-selection">
            <el-icon size="64" color="#c0c0c0"><Edit /></el-icon>
            <p>点击图像中的文字框开始释读</p>
            <p class="tip">提示: 点击"查询释义"按钮可查看该字的金文释义</p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog
      v-model="syncDialogVisible"
      title="同步提示"
      width="400px"
      :close-on-click-modal="false"
    >
      <div class="sync-content">
        <el-icon class="sync-icon" color="#409eff"><Refresh /></el-icon>
        <p>检测到其他用户的更新，是否同步最新数据？</p>
      </div>
      <template #footer>
        <el-button @click="syncDialogVisible = false">稍后</el-button>
        <el-button type="primary" @click="syncRubbingData">立即同步</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { rubbingAPI } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { io } from 'socket.io-client'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const processingImage = ref(false)
const rubbing = ref(null)
const selectedChar = ref(null)
const interpretText = ref('')
const filterStatus = ref('')
const historyRecords = ref([])
const showBoxes = ref(true)
const syncDialogVisible = ref(false)
const dictionaryResult = ref(null)
const exportFormats = ref([])

const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

const activeUsers = ref([])
const socket = ref(null)
const permissions = ref({})

const filteredCharacters = computed(() => {
  if (!rubbing.value?.characters) return []
  if (!filterStatus.value) return rubbing.value.characters
  return rubbing.value.characters.filter(c => c.status === filterStatus.value)
})

const canConfirm = computed(() => {
  return permissions.value.canConfirm || false
})

const initSocket = () => {
  socket.value = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  })
  
  socket.value.on('connect', () => {
    console.log('WebSocket连接成功')
    socket.value.emit('join-rubbing', {
      rubbingId: route.params.id,
      userId: authStore.user?.id,
      username: authStore.user?.username
    })
  })

  socket.value.on('disconnect', () => {
    console.log('WebSocket连接断开')
  })

  socket.value.on('user-joined', (data) => {
    activeUsers.value = data.activeUsers.map(u => u.userId || u)
    ElMessage.info(`${data.username} 加入了协作`)
  })

  socket.value.on('user-left', (data) => {
    activeUsers.value = data.activeUsers.map(u => u.userId || u)
    ElMessage.info(`${data.username} 离开了协作`)
  })

  socket.value.on('session-init', (data) => {
    activeUsers.value = data.activeUsers.map(u => u.userId || u)
  })

  socket.value.on('batch-character-update', (data) => {
    if (rubbing.value?.characters) {
      const index = rubbing.value.characters.findIndex(c => c.charId === data.characterId)
      if (index !== -1) {
        const char = rubbing.value.characters[index]
        const latestUpdate = data.updates[data.updates.length - 1]
        Object.assign(char, latestUpdate)
        updateProgress()
      }
    }
  })

  socket.value.on('character-confirmed', (data) => {
    if (rubbing.value?.characters) {
      const index = rubbing.value.characters.findIndex(c => c.charId === data.characterId)
      if (index !== -1) {
        Object.assign(rubbing.value.characters[index], data.data)
        updateProgress()
      }
    }
    ElMessage.success(`用户 ${data.username} 确认了一个文字`)
  })

  socket.value.on('progress-update', (data) => {
    if (rubbing.value) {
      rubbing.value.progress = data.progress
    }
  })
}

const loadPermissions = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/permissions`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await response.json()
    permissions.value = data.permissions || {}
  } catch (error) {
    console.error('加载权限失败:', error)
  }
}

const loadExportFormats = async () => {
  try {
    const response = await rubbingAPI.getExportFormats()
    exportFormats.value = response.data.formats || []
  } catch (error) {
    console.error('加载导出格式失败:', error)
  }
}

const loadRubbing = async () => {
  loading.value = true
  try {
    const response = await rubbingAPI.get(route.params.id)
    rubbing.value = response.data.rubbing
  } catch (error) {
    ElMessage.error('加载拓片失败')
  } finally {
    loading.value = false
  }
}

const loadHistory = async (charId) => {
  try {
    const response = await rubbingAPI.getHistory(route.params.id, charId)
    historyRecords.value = response.data.records || []
  } catch (error) {
    console.error('加载历史失败:', error)
  }
}

const selectCharacter = (char) => {
  selectedChar.value = char
  interpretText.value = char.interpretText || ''
  dictionaryResult.value = null
  loadHistory(char.charId)
}

const onInterpretChange = () => {
  if (socket.value && selectedChar.value) {
    socket.value.emit('cursor-position', {
      rubbingId: route.params.id,
      userId: authStore.user?.id,
      username: authStore.user?.username,
      position: { charId: selectedChar.value.charId }
    })
  }
}

const lookupSelectedChar = async () => {
  const char = interpretText.value.trim() || selectedChar.value?.recognizedText
  if (!char || char.length !== 1) {
    ElMessage.warning('请输入单个汉字进行查询')
    return
  }
  
  try {
    const response = await rubbingAPI.lookupCharacter(char)
    dictionaryResult.value = response.data
  } catch (error) {
    ElMessage.error('查询释义失败')
  }
}

const quickLookup = async (char) => {
  interpretText.value = char
  try {
    const response = await rubbingAPI.lookupCharacter(char)
    dictionaryResult.value = response.data
  } catch (error) {
    ElMessage.error('查询释义失败')
  }
}

const saveInterpretation = async () => {
  if (!selectedChar.value || !interpretText.value.trim()) {
    ElMessage.warning('请输入释读文字')
    return
  }
  
  saving.value = true
  try {
    await rubbingAPI.updateCharacter(route.params.id, {
      charId: selectedChar.value.charId,
      interpretText: interpretText.value.trim(),
      status: 'pending'
    })
    
    selectedChar.value.interpretText = interpretText.value.trim()
    selectedChar.value.status = 'pending'
    updateProgress()
    
    if (socket.value) {
      socket.value.emit('character-update', {
        rubbingId: route.params.id,
        characterId: selectedChar.value.charId,
        data: {
          interpretText: interpretText.value.trim(),
          status: 'pending'
        },
        userId: authStore.user?.id,
        username: authStore.user?.username
      })
    }
    
    ElMessage.success('保存成功')
    loadHistory(selectedChar.value.charId)
  } catch (error) {
    if (error.response?.status === 403) {
      ElMessage.error(error.response.data.message || '权限不足')
    } else {
      ElMessage.error('保存失败')
    }
  } finally {
    saving.value = false
  }
}

const confirmCharacter = async () => {
  if (!selectedChar.value) return
  
  if (!canConfirm.value) {
    ElMessage.error('您没有确认释读的权限，请联系管理员')
    return
  }

  saving.value = true
  try {
    await rubbingAPI.confirmCharacter(route.params.id, selectedChar.value.charId)
    
    selectedChar.value.status = 'confirmed'
    if (interpretText.value.trim()) {
      selectedChar.value.interpretText = interpretText.value.trim()
    }
    updateProgress()
    
    if (socket.value) {
      socket.value.emit('confirm-update', {
        rubbingId: route.params.id,
        characterId: selectedChar.value.charId,
        data: {
          interpretText: selectedChar.value.interpretText,
          status: 'confirmed'
        },
        userId: authStore.user?.id,
        username: authStore.user?.username
      })
    }
    
    ElMessage.success('确认成功')
    loadHistory(selectedChar.value.charId)
  } catch (error) {
    if (error.response?.status === 403) {
      ElMessage.error(error.response.data.message || '权限不足')
    } else {
      ElMessage.error('操作失败')
    }
  } finally {
    saving.value = false
  }
}

const markDisputed = async () => {
  if (!selectedChar.value) return
  
  saving.value = true
  try {
    await rubbingAPI.updateCharacter(route.params.id, {
      charId: selectedChar.value.charId,
      status: 'disputed'
    })
    
    selectedChar.value.status = 'disputed'
    updateProgress()
    
    if (socket.value) {
      socket.value.emit('character-update', {
        rubbingId: route.params.id,
        characterId: selectedChar.value.charId,
        data: { status: 'disputed' },
        userId: authStore.user?.id,
        username: authStore.user?.username
      })
    }
    
    ElMessage.success('已标记为争议')
    loadHistory(selectedChar.value.charId)
  } catch (error) {
    if (error.response?.status === 403) {
      ElMessage.error(error.response.data.message || '权限不足')
    } else {
      ElMessage.error('操作失败')
    }
  } finally {
    saving.value = false
  }
}

const updateProgress = () => {
  if (!rubbing.value?.characters) return
  const confirmed = rubbing.value.characters.filter(c => c.status === 'confirmed').length
  rubbing.value.progress = Math.round((confirmed / rubbing.value.characters.length) * 100)
}

const handleImageOperation = async (command) => {
  processingImage.value = true
  try {
    switch (command) {
      case 'autoPreprocess':
        await rubbingAPI.autoPreprocess(route.params.id)
        ElMessage.success('自动预处理完成')
        break
      case 'repair':
        await rubbingAPI.repairImage(route.params.id, {
          removeScratches: true,
          removeStains: true,
          enhanceContrast: true,
          sharpen: true
        })
        ElMessage.success('图像修复完成')
        break
      case 'denoise':
        await rubbingAPI.processImage(route.params.id, [{ type: 'denoise' }])
        ElMessage.success('降噪处理完成')
        break
      case 'contrast':
        await rubbingAPI.processImage(route.params.id, [{ type: 'contrast', contrast: 1.3 }])
        ElMessage.success('对比度增强完成')
        break
    }
    await loadRubbing()
  } catch (error) {
    ElMessage.error('图像处理失败')
  } finally {
    processingImage.value = false
  }
}

const handleExport = async (format) => {
  try {
    const response = await rubbingAPI.exportRubbing(route.params.id, format)
    const { downloadUrl, filename } = response.data
    
    const link = document.createElement('a')
    link.href = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

const syncRubbingData = async () => {
  syncDialogVisible.value = false
  const currentCharId = selectedChar.value?.charId
  await loadRubbing()
  if (currentCharId) {
    const char = rubbing.value.characters.find(c => c.charId === currentCharId)
    if (char) {
      selectedChar.value = char
      interpretText.value = char.interpretText || ''
    }
  }
  ElMessage.success('数据已同步')
}

const filterCharacters = () => {
}

const getCharBoxStyle = (char) => {
  const { x, y, width, height } = char.boundingBox || {}
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`
  }
}

const getImageUrl = (path) => {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return (import.meta.env.VITE_API_URL || 'http://localhost:3000') + path
}

const getConfidenceType = (confidence) => {
  if (confidence >= 80) return 'success'
  if (confidence >= 60) return 'warning'
  return 'danger'
}

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    confirmed: 'success',
    disputed: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待释读',
    confirmed: '已确认',
    disputed: '有争议'
  }
  return map[status] || status
}

const getActionText = (action) => {
  const map = {
    recognize: '识别',
    interpret: '释读',
    revise: '修改',
    confirm: '确认',
    reject: '驳回'
  }
  return map[action] || action
}

const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN')
}

const goBack = () => {
  router.back()
}

const zoomIn = () => {
  scale.value = Math.min(scale.value + 0.1, 3)
}

const zoomOut = () => {
  scale.value = Math.max(scale.value - 0.1, 0.5)
}

const resetZoom = () => {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}

const handleWheel = (e) => {
  e.preventDefault()
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

const startDrag = (e) => {
  isDragging.value = true
  dragStart.value = {
    x: e.clientX - translateX.value,
    y: e.clientY - translateY.value
  }
}

const endDrag = () => {
  isDragging.value = false
}

const onDrag = (e) => {
  if (!isDragging.value) return
  translateX.value = e.clientX - dragStart.value.x
  translateY.value = e.clientY - dragStart.value.y
}

const onImageLoad = () => {
  console.log('图片加载完成')
}

onMounted(() => {
  loadPermissions()
  loadExportFormats()
  loadRubbing()
  initSocket()
})

onUnmounted(() => {
  if (socket.value) {
    socket.value.emit('leave-rubbing', {
      rubbingId: route.params.id,
      userId: authStore.user?.id,
      username: authStore.user?.username
    })
    socket.value.disconnect()
  }
})
</script>

<style scoped>
.interpretation-page {
  min-height: 100%;
  background: #f5f7fa;
}

.page-header {
  background: #fff;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.content-row {
  padding: 0 20px 20px;
}

.image-card {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-tools {
  display: flex;
  align-items: center;
}

.image-wrapper {
  overflow: hidden;
  height: calc(100vh - 280px);
  background: #fafafa;
  border-radius: 8px;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.image-wrapper:active {
  cursor: grabbing;
}

.image-container {
  position: relative;
  transition: transform 0.1s ease-out;
  user-select: none;
}

.rubbing-image {
  max-width: 100%;
  max-height: 100%;
  display: block;
  user-drag: none;
  -webkit-user-drag: none;
}

.char-box {
  position: absolute;
  border: 2px solid #409eff;
  background: rgba(64, 158, 255, 0.15);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  overflow: hidden;
  backdrop-filter: blur(4px);
}

.char-box:hover {
  background: rgba(64, 158, 255, 0.3);
  transform: scale(1.05);
  z-index: 10;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.4);
}

.char-box.selected {
  border-color: #f56c6c;
  background: rgba(245, 108, 108, 0.25);
  z-index: 20;
  box-shadow: 0 2px 12px rgba(245, 108, 108, 0.4);
}

.char-box.confirmed {
  border-color: #67c23a;
  background: rgba(103, 194, 58, 0.15);
}

.char-box.disputed {
  border-color: #e6a23c;
  background: rgba(230, 162, 60, 0.15);
}

.char-text {
  font-size: 12px;
  font-weight: bold;
  color: #333;
  background: rgba(255, 255, 255, 0.9);
  padding: 1px 4px;
  border-radius: 2px;
  text-shadow: 0 1px 2px rgba(255,255,255,0.8);
}

.char-confidence {
  font-size: 10px;
  color: #666;
  background: rgba(255, 255, 255, 0.8);
  padding: 0 4px;
  margin-top: 2px;
}

.image-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #666;
}

.legend-box {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid;
}

.legend-box.pending {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.15);
}

.legend-box.confirmed {
  border-color: #67c23a;
  background: rgba(103, 194, 58, 0.15);
}

.legend-box.disputed {
  border-color: #e6a23c;
  background: rgba(230, 162, 60, 0.15);
}

.editor-card {
  height: 100%;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.char-preview {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.preview-box {
  width: 100px;
  height: 100px;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.big-char {
  font-size: 56px;
  font-weight: bold;
  color: #333;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.char-info {
  flex: 1;
}

.edit-form {
  margin-bottom: 20px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dictionary-panel {
  margin-bottom: 20px;
  padding: 16px;
  background: linear-gradient(135deg, #fdf6e3 0%, #f5f0e6 100%);
  border-radius: 8px;
  border: 1px solid #e6dcb0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e6dcb0;
}

.panel-title {
  font-weight: bold;
  color: #8b4513;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dictionary-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.char-display {
  text-align: center;
  margin-bottom: 8px;
}

.char-main {
  font-size: 48px;
  font-weight: bold;
  color: #8b4513;
  text-shadow: 0 2px 4px rgba(139, 69, 19, 0.2);
}

.definition, .radical, .strokes, .variants, .examples, .bronze-inscription {
  font-size: 14px;
  line-height: 1.6;
  color: #5a4a3a;
}

.dictionary-not-found {
  text-align: center;
  padding: 20px;
  color: #999;
}

.dictionary-not-found p {
  margin: 12px 0;
}

.suggestions {
  margin-top: 12px;
}

.suggestions span {
  margin-right: 8px;
  color: #666;
}

.history-section {
  border-top: 1px solid #ebeef5;
  padding-top: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.record-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.username {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
}

.record-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.old-text {
  color: #909399;
  text-decoration: line-through;
}

.arrow-icon {
  color: #409eff;
}

.new-text {
  font-weight: 500;
  color: #67c23a;
}

.no-selection {
  text-align: center;
  padding: 80px 20px;
  color: #909399;
}

.no-selection p {
  margin-top: 16px;
  font-size: 14px;
}

.tip {
  font-size: 12px !important;
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
  padding: 8px 16px;
  border-radius: 16px;
  margin: 16px auto !important;
  max-width: 300px;
}

.text-success {
  color: #67c23a;
}

.text-warning {
  color: #e6a23c;
}

.text-danger {
  color: #f56c6c;
}

.sync-content {
  text-align: center;
  padding: 20px;
}

.sync-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
</style>
