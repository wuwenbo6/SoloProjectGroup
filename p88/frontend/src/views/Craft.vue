<template>
  <div class="craft-page">
    <el-row :gutter="20">
      <el-col :span="6">
        <div class="page-container furniture-list-panel">
          <div class="card-header">
            <h3 class="card-title">家具列表</h3>
          </div>
          <el-table
            :data="furnitureList"
            style="width: 100%"
            @row-click="handleSelectFurniture"
            highlight-current-row
            size="small"
            v-loading="loadingFurniture"
          >
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="category" label="分类" width="80" />
          </el-table>
        </div>
      </el-col>

      <el-col :span="18">
        <div class="page-container">
          <div v-if="!currentFurniture" class="empty-state">
            <el-empty description="请从左侧选择一个家具查看工艺说明" />
          </div>

          <div v-else>
            <div class="craft-header">
              <h3 class="card-title">{{ currentFurniture.name }} - 工艺说明</h3>
              <div class="header-actions">
                <span class="craft-count">共 {{ total }} 条</span>
                <el-button type="primary" size="small" @click="showAddDialog">
                  <el-icon><Plus /></el-icon>
                  添加工艺
                </el-button>
              </div>
            </div>

            <div v-if="loadingCraft" class="skeleton-container">
              <el-skeleton :rows="5" animated />
            </div>

            <div v-else-if="craftList.length === 0" class="empty-craft">
              <el-empty description="暂无工艺说明，点击右上角按钮添加" />
            </div>

            <div v-else class="craft-list-container" v-infinite-scroll="loadMore" :infinite-scroll-disabled="loading || hasNoMore">
              <el-timeline>
                <el-timeline-item
                  v-for="(item, index) in craftList"
                  :key="item.id"
                  :timestamp="`难度: ${getDifficultyText(item.difficulty)}`"
                  :type="getDifficultyType(item.difficulty)"
                  placement="top"
                >
                  <el-card shadow="hover" class="craft-card" :body-style="{ padding: '15px' }">
                    <template #header>
                      <div class="craft-card-header">
                        <span class="craft-title">{{ item.title }}</span>
                        <div class="craft-actions">
                          <el-button size="small" @click="editCraft(item)">编辑</el-button>
                          <el-button size="small" type="danger" @click="deleteCraft(item)">删除</el-button>
                        </div>
                      </div>
                    </template>

                    <el-row :gutter="20">
                      <el-col :span="12">
                        <div class="craft-info">
                          <p><strong>预计时间：</strong>{{ item.estimatedTime }} 分钟</p>
                          <p><strong>所需工具：</strong>{{ item.tools || '无' }}</p>
                          <p><strong>所需材料：</strong>{{ item.materials || '无' }}</p>
                        </div>
                      </el-col>
                      <el-col :span="12">
                        <div class="craft-steps">
                          <h5>步骤说明：</h5>
                          <ol>
                            <li v-for="(step, idx) in parseSteps(item.steps)" :key="idx">
                              {{ step }}
                            </li>
                          </ol>
                        </div>
                      </el-col>
                    </el-row>

                    <div v-if="item.content" class="craft-content">
                      <h5>详细说明：</h5>
                      <p>{{ item.content }}</p>
                    </div>
                  </el-card>
                </el-timeline-item>
              </el-timeline>

              <div v-if="hasNoMore && craftList.length > 0" class="no-more-text">
                没有更多了
              </div>
              <div v-if="loadingMore" class="loading-more">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>加载中...</span>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-dialog
      v-model="dialogVisible"
      :title="editingCraft ? '编辑工艺说明' : '添加工艺说明'"
      width="700px"
    >
      <el-form :model="craftForm" label-width="100px">
        <el-form-item label="工艺标题">
          <el-input v-model="craftForm.title" placeholder="请输入工艺标题" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="难度等级">
              <el-radio-group v-model="craftForm.difficulty">
                <el-radio :label="1">简单</el-radio>
                <el-radio :label="2">中等</el-radio>
                <el-radio :label="3">困难</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="预计时间(分钟)">
              <el-input-number v-model="craftForm.estimatedTime" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="所需工具">
          <el-input v-model="craftForm.tools" placeholder="请输入所需工具，用逗号分隔" />
        </el-form-item>
        <el-form-item label="所需材料">
          <el-input v-model="craftForm.materials" placeholder="请输入所需材料，用逗号分隔" />
        </el-form-item>
        <el-form-item label="详细说明">
          <el-input
            v-model="craftForm.content"
            type="textarea"
            :rows="4"
            placeholder="请输入详细的工艺说明"
          />
        </el-form-item>
        <el-form-item label="步骤说明">
          <el-input
            v-model="craftForm.steps"
            type="textarea"
            :rows="5"
            placeholder="请输入步骤说明，每步用换行分隔"
          />
          <div class="step-hint">提示：每行输入一个步骤，系统会自动编号</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCraft" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { Plus, Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { furnitureApi, craftApi } from '@/api'

const furnitureList = ref([])
const currentFurniture = ref(null)
const craftList = ref([])
const dialogVisible = ref(false)
const editingCraft = ref(null)
const loadingFurniture = ref(false)
const loadingCraft = ref(false)
const loadingMore = ref(false)
const saving = ref(false)
const currentPage = ref(1)
const pageSize = 10
const total = ref(0)
const hasNoMore = ref(false)

const craftForm = ref({
  id: null,
  furnitureId: null,
  title: '',
  content: '',
  steps: '',
  difficulty: 1,
  estimatedTime: 0,
  tools: '',
  materials: ''
})

onMounted(() => {
  loadFurnitureList()
})

const loadFurnitureList = async () => {
  loadingFurniture.value = true
  try {
    const res = await furnitureApi.list()
    furnitureList.value = res.data || []
  } catch (error) {
    console.error('加载家具列表失败:', error)
  } finally {
    loadingFurniture.value = false
  }
}

const handleSelectFurniture = async (furniture) => {
  currentFurniture.value = furniture
  craftList.value = []
  currentPage.value = 1
  hasNoMore.value = false
  await loadCraftList(furniture.id, true)
}

const loadCraftList = async (furnitureId, reset = false) => {
  if (loadingMore.value) return

  loadingMore.value = true
  if (reset) {
    loadingCraft.value = true
  }

  try {
    const res = await craftApi.getByFurnitureIdPage(furnitureId, reset ? 1 : currentPage.value, pageSize)
    const newData = res.data?.records || []

    if (reset) {
      craftList.value = newData
    } else {
      craftList.value = [...craftList.value, ...newData]
    }

    total.value = res.data?.total || 0
    hasNoMore.value = craftList.value.length >= total.value
  } catch (error) {
    console.error('加载工艺列表失败:', error)
  } finally {
    loadingCraft.value = false
    loadingMore.value = false
  }
}

const loadMore = async () => {
  if (!currentFurniture.value || hasNoMore.value || loadingMore.value) return
  currentPage.value++
  await loadCraftList(currentFurniture.value.id, false)
}

const showAddDialog = () => {
  editingCraft.value = null
  craftForm.value = {
    id: null,
    furnitureId: currentFurniture.value.id,
    title: '',
    content: '',
    steps: '',
    difficulty: 1,
    estimatedTime: 0,
    tools: '',
    materials: ''
  }
  dialogVisible.value = true
}

const editCraft = (item) => {
  editingCraft.value = item
  craftForm.value = { ...item }
  dialogVisible.value = true
}

const saveCraft = async () => {
  if (!craftForm.value.title) {
    ElMessage.warning('请输入工艺标题')
    return
  }

  saving.value = true
  try {
    if (craftForm.value.id) {
      await craftApi.update(craftForm.value)
      ElMessage.success('更新成功')
      const index = craftList.value.findIndex(item => item.id === craftForm.value.id)
      if (index !== -1) {
        craftList.value[index] = { ...craftList.value[index], ...craftForm.value }
      }
    } else {
      craftForm.value.furnitureId = currentFurniture.value.id
      await craftApi.save(craftForm.value)
      ElMessage.success('保存成功')
      await loadCraftList(currentFurniture.value.id, true)
    }
    dialogVisible.value = false
  } catch (error) {
    console.error('保存工艺失败:', error)
  } finally {
    saving.value = false
  }
}

const deleteCraft = async (item) => {
  try {
    await ElMessageBox.confirm('确定要删除该工艺说明吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await craftApi.delete(item.id)
    ElMessage.success('删除成功')
    craftList.value = craftList.value.filter(c => c.id !== item.id)
    total.value--
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

const parseSteps = (steps) => {
  if (!steps) return []
  return steps.split('\n').filter(s => s.trim())
}

const getDifficultyText = (difficulty) => {
  const map = { 1: '简单', 2: '中等', 3: '困难' }
  return map[difficulty] || '未知'
}

const getDifficultyType = (difficulty) => {
  const map = { 1: 'success', 2: 'warning', 3: 'danger' }
  return map[difficulty] || 'info'
}
</script>

<style scoped>
.craft-page {
  height: 100%;
}

.furniture-list-panel {
  height: calc(100vh - 140px);
  overflow-y: auto;
}

.empty-state,
.empty-craft {
  padding: 60px 0;
}

.craft-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.craft-count {
  color: #909399;
  font-size: 14px;
}

.skeleton-container {
  padding: 20px 0;
}

.craft-list-container {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  padding-right: 10px;
}

.craft-card {
  margin-bottom: 10px;
}

.craft-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.craft-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.craft-info p {
  margin: 8px 0;
  font-size: 14px;
  color: #606266;
}

.craft-steps h5,
.craft-content h5 {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.craft-steps ol {
  margin: 0;
  padding-left: 20px;
}

.craft-steps li {
  margin: 5px 0;
  font-size: 14px;
  color: #606266;
}

.craft-content p {
  margin: 0;
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
}

.step-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.no-more-text,
.loading-more {
  text-align: center;
  padding: 20px 0;
  color: #909399;
  font-size: 14px;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
