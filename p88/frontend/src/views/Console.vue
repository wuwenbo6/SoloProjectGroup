<template>
  <div class="console-page">
    <el-row :gutter="20">
      <el-col :span="8">
        <div class="page-container furniture-list-panel">
          <div class="card-header">
            <h3 class="card-title">家具列表</h3>
            <el-button type="primary" size="small" @click="showAddDialog">
              <el-icon><Plus /></el-icon>
              新增
            </el-button>
          </div>
          <el-table
            :data="furnitureList"
            style="width: 100%"
            @row-click="handleRowClick"
            highlight-current-row
          >
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="category" label="分类" width="100" />
            <el-table-column prop="material" label="材质" width="100" />
            <el-table-column label="操作" width="120">
              <template #default="scope">
                <el-button size="small" @click.stop="editFurniture(scope.row)">编辑</el-button>
                <el-button size="small" type="danger" @click.stop="deleteFurniture(scope.row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>

      <el-col :span="16">
        <div class="page-container">
          <el-tabs v-model="activeTab" type="card">
            <el-tab-pane label="基本信息" name="basic">
              <el-form
                ref="furnitureFormRef"
                :model="furnitureForm"
                label-width="100px"
                class="furniture-form"
              >
                <el-row :gutter="20">
                  <el-col :span="12">
                    <el-form-item label="家具名称" prop="name">
                      <el-input v-model="furnitureForm.name" placeholder="请输入家具名称" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="分类" prop="category">
                      <el-select v-model="furnitureForm.category" placeholder="请选择分类" style="width: 100%">
                        <el-option label="椅子" value="椅子" />
                        <el-option label="桌子" value="桌子" />
                        <el-option label="柜子" value="柜子" />
                        <el-option label="床" value="床" />
                        <el-option label="其他" value="其他" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-row :gutter="20">
                  <el-col :span="8">
                    <el-form-item label="宽度(cm)" prop="width">
                      <el-input-number v-model="furnitureForm.width" :min="0" style="width: 100%" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="高度(cm)" prop="height">
                      <el-input-number v-model="furnitureForm.height" :min="0" style="width: 100%" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="深度(cm)" prop="depth">
                      <el-input-number v-model="furnitureForm.depth" :min="0" style="width: 100%" />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-row :gutter="20">
                  <el-col :span="12">
                    <el-form-item label="材质" prop="material">
                      <el-input v-model="furnitureForm.material" placeholder="请输入材质" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="创作者" prop="creator">
                      <el-input v-model="furnitureForm.creator" placeholder="请输入创作者" />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-form-item label="描述" prop="description">
                  <el-input
                    v-model="furnitureForm.description"
                    type="textarea"
                    :rows="3"
                    placeholder="请输入家具描述"
                  />
                </el-form-item>
                <el-form-item label="3D模型">
                  <el-upload
                    ref="uploadRef"
                    :auto-upload="false"
                    :on-change="handleFileChange"
                    :show-file-list="true"
                    accept=".glb,.gltf,.obj,.fbx,.stl"
                  >
                    <el-button type="primary">选择模型文件</el-button>
                    <template #tip>
                      <div class="el-upload__tip">
                        支持 glb, gltf, obj, fbx, stl 格式的3D模型文件
                      </div>
                    </template>
                  </el-upload>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="saveFurniture" :loading="saving">保存</el-button>
                  <el-button @click="resetForm">重置</el-button>
                  <el-button v-if="furnitureForm.id" type="success" @click="goToViewer">查看3D效果</el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="榫卯结构" name="mortise">
              <div class="mortise-section">
                <div class="section-header">
                  <h4>榫卯结构列表</h4>
                  <el-button
                    type="primary"
                    size="small"
                    @click="showMortiseDialog"
                    :disabled="!furnitureForm.id"
                  >
                    <el-icon><Plus /></el-icon>
                    添加榫卯
                  </el-button>
                </div>
                <el-table :data="mortiseList" style="width: 100%" size="small">
                  <el-table-column prop="name" label="榫卯名称" />
                  <el-table-column prop="type" label="类型" width="100" />
                  <el-table-column label="尺寸" width="200">
                    <template #default="scope">
                      {{ scope.row.mortiseWidth }}x{{ scope.row.mortiseHeight }}x{{ scope.row.mortiseDepth }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="position" label="位置" width="120" />
                  <el-table-column label="操作" width="150">
                    <template #default="scope">
                      <el-button size="small" @click="editMortise(scope.row)">编辑</el-button>
                      <el-button size="small" type="danger" @click="deleteMortise(scope.row)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <el-empty v-if="mortiseList.length === 0" description="请先保存家具信息后添加榫卯结构" />
              </div>
            </el-tab-pane>

            <el-tab-pane label="工艺说明" name="craft">
              <div class="craft-section">
                <div class="section-header">
                  <h4>工艺说明列表</h4>
                  <el-button
                    type="primary"
                    size="small"
                    @click="showCraftDialog"
                    :disabled="!furnitureForm.id"
                  >
                    <el-icon><Plus /></el-icon>
                    添加工艺
                  </el-button>
                </div>
                <el-table :data="craftList" style="width: 100%" size="small">
                  <el-table-column prop="title" label="标题" />
                  <el-table-column prop="difficulty" label="难度" width="100">
                    <template #default="scope">
                      <el-tag v-if="scope.row.difficulty === 1" type="success">简单</el-tag>
                      <el-tag v-else-if="scope.row.difficulty === 2" type="warning">中等</el-tag>
                      <el-tag v-else type="danger">困难</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="estimatedTime" label="预计时间" width="100">
                    <template #default="scope">{{ scope.row.estimatedTime }}分钟</template>
                  </el-table-column>
                  <el-table-column prop="tools" label="所需工具" />
                  <el-table-column label="操作" width="150">
                    <template #default="scope">
                      <el-button size="small" @click="editCraft(scope.row)">编辑</el-button>
                      <el-button size="small" type="danger" @click="deleteCraft(scope.row)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <el-empty v-if="craftList.length === 0" description="请先保存家具信息后添加工艺说明" />
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-col>
    </el-row>

    <el-dialog
      v-model="mortiseDialogVisible"
      title="榫卯结构编辑"
      width="600px"
    >
      <el-form :model="mortiseForm" label-width="100px">
        <el-form-item label="榫卯名称">
          <el-input v-model="mortiseForm.name" placeholder="请输入榫卯名称" />
        </el-form-item>
        <el-form-item label="榫卯类型">
          <el-select v-model="mortiseForm.type" placeholder="请选择类型" style="width: 100%">
            <el-option label="燕尾榫" value="燕尾榫" />
            <el-option label="榫卯" value="榫卯" />
            <el-option label="粽角榫" value="粽角榫" />
            <el-option label="格肩榫" value="格肩榫" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="卯宽(cm)">
              <el-input-number v-model="mortiseForm.mortiseWidth" :min="0" :step="0.1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="卯高(cm)">
              <el-input-number v-model="mortiseForm.mortiseHeight" :min="0" :step="0.1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="卯深(cm)">
              <el-input-number v-model="mortiseForm.mortiseDepth" :min="0" :step="0.1" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="榫宽(cm)">
              <el-input-number v-model="mortiseForm.tenonWidth" :min="0" :step="0.1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="榫高(cm)">
              <el-input-number v-model="mortiseForm.tenonHeight" :min="0" :step="0.1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="榫深(cm)">
              <el-input-number v-model="mortiseForm.tenonDepth" :min="0" :step="0.1" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="位置">
          <el-input v-model="mortiseForm.position" placeholder="如：左侧、右侧、底部等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="mortiseDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMortise">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="craftDialogVisible"
      title="工艺说明编辑"
      width="700px"
    >
      <el-form :model="craftForm" label-width="100px">
        <el-form-item label="标题">
          <el-input v-model="craftForm.title" placeholder="请输入工艺标题" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="难度">
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
            :rows="5"
            placeholder="请输入详细的工艺说明"
          />
        </el-form-item>
        <el-form-item label="步骤说明">
          <el-input
            v-model="craftForm.steps"
            type="textarea"
            :rows="4"
            placeholder="请输入步骤说明，每步用换行分隔"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="craftDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCraft">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { furnitureApi, mortiseApi, craftApi } from '@/api'

const router = useRouter()
const activeTab = ref('basic')
const saving = ref(false)
const furnitureList = ref([])
const mortiseList = ref([])
const craftList = ref([])
const uploadFile = ref(null)
const mortiseDialogVisible = ref(false)
const craftDialogVisible = ref(false)

const furnitureForm = ref({
  id: null,
  name: '',
  category: '',
  description: '',
  modelPath: '',
  width: 0,
  height: 0,
  depth: 0,
  material: '',
  creator: ''
})

const mortiseForm = ref({
  id: null,
  furnitureId: null,
  name: '',
  type: '',
  mortiseWidth: 0,
  mortiseHeight: 0,
  mortiseDepth: 0,
  tenonWidth: 0,
  tenonHeight: 0,
  tenonDepth: 0,
  position: ''
})

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
  try {
    const res = await furnitureApi.list()
    furnitureList.value = res.data || []
  } catch (error) {
    console.error('加载家具列表失败:', error)
  }
}

const handleRowClick = (row) => {
  furnitureForm.value = { ...row }
  loadMortiseList(row.id)
  loadCraftList(row.id)
}

const loadMortiseList = async (furnitureId) => {
  try {
    const res = await mortiseApi.getByFurnitureId(furnitureId)
    mortiseList.value = res.data || []
  } catch (error) {
    console.error('加载榫卯列表失败:', error)
  }
}

const loadCraftList = async (furnitureId) => {
  try {
    const res = await craftApi.getByFurnitureId(furnitureId)
    craftList.value = res.data || []
  } catch (error) {
    console.error('加载工艺列表失败:', error)
  }
}

const showAddDialog = () => {
  resetForm()
}

const editFurniture = (row) => {
  furnitureForm.value = { ...row }
  loadMortiseList(row.id)
  loadCraftList(row.id)
}

const deleteFurniture = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该家具吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await furnitureApi.delete(row.id)
    ElMessage.success('删除成功')
    loadFurnitureList()
    if (furnitureForm.value.id === row.id) {
      resetForm()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

const handleFileChange = (file) => {
  uploadFile.value = file.raw
}

const saveFurniture = async () => {
  if (!furnitureForm.value.name) {
    ElMessage.warning('请输入家具名称')
    return
  }

  saving.value = true
  try {
    if (uploadFile.value) {
      const uploadRes = await furnitureApi.upload(uploadFile.value)
      furnitureForm.value.modelPath = uploadRes.data
    }

    if (furnitureForm.value.id) {
      await furnitureApi.update(furnitureForm.value)
      ElMessage.success('更新成功')
    } else {
      const res = await furnitureApi.save(furnitureForm.value)
      furnitureForm.value.id = res.data
      ElMessage.success('保存成功')
    }

    loadFurnitureList()
    uploadFile.value = null
  } catch (error) {
    console.error('保存失败:', error)
  } finally {
    saving.value = false
  }
}

const resetForm = () => {
  furnitureForm.value = {
    id: null,
    name: '',
    category: '',
    description: '',
    modelPath: '',
    width: 0,
    height: 0,
    depth: 0,
    material: '',
    creator: ''
  }
  mortiseList.value = []
  craftList.value = []
  uploadFile.value = null
}

const goToViewer = () => {
  if (furnitureForm.value.id) {
    router.push(`/viewer/${furnitureForm.value.id}`)
  }
}

const showMortiseDialog = () => {
  mortiseForm.value = {
    id: null,
    furnitureId: furnitureForm.value.id,
    name: '',
    type: '',
    mortiseWidth: 0,
    mortiseHeight: 0,
    mortiseDepth: 0,
    tenonWidth: 0,
    tenonHeight: 0,
    tenonDepth: 0,
    position: ''
  }
  mortiseDialogVisible.value = true
}

const editMortise = (row) => {
  mortiseForm.value = { ...row }
  mortiseDialogVisible.value = true
}

const saveMortise = async () => {
  if (!mortiseForm.value.name) {
    ElMessage.warning('请输入榫卯名称')
    return
  }

  try {
    if (mortiseForm.value.id) {
      await mortiseApi.update(mortiseForm.value)
      ElMessage.success('更新成功')
    } else {
      mortiseForm.value.furnitureId = furnitureForm.value.id
      await mortiseApi.save(mortiseForm.value)
      ElMessage.success('保存成功')
    }
    mortiseDialogVisible.value = false
    loadMortiseList(furnitureForm.value.id)
  } catch (error) {
    console.error('保存榫卯失败:', error)
  }
}

const deleteMortise = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该榫卯结构吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await mortiseApi.delete(row.id)
    ElMessage.success('删除成功')
    loadMortiseList(furnitureForm.value.id)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

const showCraftDialog = () => {
  craftForm.value = {
    id: null,
    furnitureId: furnitureForm.value.id,
    title: '',
    content: '',
    steps: '',
    difficulty: 1,
    estimatedTime: 0,
    tools: '',
    materials: ''
  }
  craftDialogVisible.value = true
}

const editCraft = (row) => {
  craftForm.value = { ...row }
  craftDialogVisible.value = true
}

const saveCraft = async () => {
  if (!craftForm.value.title) {
    ElMessage.warning('请输入工艺标题')
    return
  }

  try {
    if (craftForm.value.id) {
      await craftApi.update(craftForm.value)
      ElMessage.success('更新成功')
    } else {
      craftForm.value.furnitureId = furnitureForm.value.id
      await craftApi.save(craftForm.value)
      ElMessage.success('保存成功')
    }
    craftDialogVisible.value = false
    loadCraftList(furnitureForm.value.id)
  } catch (error) {
    console.error('保存工艺失败:', error)
  }
}

const deleteCraft = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该工艺说明吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await craftApi.delete(row.id)
    ElMessage.success('删除成功')
    loadCraftList(furnitureForm.value.id)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}
</script>

<style scoped>
.console-page {
  height: 100%;
}

.furniture-list-panel {
  height: calc(100vh - 140px);
  overflow-y: auto;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.section-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.furniture-form {
  padding: 20px 0;
}

.mortise-section,
.craft-section {
  padding: 20px 0;
}
</style>
