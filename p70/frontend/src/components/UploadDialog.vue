<template>
  <el-dialog
    v-model="dialogVisible"
    title="上传脸谱纹样"
    width="600px"
    @close="handleClose"
  >
    <el-form :model="form" label-width="80px">
      <el-form-item label="纹样名称">
        <el-input v-model="form.name" placeholder="请输入纹样名称" />
      </el-form-item>
      
      <el-form-item label="图片">
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :show-file-list="false"
          accept="image/*"
          @change="handleFileChange"
        >
          <div v-if="!imagePreview" class="upload-placeholder">
            <el-icon size="48"><Plus /></el-icon>
            <p>点击上传图片</p>
          </div>
          <img v-else :src="imagePreview" class="preview-image" />
        </el-upload>
      </el-form-item>
      
      <el-form-item label="分类">
        <el-select v-model="form.category" placeholder="请选择分类">
          <el-option label="生角" value="生角" />
          <el-option label="旦角" value="旦角" />
          <el-option label="净角" value="净角" />
          <el-option label="末角" value="末角" />
          <el-option label="丑角" value="丑角" />
          <el-option label="未分类" value="未分类" />
        </el-select>
      </el-form-item>
      
      <el-form-item label="标签">
        <el-input 
          v-model="form.tags" 
          placeholder="多个标签用逗号分隔"
        />
      </el-form-item>
      
      <el-form-item label="描述">
        <el-input 
          v-model="form.description" 
          type="textarea" 
          :rows="3"
          placeholder="请输入描述信息"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        上传
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { usePatternStore } from '../stores/pattern'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'success'])

const patternStore = usePatternStore()
const loading = ref(false)
const imagePreview = ref('')
const selectedFile = ref(null)

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const form = ref({
  name: '',
  description: '',
  category: '未分类',
  tags: ''
})

const handleFileChange = (file) => {
  selectedFile.value = file.raw
  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreview.value = e.target.result
  }
  reader.readAsDataURL(file.raw)
}

const handleSubmit = async () => {
  if (!form.value.name) {
    ElMessage.warning('请输入纹样名称')
    return
  }
  if (!selectedFile.value) {
    ElMessage.warning('请上传图片')
    return
  }

  loading.value = true
  try {
    const formData = new FormData()
    formData.append('name', form.value.name)
    formData.append('description', form.value.description)
    formData.append('category', form.value.category)
    formData.append('tags', form.value.tags)
    formData.append('image', selectedFile.value)

    await patternStore.createPattern(formData)
    ElMessage.success('上传成功')
    emit('success')
    handleClose()
  } catch (err) {
    ElMessage.error('上传失败')
  } finally {
    loading.value = false
  }
}

const handleClose = () => {
  form.value = {
    name: '',
    description: '',
    category: '未分类',
    tags: ''
  }
  imagePreview.value = ''
  selectedFile.value = null
  dialogVisible.value = false
}
</script>

<style scoped>
.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 300px;
  height: 200px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  color: #909399;
  transition: all 0.3s;
}

.upload-placeholder:hover {
  border-color: #409eff;
  color: #409eff;
}

.upload-placeholder p {
  margin-top: 8px;
  font-size: 14px;
}

.preview-image {
  max-width: 300px;
  max-height: 200px;
  border-radius: 8px;
  cursor: pointer;
}
</style>
