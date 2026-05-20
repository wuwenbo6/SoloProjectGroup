<template>
  <div class="annotation-panel">
    <el-card class="form-card">
      <template #header>
        <span>添加标注</span>
      </template>
      
      <el-form :model="annotationForm" size="small" label-width="80px">
        <el-form-item label="类型">
          <el-select v-model="annotationForm.annotationType" placeholder="选择类型">
            <el-option label="层位" value="horizon" />
            <el-option label="断层" value="fault" />
            <el-option label="异常" value="anomaly" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="标签">
          <el-input v-model="annotationForm.label" placeholder="标注名称" />
        </el-form-item>
        
        <el-form-item label="范围">
          <div class="range-inputs">
            <el-input-number
              v-model="annotationForm.inlineStart"
              placeholder="起始"
              size="small"
              style="width: 100%"
            />
            <span>~</span>
            <el-input-number
              v-model="annotationForm.inlineEnd"
              placeholder="结束"
              size="small"
              style="width: 100%"
            />
          </div>
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input
            v-model="annotationForm.description"
            type="textarea"
            :rows="2"
            placeholder="描述信息"
          />
        </el-form-item>
      </el-form>
      
      <el-button
        type="primary"
        size="small"
        @click="addAnnotation"
        :disabled="!store.currentFile"
        style="width: 100%; margin-top: 10px"
      >
        添加标注
      </el-button>
    </el-card>

    <el-divider>标注列表</el-divider>

    <div class="annotation-list">
      <el-empty v-if="!store.annotations.length" description="暂无标注" />
      
      <el-card
        v-for="ann in store.annotations"
        :key="ann.id"
        class="annotation-item"
        shadow="hover"
      >
        <div class="annotation-header">
          <el-tag :type="getTagType(ann.annotationType)" size="small">
            {{ getTypeLabel(ann.annotationType) }}
          </el-tag>
          <el-button
            type="danger"
            size="small"
            icon="Delete"
            circle
            @click="deleteAnnotation(ann.id)"
          />
        </div>
        <div class="annotation-label">{{ ann.label }}</div>
        <div v-if="ann.description" class="annotation-description">
          {{ ann.description }}
        </div>
        <div class="annotation-range">
          <span>Inline: {{ ann.inlineStart }} ~ {{ ann.inlineEnd }}</span>
        </div>
        <div class="annotation-time">
          {{ formatDate(ann.createdAt) }}
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { useSeismicStore } from '../stores/seismic'
import { ElMessage } from 'element-plus'

const store = useSeismicStore()

const annotationForm = reactive({
  annotationType: 'horizon',
  label: '',
  inlineStart: null,
  inlineEnd: null,
  crosslineStart: null,
  crosslineEnd: null,
  timeStart: null,
  timeEnd: null,
  description: ''
})

const addAnnotation = async () => {
  if (!annotationForm.label) {
    ElMessage.warning('请输入标签')
    return
  }
  
  try {
    await store.createAnnotation({
      ...annotationForm,
      segy_file_id: store.currentFile.id
    })
    ElMessage.success('标注添加成功')
    annotationForm.label = ''
    annotationForm.description = ''
  } catch (error) {
    ElMessage.error('添加标注失败')
  }
}

const deleteAnnotation = async (id) => {
  try {
    await store.deleteAnnotation(id)
    ElMessage.success('删除成功')
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

const getTagType = (type) => {
  const types = {
    horizon: 'success',
    fault: 'danger',
    anomaly: 'warning',
    other: 'info'
  }
  return types[type] || 'info'
}

const getTypeLabel = (type) => {
  const labels = {
    horizon: '层位',
    fault: '断层',
    anomaly: '异常',
    other: '其他'
  }
  return labels[type] || type
}

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}
</script>

<style scoped>
.annotation-panel {
  padding: 10px;
  height: 100%;
  overflow-y: auto;
}

.form-card {
  margin-bottom: 10px;
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-inputs span {
  color: #909399;
}

.annotation-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.annotation-item {
  padding: 10px;
}

.annotation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.annotation-label {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 5px;
}

.annotation-description {
  font-size: 12px;
  color: #606266;
  margin-bottom: 5px;
}

.annotation-range {
  font-size: 11px;
  color: #909399;
  margin-bottom: 5px;
}

.annotation-time {
  font-size: 10px;
  color: #c0c4cc;
  text-align: right;
}
</style>
