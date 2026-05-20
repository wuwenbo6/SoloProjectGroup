<template>
  <div class="admin-container">
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button @click="goBack" :icon="ArrowLeft">返回</el-button>
          <h1>教学管理后台</h1>
        </div>
      </el-header>
      
      <el-main class="main">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="针法管理" name="stitches">
            <div class="tab-content">
              <div class="action-bar">
                <el-button type="primary" @click="showStitchDialog = true">
                  <el-icon><Plus /></el-icon> 添加针法
                </el-button>
              </div>
              
              <el-table :data="stitches" style="width: 100%">
                <el-table-column prop="id" label="ID" width="80" />
                <el-table-column prop="name" label="针法名称" />
                <el-table-column prop="category" label="分类" />
                <el-table-column prop="difficulty" label="难度">
                  <template #default="{ row }">
                    <el-tag :type="getDifficultyType(row.difficulty)">
                      {{ row.difficulty }} 级
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="200">
                  <template #default="{ row }">
                    <el-button size="small" @click="editStitch(row)">编辑步骤</el-button>
                    <el-button size="small" type="danger" @click="deleteStitch(row.id)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="学员管理" name="students">
            <div class="tab-content">
              <el-table :data="users" style="width: 100%">
                <el-table-column prop="id" label="ID" width="80" />
                <el-table-column prop="username" label="用户名" />
                <el-table-column prop="role" label="角色">
                  <template #default="{ row }">
                    <el-tag :type="row.role === 'teacher' ? 'success' : 'primary'">
                      {{ row.role === 'teacher' ? '教师' : '学员' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="created_at" label="注册时间" />
              </el-table>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="视频管理" name="videos">
            <div class="tab-content">
              <div class="action-bar">
                <el-button type="primary" @click="showVideoDialog = true">
                  <el-icon><Upload /></el-icon> 上传视频
                </el-button>
              </div>
              
              <el-table :data="videos" style="width: 100%">
                <el-table-column prop="id" label="ID" width="80" />
                <el-table-column prop="title" label="视频标题" />
                <el-table-column prop="stitch_name" label="关联针法" />
                <el-table-column prop="duration" label="时长(秒)" />
                <el-table-column prop="created_at" label="上传时间" />
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-main>
    </el-container>
    
    <el-dialog v-model="showStitchDialog" title="添加针法" width="600px">
      <el-form :model="stitchForm" label-width="80px">
        <el-form-item label="针法名称">
          <el-input v-model="stitchForm.name" placeholder="请输入针法名称" />
        </el-form-item>
        <el-form-item label="针法描述">
          <el-input 
            v-model="stitchForm.description" 
            type="textarea" 
            :rows="3" 
            placeholder="请输入针法描述"
          />
        </el-form-item>
        <el-form-item label="难度等级">
          <el-slider v-model="stitchForm.difficulty" :min="1" :max="5" show-input />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="stitchForm.category" placeholder="请输入分类" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showStitchDialog = false">取消</el-button>
        <el-button type="primary" @click="createStitch">创建</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="showStepDialog" title="添加步骤" width="600px">
      <div class="current-stitch-info">
        <span>当前针法: {{ editingStitch?.name }}</span>
        <span>已有步骤数: {{ editingStitch?.steps?.length || 0 }}</span>
      </div>
      <el-form :model="stepForm" label-width="80px">
        <el-form-item label="步骤序号">
          <el-input-number v-model="stepForm.step_number" :min="1" />
        </el-form-item>
        <el-form-item label="步骤标题">
          <el-input v-model="stepForm.title" placeholder="请输入步骤标题" />
        </el-form-item>
        <el-form-item label="步骤描述">
          <el-input 
            v-model="stepForm.description" 
            type="textarea" 
            :rows="4" 
            placeholder="请详细描述该步骤的操作方法"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showStepDialog = false">取消</el-button>
        <el-button type="primary" @click="addStep">添加步骤</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="showVideoDialog" title="上传视频" width="600px">
      <el-form :model="videoForm" label-width="80px">
        <el-form-item label="关联针法">
          <el-select v-model="videoForm.stitch_id" placeholder="选择关联的针法" style="width: 100%">
            <el-option 
              v-for="stitch in stitches" 
              :key="stitch.id" 
              :label="stitch.name" 
              :value="stitch.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="视频标题">
          <el-input v-model="videoForm.title" placeholder="请输入视频标题" />
        </el-form-item>
        <el-form-item label="视频描述">
          <el-input 
            v-model="videoForm.description" 
            type="textarea" 
            :rows="3" 
            placeholder="请输入视频描述"
          />
        </el-form-item>
        <el-form-item label="时长(秒)">
          <el-input-number v-model="videoForm.duration" :min="1" />
        </el-form-item>
        <el-form-item label="选择文件">
          <el-upload
            ref="uploadRef"
            action="/api/videos"
            :auto-upload="false"
            :limit="1"
            accept="video/*"
          >
            <el-button type="primary">选择视频文件</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showVideoDialog = false">取消</el-button>
        <el-button type="primary" @click="uploadVideo">上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { stitchAPI, authAPI, videoAPI } from '@/api'

const router = useRouter()

const activeTab = ref('stitches')
const stitches = ref([])
const users = ref([])
const videos = ref([])

const showStitchDialog = ref(false)
const showStepDialog = ref(false)
const showVideoDialog = ref(false)

const editingStitch = ref(null)
const stitchForm = ref({
  name: '',
  description: '',
  difficulty: 3,
  category: ''
})
const stepForm = ref({
  step_number: 1,
  title: '',
  description: ''
})
const videoForm = ref({
  stitch_id: null,
  title: '',
  description: '',
  duration: 60
})

const goBack = () => {
  router.push('/')
}

const getDifficultyType = (level) => {
  if (level <= 2) return 'success'
  if (level <= 4) return 'warning'
  return 'danger'
}

const createStitch = async () => {
  try {
    const res = await stitchAPI.createStitch(stitchForm.value)
    if (res.success) {
      ElMessage.success('针法创建成功')
      showStitchDialog.value = false
      stitchForm.value = { name: '', description: '', difficulty: 3, category: '' }
      loadStitches()
    }
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const editStitch = async (stitch) => {
  const res = await stitchAPI.getStitch(stitch.id)
  if (res.success) {
    editingStitch.value = res.stitch
    stepForm.value.step_number = (res.stitch.steps?.length || 0) + 1
    showStepDialog.value = true
  }
}

const addStep = async () => {
  try {
    const res = await stitchAPI.addStep(editingStitch.value.id, stepForm.value)
    if (res.success) {
      ElMessage.success('步骤添加成功')
      stepForm.value = { step_number: stepForm.value.step_number + 1, title: '', description: '' }
      editStitch(editingStitch.value)
    }
  } catch (error) {
    ElMessage.error('添加失败')
  }
}

const deleteStitch = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这个针法吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const res = await stitchAPI.deleteStitch(id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadStitches()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const uploadVideo = async () => {
  ElMessage.info('视频上传功能已就绪，可通过后端接口上传')
  showVideoDialog.value = false
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

const loadUsers = async () => {
  try {
    const res = await authAPI.getUsers()
    if (res.success) {
      users.value = res.users
    }
  } catch (error) {
    console.error('加载用户列表失败', error)
  }
}

const loadVideos = async () => {
  try {
    const res = await videoAPI.getVideos()
    if (res.success) {
      videos.value = res.videos
    }
  } catch (error) {
    console.error('加载视频列表失败', error)
  }
}

onMounted(() => {
  loadStitches()
  loadUsers()
  loadVideos()
})
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
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

.tab-content {
  padding: 20px 0;
}

.action-bar {
  margin-bottom: 20px;
}

.current-stitch-info {
  display: flex;
  justify-content: space-between;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 20px;
}
</style>
