<template>
  <div class="annotation">
    <div class="annotation-header">
      <h2>{{ rubbing?.title || '文字释读' }}</h2>
      <div class="header-actions">
        <el-tag v-if="onlineUsers.length > 0" type="info">
          在线: {{ onlineUsers.length }}人
        </el-tag>

        <el-dropdown @command="handleRepair" v-if="!isProcessing">
          <el-button type="primary">
            图像修复<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="auto">自动修复</el-dropdown-item>
              <el-dropdown-item command="denoise">去噪优化</el-dropdown-item>
              <el-dropdown-item command="contrast">对比度增强</el-dropdown-item>
              <el-dropdown-item command="advanced">深度修复</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-button v-else type="primary" disabled>
          <el-icon class="is-loading"><Loading /></el-icon>处理中
        </el-button>

        <el-dropdown @command="handleExport">
          <el-button>
            导出<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="json">导出 JSON</el-dropdown-item>
              <el-dropdown-item command="csv">导出 CSV</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-button type="primary" @click="startOCR" :loading="ocrLoading" v-if="rubbing?.status === 'processed'">
          OCR识别
        </el-button>
        <el-button @click="saveAnnotation" :disabled="!selectedAnnotation">保存释读</el-button>
        <el-button type="success" @click="submitAnnotation" :disabled="!selectedAnnotation?.id">提交审核</el-button>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="14">
        <el-card class="image-card">
          <template #header>
            <div class="card-header">
              <span>拓片图像</span>
              <div class="zoom-controls">
                <el-button-group>
                  <el-button size="small" @click="zoomOut">-</el-button>
                  <el-button size="small">{{ zoomLevel }}%</el-button>
                  <el-button size="small" @click="zoomIn">+</el-button>
                  <el-button size="small" @click="resetZoom">100%</el-button>
                </el-button-group>
                <el-checkbox v-model="showBoxes" style="margin-left: 10px">显示标注框</el-checkbox>
              </div>
            </div>
          </template>
          <div class="image-container" ref="imageContainer" @wheel.prevent="handleWheel">
            <div
              class="rubbing-image"
              :style="{ transform: `scale(${zoomLevel / 100})` }"
              @mousedown="startSelect"
              @mousemove="onSelect"
              @mouseup="endSelect"
              @mouseleave="cancelSelect"
              @touchstart.prevent="handleTouchStart"
              @touchmove.prevent="handleTouchMove"
              @touchend.prevent="handleTouchEnd"
            >
              <img :src="imageSrc" alt="拓片" draggable="false" @load="onImageLoad">

              <div
                v-for="(box, index) in characterBoxes"
                :key="index"
                class="character-box"
                :class="{ active: selectedIndex === index, 'hidden-box': !showBoxes }"
                :style="{
                  left: (box.boundingBox?.left || box.left) + 'px',
                  top: (box.boundingBox?.top || box.top) + 'px',
                  width: (box.boundingBox?.width || box.width) + 'px',
                  height: (box.boundingBox?.height || box.height) + 'px'
                }"
                @click.stop="selectCharacter(index)"
              >
                <span class="box-label">{{ box.character || (index + 1) }}</span>
              </div>

              <div
                v-if="selecting"
                class="selection-box"
                :style="selectionStyle"
              ></div>
            </div>
          </div>

          <div class="keyboard-hints" v-if="showHints">
            <el-alert type="info" :closable="false">
              <template #title>
                <div class="hints-content">
                  <span><kbd>滚轮</kbd> 缩放图像</span>
                  <span><kbd>拖拽</kbd> 框选文字</span>
                  <span><kbd>↑↓←→</kbd> 移动标注</span>
                  <span><kbd>Del</kbd> 删除标注</span>
                  <el-button link type="primary" @click="showHints = false" style="margin-left: 10px">隐藏提示</el-button>
                </div>
              </template>
            </el-alert>
          </div>
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <span>释读列表 ({{ annotations.length }})</span>
              <el-input
                v-model="annotationFilter"
                placeholder="搜索文字或释义"
                style="width: 200px"
                size="small"
                clearable
              />
            </div>
          </template>
          <div class="annotation-grid">
            <div
              v-for="(item, index) in filteredAnnotations"
              :key="item.id || index"
              class="annotation-item"
              :class="{ active: selectedIndex === getOriginalIndex(index) }"
              @click="selectCharacter(getOriginalIndex(index))"
            >
              <div class="char-box">{{ item.character || '?' }}</div>
              <div class="char-info">
                <div class="pinyin">{{ item.pinyin || '-' }}</div>
                <div class="meaning">{{ item.meaning || '-' }}</div>
              </div>
              <div class="char-status">
                <el-tag :type="getStatusType(item.status)" size="small">
                  {{ getStatusLabel(item.status) }}
                </el-tag>
              </div>
            </div>
          </div>
          <el-empty v-if="filteredAnnotations.length === 0" description="暂无释读数据" />
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card class="editor-card">
          <template #header>
            <div class="card-header">
              <span>释读编辑</span>
              <span v-if="selectedAnnotation" class="position-info">
                第 {{ selectedIndex + 1 }} 字 | 共 {{ annotations.length }} 字
              </span>
            </div>
          </template>

          <div v-if="selectedAnnotation" class="editor-form">
            <el-form label-width="70px" size="small">
              <el-form-item label="文字">
                <el-input
                  v-model="selectedAnnotation.character"
                  maxlength="2"
                  class="char-input"
                  @input="onCharInput"
                >
                  <template #append>
                    <el-button @click="showDictionary = true" :disabled="!selectedAnnotation.character">
                      <el-icon><Search /></el-icon>查字典
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>

              <el-row :gutter="10">
                <el-col :span="12">
                  <el-form-item label="拼音">
                    <el-input v-model="selectedAnnotation.pinyin" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="部首">
                    <el-input v-model="selectedAnnotation.radical" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-form-item label="笔画数">
                <el-input-number v-model="selectedAnnotation.strokeCount" :min="1" :max="64" />
              </el-form-item>

              <el-form-item label="释义">
                <el-input
                  v-model="selectedAnnotation.meaning"
                  type="textarea"
                  :rows="4"
                  placeholder="输入该字的释义内容..."
                />
              </el-form-item>

              <el-form-item label="备注">
                <el-input
                  v-model="selectedAnnotation.notes"
                  type="textarea"
                  :rows="2"
                  placeholder="异体字、出处等备注信息..."
                />
              </el-form-item>

              <el-form-item label="位置微调">
                <el-button-group>
                  <el-button size="small" @click="adjustBox('left', -2)">←</el-button>
                  <el-button size="small" @click="adjustBox('top', -2)">↑</el-button>
                  <el-button size="small" @click="adjustBox('top', 2)">↓</el-button>
                  <el-button size="small" @click="adjustBox('left', 2)">→</el-button>
                </el-button-group>
                <el-button-group style="margin-left: 10px">
                  <el-button size="small" @click="adjustBox('width', -2)">窄</el-button>
                  <el-button size="small" @click="adjustBox('width', 2)">宽</el-button>
                  <el-button size="small" @click="adjustBox('height', -2)">矮</el-button>
                  <el-button size="small" @click="adjustBox('height', 2)">高</el-button>
                </el-button-group>
              </el-form-item>
            </el-form>

            <div class="editor-actions">
              <el-button type="primary" @click="saveAnnotation" style="width: 100%">
                保存当前释读
              </el-button>
            </div>
          </div>

          <div v-else class="empty-editor">
            <el-empty description="请在左侧图像上框选文字或点击已有标注">
              <template #description>
                <p>在图像上按住鼠标拖动即可框选新文字</p>
                <p>点击已有的标注框可以编辑内容</p>
              </template>
            </el-empty>
          </div>
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <span>金石字典查询</span>
            </div>
          </template>
          <div class="dictionary-search">
            <el-input
              v-model="dictKeyword"
              placeholder="输入文字或拼音查询..."
              @input="searchDictionary"
              clearable
            >
              <template #append>
                <el-button @click="searchDictionary" :loading="dictLoading">
                  <el-icon><Search /></el-icon>
                </el-button>
              </template>
            </el-input>

            <div class="dict-results" v-if="dictResults.length > 0">
              <div
                v-for="(item, index) in dictResults"
                :key="index"
                class="dict-item"
                @click="applyDictItem(item)"
              >
                <div class="dict-char">{{ item.character }}</div>
                <div class="dict-info">
                  <div class="dict-pinyin">{{ item.pinyin }} | {{ item.radical }}部 | {{ item.strokes }}画</div>
                  <div class="dict-meaning">{{ item.meaning }}</div>
                </div>
              </div>
            </div>
            <el-empty v-else-if="dictSearched" description="未找到相关释义" />
          </div>
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header>
            <span>协同聊天</span>
          </template>
          <div class="chat-container">
            <div class="messages" ref="messagesContainer">
              <div v-for="(msg, index) in messages" :key="index" class="message">
                <span class="user">{{ msg.user }}:</span>
                <span class="text">{{ msg.text }}</span>
              </div>
            </div>
            <div class="chat-input">
              <el-input
                v-model="chatMessage"
                placeholder="输入消息..."
                @keyup.enter="sendMessage"
              >
                <template #append>
                  <el-button @click="sendMessage">发送</el-button>
                </template>
              </el-input>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showDictionary" title="金石文字详解" width="500px">
      <div v-if="dictDetail" class="dict-detail">
        <div class="dict-detail-header">
          <div class="large-char">{{ dictDetail.character }}</div>
          <div class="char-meta">
            <p><strong>拼音：</strong>{{ dictDetail.pinyin }}</p>
            <p><strong>部首：</strong>{{ dictDetail.radical }}</p>
            <p><strong>笔画：</strong>{{ dictDetail.strokes }}</p>
            <p><strong>分类：</strong>{{ dictDetail.category }}</p>
          </div>
        </div>
        <div class="dict-detail-content">
          <p><strong>释义：</strong>{{ dictDetail.meaning }}</p>
          <p v-if="dictDetail.variants?.length">
            <strong>异体字：</strong>{{ dictDetail.variants.join('、') }}
          </p>
          <p v-if="dictDetail.usage?.length">
            <strong>常见用法：</strong>{{ dictDetail.usage.join('、') }}
          </p>
          <div v-if="dictDetail.relatedCharacters?.length" class="related-chars">
            <strong>同部首字：</strong>
            <span
              v-for="(c, i) in dictDetail.relatedCharacters"
              :key="i"
              class="related-char"
              @click="quickLookup(c.character)"
            >
              {{ c.character }}
            </span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="applyDictItem(dictDetail)" v-if="dictDetail">应用到标注</el-button>
        <el-button @click="showDictionary = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowDown, Search, Loading } from '@element-plus/icons-vue'
import api from '@/services/api'
import socketService from '@/services/socket'

const route = useRoute()
const imageContainer = ref()
const messagesContainer = ref()
const rubbing = ref(null)
const annotations = ref([])
const characterBoxes = ref([])
const selectedIndex = ref(-1)
const zoomLevel = ref(100)
const ocrLoading = ref(false)
const isProcessing = ref(false)
const onlineUsers = ref([])
const messages = ref([])
const chatMessage = ref('')
const showBoxes = ref(true)
const showHints = ref(true)
const annotationFilter = ref('')
const dictKeyword = ref('')
const dictResults = ref([])
const dictLoading = ref(false)
const dictSearched = ref(false)
const dictDetail = ref(null)
const showDictionary = ref(false)

const selecting = ref(false)
const selectionStart = ref({ x: 0, y: 0 })
const selectionEnd = ref({ x: 0, y: 0 })

const rubbingId = computed(() => route.params.id)

const imageSrc = computed(() => {
  return getFullImageUrl(rubbing.value?.processedImage || rubbing.value?.originalImage || '')
})

const selectedAnnotation = computed(() => {
  return selectedIndex.value >= 0 ? annotations.value[selectedIndex.value] : null
})

const filteredAnnotations = computed(() => {
  if (!annotationFilter.value) return annotations.value
  const filter = annotationFilter.value.toLowerCase()
  return annotations.value.filter(a =>
    (a.character || '').toLowerCase().includes(filter) ||
    (a.meaning || '').toLowerCase().includes(filter) ||
    (a.pinyin || '').toLowerCase().includes(filter)
  )
})

const selectionStyle = computed(() => {
  const left = Math.min(selectionStart.value.x, selectionEnd.value.x)
  const top = Math.min(selectionStart.value.y, selectionEnd.value.y)
  const width = Math.abs(selectionEnd.value.x - selectionStart.value.x)
  const height = Math.abs(selectionEnd.value.y - selectionStart.value.y)
  return {
    left: left + 'px',
    top: top + 'px',
    width: width + 'px',
    height: height + 'px'
  }
})

function getFullImageUrl(path) {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path
  return import.meta.env.VITE_API_BASE_URL + path
}

function getOriginalIndex(filteredIndex) {
  if (!annotationFilter.value) return filteredIndex
  const filteredItem = filteredAnnotations.value[filteredIndex]
  return annotations.value.indexOf(filteredItem)
}

async function loadRubbing() {
  try {
    const res = await api.get(`/rubbing/${rubbingId.value}`)
    rubbing.value = res.data
  } catch (err) {
    console.error(err)
  }
}

async function loadAnnotations() {
  try {
    const res = await api.get(`/annotation/rubbing/${rubbingId.value}`)
    annotations.value = res.data.annotations || []

    characterBoxes.value = annotations.value.map((a, index) => ({
      left: a.boundingBox?.left || 0,
      top: a.boundingBox?.top || 0,
      width: a.boundingBox?.width || 50,
      height: a.boundingBox?.height || 60,
      character: a.character,
      annotationIndex: index,
      ...a
    }))
  } catch (err) {
    console.error(err)
  }
}

async function startOCR() {
  ocrLoading.value = true
  try {
    await api.post(`/ocr/${rubbingId.value}/recognize`, { language: 'chi_tra' })
    ElMessage.success('OCR识别完成')
    loadAnnotations()
  } catch (err) {
    ElMessage.error('OCR识别失败')
  } finally {
    ocrLoading.value = false
  }
}

function zoomIn() {
  if (zoomLevel.value < 300) zoomLevel.value += 10
}

function zoomOut() {
  if (zoomLevel.value > 30) zoomLevel.value -= 10
}

function resetZoom() {
  zoomLevel.value = 100
}

function handleWheel(e) {
  e.preventDefault()
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

function startSelect(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  selecting.value = true
  selectionStart.value = {
    x: (e.clientX - rect.left) / (zoomLevel.value / 100),
    y: (e.clientY - rect.top) / (zoomLevel.value / 100)
  }
  selectionEnd.value = { ...selectionStart.value }
}

function onSelect(e) {
  if (!selecting.value) return
  const rect = e.currentTarget.getBoundingClientRect()
  selectionEnd.value = {
    x: (e.clientX - rect.left) / (zoomLevel.value / 100),
    y: (e.clientY - rect.top) / (zoomLevel.value / 100)
  }
}

function endSelect() {
  if (!selecting.value) return
  selecting.value = false

  const left = Math.min(selectionStart.value.x, selectionEnd.value.x)
  const top = Math.min(selectionStart.value.y, selectionEnd.value.y)
  const width = Math.abs(selectionEnd.value.x - selectionStart.value.x)
  const height = Math.abs(selectionEnd.value.y - selectionStart.value.y)

  if (width > 20 && height > 20) {
    const newAnnotation = {
      rubbingId: rubbingId.value,
      character: '',
      pinyin: '',
      radical: '',
      strokeCount: 1,
      meaning: '',
      notes: '',
      boundingBox: { left, top, width, height },
      position: annotations.value.length,
      status: 'draft'
    }
    annotations.value.push(newAnnotation)
    characterBoxes.value.push({
      left, top, width, height,
      character: '',
      annotationIndex: annotations.value.length - 1,
      ...newAnnotation
    })
    selectedIndex.value = annotations.value.length - 1
    socketService.emit('annotation-update', {
      rubbingId: rubbingId.value,
      annotation: newAnnotation
    })
  }
}

function cancelSelect() {
  selecting.value = false
}

function selectCharacter(index) {
  selectedIndex.value = index
  if (annotations.value[index]?.character) {
    dictKeyword.value = annotations.value[index].character
    searchDictionary()
  }
  socketService.emit('character-select', {
    rubbingId: rubbingId.value,
    characterIndex: index,
    boundingBox: characterBoxes.value[index]
  })
}

function adjustBox(prop, delta) {
  if (!selectedAnnotation.value) return
  if (!selectedAnnotation.value.boundingBox) {
    selectedAnnotation.value.boundingBox = {}
  }
  selectedAnnotation.value.boundingBox[prop] =
    (selectedAnnotation.value.boundingBox[prop] || 0) + delta

  const box = characterBoxes.value[selectedIndex.value]
  if (box) {
    box[prop] = (box[prop] || 0) + delta
  }
}

async function saveAnnotation() {
  if (!selectedAnnotation.value) {
    ElMessage.warning('请先选择或添加文字')
    return
  }
  try {
    if (selectedAnnotation.value.id) {
      await api.put(`/annotation/${selectedAnnotation.value.id}`, selectedAnnotation.value)
    } else {
      const res = await api.post('/annotation', selectedAnnotation.value)
      if (res.data && res.data.annotation) {
        selectedAnnotation.value.id = res.data.annotation.id
      }
    }

    const box = characterBoxes.value[selectedIndex.value]
    if (box) {
      box.character = selectedAnnotation.value.character
      box.boundingBox = selectedAnnotation.value.boundingBox
    }

    socketService.emit('annotation-update', {
      rubbingId: rubbingId.value,
      annotation: selectedAnnotation.value
    })

    ElMessage.success('保存成功')
  } catch (err) {
    console.error(err)
    ElMessage.error('保存失败: ' + (err.response?.data?.error || err.message))
  }
}

async function submitAnnotation() {
  if (!selectedAnnotation.value?.id) {
    ElMessage.warning('请先保存释读')
    return
  }
  try {
    await api.post(`/annotation/${selectedAnnotation.value.id}/submit`)
    selectedAnnotation.value.status = 'submitted'
    ElMessage.success('已提交审核')
  } catch (err) {
    console.error(err)
  }
}

async function handleRepair(mode) {
  isProcessing.value = true
  try {
    await api.post(`/rubbing/${rubbingId.value}/repair`, { repairMode: mode })
    ElMessage.success('图像修复完成，正在刷新...')
    setTimeout(() => loadRubbing(), 500)
  } catch (err) {
    ElMessage.error('修复失败: ' + (err.response?.data?.error || err.message))
  } finally {
    isProcessing.value = false
  }
}

async function handleExport(format) {
  try {
    const res = await api.get(`/annotation/${rubbingId.value}/export`, {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json'
    })

    if (format === 'csv') {
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${rubbing.value?.title || 'export'}-释读结果.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    } else {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${rubbing.value?.title || 'export'}-释读结果.json`
      link.click()
      URL.revokeObjectURL(link.href)
    }
    ElMessage.success('导出成功')
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

async function searchDictionary() {
  if (!dictKeyword.value.trim()) {
    dictResults.value = []
    dictSearched.value = false
    return
  }

  dictLoading.value = true
  dictSearched.value = true
  try {
    const res = await api.get('/dictionary/search', {
      params: { keyword: dictKeyword.value.trim(), pageSize: 5 }
    })
    dictResults.value = res.data.results || []
  } catch (err) {
    console.error(err)
  } finally {
    dictLoading.value = false
  }
}

async function quickLookup(char) {
  dictKeyword.value = char
  await searchDictionary()
  await loadDictDetail(char)
}

async function loadDictDetail(char) {
  try {
    const res = await api.get(`/dictionary/character/${encodeURIComponent(char)}`)
    dictDetail.value = res.data
  } catch (err) {
    dictDetail.value = null
  }
}

async function onCharInput() {
  if (selectedAnnotation.value?.character) {
    dictKeyword.value = selectedAnnotation.value.character
    await searchDictionary()
  }
}

function applyDictItem(item) {
  if (!selectedAnnotation.value || !item) return
  selectedAnnotation.value.character = item.character
  selectedAnnotation.value.pinyin = item.pinyin
  selectedAnnotation.value.radical = item.radical
  selectedAnnotation.value.strokeCount = item.strokes
  selectedAnnotation.value.meaning = item.meaning
  if (item.variants?.length) {
    selectedAnnotation.value.notes = `异体字：${item.variants.join('、')}`
  }
  ElMessage.success('已应用字典数据')
}

function sendMessage() {
  if (!chatMessage.value.trim()) return

  const message = {
    user: '我',
    text: chatMessage.value
  }
  messages.value.push(message)

  socketService.emit('chat-message', {
    rubbingId: rubbingId.value,
    message: chatMessage.value
  })

  chatMessage.value = ''

  setTimeout(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }, 10)
}

function getStatusType(status) {
  const types = { draft: 'info', submitted: 'warning', reviewed: 'primary', finalized: 'success' }
  return types[status] || 'info'
}

function getStatusLabel(status) {
  const labels = { draft: '草稿', submitted: '已提交', reviewed: '已审核', finalized: '已定稿' }
  return labels[status] || status
}

function setupSocketListeners() {
  socketService.on('user-joined', (data) => {
    onlineUsers.value = data.participants || []
    ElMessage.info(`${data.user?.username || '有人'} 加入协同`)
  })

  socketService.on('user-left', (data) => {
    onlineUsers.value = data.participants || []
  })

  socketService.on('annotation-changed', (data) => {
    console.log('Annotation changed:', data)
    loadAnnotations()
  })

  socketService.on('character-selected', (data) => {
    console.log('Character selected:', data)
  })

  socketService.on('new-message', (data) => {
    messages.value.push({
      user: data.user?.username || '匿名',
      text: data.message
    })
    setTimeout(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }, 10)
  })
}

function onImageLoad() {
  console.log('Image loaded')
}

let lastTouchDistance = 0

function handleTouchStart(e) {
  if (e.touches.length === 1) {
    const touch = e.touches[0]
    const rect = e.currentTarget.getBoundingClientRect()
    selecting.value = true
    selectionStart.value = {
      x: (touch.clientX - rect.left) / (zoomLevel.value / 100),
      y: (touch.clientY - rect.top) / (zoomLevel.value / 100)
    }
    selectionEnd.value = { ...selectionStart.value }
  } else if (e.touches.length === 2) {
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    lastTouchDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    )
  }
}

function handleTouchMove(e) {
  if (e.touches.length === 1 && selecting.value) {
    const touch = e.touches[0]
    const rect = e.currentTarget.getBoundingClientRect()
    selectionEnd.value = {
      x: (touch.clientX - rect.left) / (zoomLevel.value / 100),
      y: (touch.clientY - rect.top) / (zoomLevel.value / 100)
    }
  } else if (e.touches.length === 2) {
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    )
    const diff = distance - lastTouchDistance
    if (Math.abs(diff) > 5) {
      if (diff > 0) {
        zoomIn()
      } else {
        zoomOut()
      }
      lastTouchDistance = distance
    }
  }
}

function handleTouchEnd(e) {
  if (selecting.value) {
    endSelect(e)
  }
  lastTouchDistance = 0
}

function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault()
      adjustBox('top', -2)
      break
    case 'ArrowDown':
      e.preventDefault()
      adjustBox('top', 2)
      break
    case 'ArrowLeft':
      e.preventDefault()
      adjustBox('left', -2)
      break
    case 'ArrowRight':
      e.preventDefault()
      adjustBox('left', 2)
      break
    case 'Delete':
    case 'Backspace':
      if (selectedAnnotation.value && !selectedAnnotation.value.id) {
        e.preventDefault()
        annotations.value.splice(selectedIndex.value, 1)
        characterBoxes.value.splice(selectedIndex.value, 1)
        selectedIndex.value = -1
        ElMessage.info('已删除未保存的标注')
      }
      break
    case 's':
      if ((e.ctrlKey || e.metaKey) && selectedAnnotation.value) {
        e.preventDefault()
        saveAnnotation()
      }
      break
  }
}

onMounted(() => {
  loadRubbing()
  loadAnnotations()
  socketService.connect()
  socketService.joinSession(rubbingId.value)
  setupSocketListeners()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  socketService.leaveSession(rubbingId.value)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.annotation {
  padding: 20px;
}

.annotation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.annotation-header h2 {
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.zoom-controls {
  display: flex;
  align-items: center;
}

.image-container {
  overflow: auto;
  max-height: 500px;
  position: relative;
  background: #f5f5f5;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.rubbing-image {
  position: relative;
  display: inline-block;
  transform-origin: top left;
  min-width: 100%;
}

.rubbing-image img {
  display: block;
  max-width: 100%;
  min-width: 300px;
}

.character-box {
  position: absolute;
  border: 2px solid #409eff;
  background: rgba(64, 158, 255, 0.15);
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;
}

.character-box:hover {
  background: rgba(64, 158, 255, 0.3);
  border-color: #66b1ff;
}

.character-box.active {
  border-color: #f56c6c;
  background: rgba(245, 108, 108, 0.3);
  box-shadow: 0 0 8px rgba(245, 108, 108, 0.5);
  z-index: 10;
}

.character-box.hidden-box {
  border-color: transparent;
  background: transparent;
}

.character-box.hidden-box:hover {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.15);
}

.box-label {
  position: absolute;
  bottom: -22px;
  left: 50%;
  transform: translateX(-50%);
  background: #409eff;
  color: #fff;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  white-space: nowrap;
}

.selection-box {
  position: absolute;
  border: 2px dashed #67c23a;
  background: rgba(103, 194, 58, 0.2);
  pointer-events: none;
  z-index: 100;
}

.keyboard-hints {
  margin-top: 15px;
}

.hints-content {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.hints-content kbd {
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  box-shadow: 0 1px 1px rgba(0,0,0,0.1);
}

.annotation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.annotation-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}

.annotation-item:hover {
  border-color: #409eff;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.annotation-item.active {
  border-color: #f56c6c;
  background: #fef0f0;
}

.char-box {
  font-size: 24px;
  text-align: center;
  font-weight: bold;
  margin-bottom: 8px;
  min-height: 36px;
  color: #303133;
}

.char-info {
  font-size: 12px;
  color: #606266;
}

.pinyin {
  margin-bottom: 4px;
  color: #409eff;
}

.meaning {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}

.char-status {
  margin-top: 8px;
  text-align: center;
}

.editor-card {
  height: 100%;
}

.editor-form {
  padding: 10px 0;
}

.char-input :deep(.el-input__inner) {
  font-size: 28px;
  text-align: center;
  height: 50px;
}

.position-info {
  font-size: 14px;
  color: #909399;
}

.empty-editor {
  padding: 40px 0;
}

.empty-editor p {
  margin: 5px 0;
  color: #909399;
}

.editor-actions {
  margin-top: 20px;
}

.dictionary-search {
  min-height: 200px;
}

.dict-results {
  margin-top: 15px;
  max-height: 250px;
  overflow-y: auto;
}

.dict-item {
  display: flex;
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}

.dict-item:hover {
  border-color: #409eff;
  background: #ecf5ff;
}

.dict-char {
  font-size: 32px;
  font-weight: bold;
  margin-right: 15px;
  min-width: 50px;
  text-align: center;
  color: #303133;
}

.dict-info {
  flex: 1;
}

.dict-pinyin {
  font-size: 13px;
  color: #409eff;
  margin-bottom: 5px;
}

.dict-meaning {
  font-size: 13px;
  color: #606266;
  line-height: 1.4;
}

.dict-detail-header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 20px;
}

.large-char {
  font-size: 80px;
  font-weight: bold;
  margin-right: 30px;
  line-height: 1;
  color: #303133;
}

.char-meta p {
  margin: 8px 0;
  font-size: 15px;
}

.dict-detail-content p {
  margin: 10px 0;
  line-height: 1.6;
}

.related-chars {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #e4e7ed;
}

.related-char {
  display: inline-block;
  padding: 4px 10px;
  margin: 4px;
  background: #ecf5ff;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.related-char:hover {
  background: #409eff;
  color: #fff;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 220px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
}

.message {
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 1.5;
}

.message .user {
  color: #409eff;
  font-weight: bold;
}

.chat-input {
  padding-top: 10px;
  border-top: 1px solid #e4e7ed;
}

@media (max-width: 768px) {
  .annotation {
    padding: 10px;
  }

  .annotation-header {
    flex-direction: column;
    align-items: stretch;
  }

  .annotation-header h2 {
    font-size: 18px;
    text-align: center;
  }

  .header-actions {
    justify-content: center;
    flex-wrap: wrap;
  }

  .header-actions :deep(.el-button) {
    font-size: 12px;
    padding: 8px 12px;
  }

  .card-header {
    flex-direction: column;
    align-items: stretch;
  }

  .zoom-controls {
    justify-content: space-between;
  }

  .zoom-controls :deep(.el-button-group) {
    flex: 1;
  }

  .image-container {
    max-height: 400px;
    touch-action: none;
  }

  .annotation-grid {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    max-height: 250px;
  }

  .char-box {
    font-size: 20px;
  }

  .char-input :deep(.el-input__inner) {
    font-size: 24px;
    height: 44px;
  }

  .dict-detail-header {
    flex-direction: column;
    align-items: center;
  }

  .large-char {
    font-size: 60px;
    margin-right: 0;
    margin-bottom: 15px;
  }

  .char-meta {
    text-align: center;
  }

  .keyboard-hints {
    display: none;
  }

  .editor-card {
    margin-top: 15px;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .annotation {
    padding: 15px;
  }

  .image-container {
    max-height: 450px;
  }
}
</style>
