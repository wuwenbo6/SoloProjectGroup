<template>
  <div class="pattern-detail">
    <div class="detail-header">
      <el-button @click="goBack" link>
        <el-icon><ArrowLeft /></el-icon>
        返回列表
      </el-button>
      <div class="header-actions">
        <el-button @click="toggleEdit">
          <el-icon><Edit /></el-icon>
          {{ isEditing ? '取消编辑' : '编辑纹样' }}
        </el-button>
        <el-button type="danger" @click="handleDelete">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </div>
    </div>
    
    <div class="detail-content">
      <div class="left-section">
        <div class="main-image">
          <img :src="pattern?.imageUrl" :alt="pattern?.name" />
          <div v-if="editorCount > 1" class="collab-indicator">
            <el-icon><User /></el-icon>
            {{ editorCount }} 人正在编辑
          </div>
        </div>
        
        <div class="colors-section">
          <h3>色彩提取</h3>
          <div class="colors-list">
            <div 
              v-for="(color, index) in pattern?.colors" 
              :key="index"
              class="color-item"
            >
              <div class="color-swatch" :style="{ backgroundColor: color.hex }"></div>
              <div class="color-info">
                <span class="color-hex">{{ color.hex }}</span>
                <span class="color-percent">{{ color.percentage }}%</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="similar-section">
          <h3>相似纹样</h3>
          <div class="similar-grid">
            <div 
              v-for="item in similarPatterns" 
              :key="item._id"
              class="similar-item"
              @click="goToPattern(item._id)"
            >
              <img :src="item.imageUrl" :alt="item.name" />
              <span>{{ item.name }}</span>
            </div>
          </div>
          <el-empty v-if="similarPatterns.length === 0" description="暂无相似纹样" />
        </div>
      </div>
      
      <div class="right-section">
        <el-form v-if="pattern" :model="pattern" label-width="80px">
          <el-form-item label="纹样名称">
            <el-input 
              v-model="pattern.name" 
              :disabled="!isEditing"
              placeholder="请输入纹样名称"
            />
          </el-form-item>
          
          <el-form-item label="分类">
            <el-select 
              v-model="pattern.category" 
              :disabled="!isEditing"
              style="width: 100%"
            >
              <el-option label="生角" value="生角" />
              <el-option label="旦角" value="旦角" />
              <el-option label="净角" value="净角" />
              <el-option label="末角" value="末角" />
              <el-option label="丑角" value="丑角" />
            </el-select>
          </el-form-item>
          
          <el-form-item label="标签">
            <el-input 
              v-model="pattern.tags" 
              :disabled="!isEditing"
              placeholder="多个标签用逗号分隔"
            />
          </el-form-item>
          
          <el-form-item label="描述">
            <el-input 
              v-model="pattern.description" 
              type="textarea" 
              :rows="4"
              :disabled="!isEditing"
              placeholder="请输入描述信息"
            />
          </el-form-item>
          
          <el-form-item v-if="isEditing">
            <el-button type="primary" @click="savePattern">保存修改</el-button>
            <el-button @click="toggleEdit">取消</el-button>
          </el-form-item>
        </el-form>
        
        <div class="outline-section">
          <h3>纹样勾勒</h3>
          <PatternCanvas 
            :image-url="pattern?.imageUrl"
            :pattern-id="$route.params.id"
            :outline-data="pattern?.outlineData"
            @outline-change="handleOutlineChange"
          />
        </div>
        
        <div class="meta-info">
          <div class="meta-item">
            <span class="meta-label">创建时间</span>
            <span class="meta-value">{{ formatDate(pattern?.createdAt) }}</span>
          </div>
          <div class="meta-item" v-if="pattern?.createdBy">
            <span class="meta-label">创建者</span>
            <span class="meta-value">
              <el-avatar :size="20" :src="pattern.createdBy.avatar" />
              {{ pattern.createdBy.username }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Edit, Delete, User } from '@element-plus/icons-vue'
import { usePatternStore } from '../stores/pattern'
import PatternCanvas from '../components/PatternCanvas.vue'
import { io } from 'socket.io-client'

const route = useRoute()
const router = useRouter()
const patternStore = usePatternStore()

const pattern = ref(null)
const isEditing = ref(false)
const editorCount = ref(1)
const socket = ref(null)

const similarPatterns = ref([
  { _id: 's1', name: '类似纹样1', imageUrl: 'https://picsum.photos/100/100?random=10' },
  { _id: 's2', name: '类似纹样2', imageUrl: 'https://picsum.photos/100/100?random=11' },
  { _id: 's3', name: '类似纹样3', imageUrl: 'https://picsum.photos/100/100?random=12' },
])

onMounted(async () => {
  await loadPattern()
  initSocket()
})

onUnmounted(() => {
  if (socket.value) {
    socket.value.emit('leave-pattern', route.params.id)
    socket.value.disconnect()
  }
})

const initSocket = () => {
  socket.value = io()
  
  socket.value.emit('join-pattern', route.params.id)
  
  socket.value.on('editor-count', (data) => {
    editorCount.value = data.count
  })
  
  socket.value.on('pattern-updated', (data) => {
    if (data._id === pattern.value?._id) {
      pattern.value = data
    }
  })
}

const loadPattern = async () => {
  try {
    pattern.value = {
      _id: route.params.id,
      name: '关羽红脸',
      category: '净角',
      tags: ['红色', '整脸', '三国'],
      description: '关羽典型红脸，整脸涂红，眉毛细长上挑，丹凤眼，象征忠义勇武。这是京剧脸谱中最具代表性的纹样之一。',
      imageUrl: 'https://picsum.photos/400/400?random=1',
      outlineData: [],
      colors: [
        { hex: '#c41e3a', percentage: 45.2, rgb: { r: 196, g: 30, b: 58 } },
        { hex: '#1a1a1a', percentage: 32.8, rgb: { r: 26, g: 26, b: 26 } },
        { hex: '#f5f5f5', percentage: 15.3, rgb: { r: 245, g: 245, b: 245 } },
        { hex: '#d4a574', percentage: 6.7, rgb: { r: 212, g: 165, b: 116 } },
      ],
      createdAt: new Date('2024-01-15'),
      createdBy: {
        username: '采集员',
        avatar: 'https://picsum.photos/40/40?random=1'
      }
    }
  } catch (err) {
    ElMessage.error('加载纹样失败')
  }
}

const toggleEdit = () => {
  isEditing.value = !isEditing.value
}

const savePattern = async () => {
  try {
    ElMessage.success('保存成功')
    isEditing.value = false
    
    if (socket.value) {
      socket.value.emit('update-pattern', pattern.value)
    }
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个纹样吗？此操作不可恢复',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    ElMessage.success('删除成功')
    router.push('/')
  } catch {
  }
}

const handleOutlineChange = (data) => {
  console.log('轮廓数据更新:', data)
}

const goBack = () => {
  router.back()
}

const goToPattern = (id) => {
  router.push(`/pattern/${id}`)
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>

<style scoped>
.pattern-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e4e7ed;
  
  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.detail-content {
  flex: 1;
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 24px;
  overflow: hidden;
}

.left-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.main-image {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #f5f7fa;
  
  img {
    width: 100%;
    display: block;
  }
  
  .collab-indicator {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(64, 158, 255, 0.9);
    color: #fff;
    border-radius: 20px;
    font-size: 13px;
  }
}

.colors-section,
.similar-section {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  
  h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #303133;
  }
}

.colors-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 8px;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.color-info {
  display: flex;
  flex-direction: column;
  
  .color-hex {
    font-size: 13px;
    font-family: monospace;
    text-transform: uppercase;
  }
  
  .color-percent {
    font-size: 12px;
    color: #909399;
  }
}

.similar-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.similar-item {
  cursor: pointer;
  text-align: center;
  
  img {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    object-fit: cover;
    margin-bottom: 6px;
  }
  
  span {
    font-size: 12px;
    color: #606266;
  }
}

.right-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.outline-section {
  flex: 1;
  min-height: 400px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  
  h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #303133;
    flex-shrink: 0;
  }
}

.meta-info {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 32px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  
  .meta-label {
    font-size: 13px;
    color: #909399;
  }
  
  .meta-value {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
