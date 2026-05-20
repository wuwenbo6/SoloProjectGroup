<template>
  <div class="craft-edit-page">
    <div class="page-header">
      <el-button @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2 class="page-title">{{ isEdit ? '编辑工艺' : '新增工艺' }}</h2>
    </div>

    <el-card>
      <el-form :model="craftForm" label-width="100px" :rules="rules" ref="formRef">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="工艺标题" prop="title">
              <el-input v-model="craftForm.title" placeholder="请输入工艺标题" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工艺分类" prop="category">
              <el-select v-model="craftForm.category" placeholder="请选择分类" style="width: 100%">
                <el-option label="雕刻" value="雕刻" />
                <el-option label="染色" value="染色" />
                <el-option label="装订" value="装订" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="难度等级" prop="difficultyLevel">
              <el-select v-model="craftForm.difficultyLevel" placeholder="请选择难度" style="width: 100%">
                <el-option label="简单" :value="1" />
                <el-option label="中等" :value="2" />
                <el-option label="困难" :value="3" />
                <el-option label="专家" :value="4" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="制作时长">
              <el-input v-model="craftForm.duration" placeholder="如：2小时" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态">
              <el-radio-group v-model="craftForm.status">
                <el-radio :label="0">草稿</el-radio>
                <el-radio :label="1">发布</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="所需材料">
          <el-input v-model="craftForm.materials" type="textarea" :rows="2" placeholder="请输入所需材料" />
        </el-form-item>

        <el-form-item label="所需工具">
          <el-input v-model="craftForm.tools" type="textarea" :rows="2" placeholder="请输入所需工具" />
        </el-form-item>

        <el-form-item label="工艺说明" prop="content">
          <el-input
            v-model="craftForm.content"
            type="textarea"
            :rows="8"
            placeholder="请输入详细工艺说明"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="submitForm" :loading="loading">保存</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { craftApi } from '../api'

const route = useRoute()
const router = useRouter()
const formRef = ref(null)
const loading = ref(false)
const isEdit = ref(false)
const currentUser = ref(null)

const craftForm = reactive({
  title: '',
  category: '',
  content: '',
  materials: '',
  tools: '',
  difficultyLevel: 1,
  duration: '',
  authorId: null,
  status: 0
})

const rules = {
  title: [{ required: true, message: '请输入工艺标题', trigger: 'blur' }],
  category: [{ required: true, message: '请选择工艺分类', trigger: 'change' }],
  content: [{ required: true, message: '请输入工艺说明', trigger: 'blur' }]
}

onMounted(() => {
  const userData = localStorage.getItem('user')
  if (userData) {
    currentUser.value = JSON.parse(userData)
    craftForm.authorId = currentUser.value.id
  }
  
  if (route.params.id && route.params.id !== 'new') {
    isEdit.value = true
    loadCraft(route.params.id)
  }
})

const loadCraft = async (id) => {
  try {
    const res = await craftApi.get(id)
    Object.assign(craftForm, res.data)
  } catch (error) {
    console.error('加载工艺详情失败:', error)
  }
}

const submitForm = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        if (isEdit.value) {
          await craftApi.update(craftForm.id, craftForm)
          ElMessage.success('更新成功')
        } else {
          await craftApi.create(craftForm)
          ElMessage.success('创建成功')
        }
        router.push('/crafts')
      } catch (error) {
        console.error('保存失败:', error)
      } finally {
        loading.value = false
      }
    }
  })
}

const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
}
</script>

<style scoped>
.craft-edit-page {
  padding: 0;
}
.page-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}
.page-title {
  margin: 0;
  font-size: 24px;
  color: #333;
}
</style>
