<template>
  <div class="synthesis-page">
    <el-card class="main-card">
      <template #header>
        <div class="card-header">
          <span>方言语音合成</span>
          <el-tag type="success">Transformer模型</el-tag>
        </div>
      </template>

      <el-form :model="form" label-width="100px">
        <el-form-item label="选择方言">
          <el-select v-model="form.dialect_id" placeholder="请选择方言" style="width: 100%">
            <el-option
              v-for="dialect in dialects"
              :key="dialect.id"
              :label="dialect.name"
              :value="dialect.id"
            >
              <span>{{ dialect.name }}</span>
              <span style="color: #8492a6; font-size: 13px; margin-left: 8px">
                {{ dialect.branch }} - {{ dialect.region }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="输入文本">
          <el-input
            v-model="form.text"
            type="textarea"
            :rows="4"
            placeholder="请输入需要合成的文本..."
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-divider content-position="left">参数调节</el-divider>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="情感">
              <el-select v-model="form.emotion" style="width: 100%">
                <el-option label="中性" value="neutral" />
                <el-option label="开心" value="happy" />
                <el-option label="悲伤" value="sad" />
                <el-option label="生气" value="angry" />
                <el-option label="惊讶" value="surprise" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="语速">
              <el-slider
                v-model="form.speed"
                :min="0.5"
                :max="2"
                :step="0.1"
                show-input
                :marks="{ 0.5: '0.5x', 1: '1x', 1.5: '1.5x', 2: '2x' }"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="音调">
              <el-slider
                v-model="form.pitch"
                :min="0.5"
                :max="2"
                :step="0.1"
                show-input
                :marks="{ 0.5: '低', 1: '中', 1.5: '较高', 2: '高' }"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item>
          <el-button
            type="primary"
            :icon="VideoPlay"
            @click="handleSynthesize"
            :loading="synthesizing"
          >
            开始合成
          </el-button>
          <el-button :icon="Refresh" @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="result" class="result-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>合成结果</span>
          <el-tag :type="result.status === 'completed' ? 'success' : 'warning'">
            {{ result.status === 'completed' ? '已完成' : '处理中' }}
          </el-tag>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="任务ID">{{ result.task_id }}</el-descriptions-item>
        <el-descriptions-item label="方言">{{ getDialectName(result.dialect_id) }}</el-descriptions-item>
        <el-descriptions-item label="情感">{{ getEmotionLabel(result.emotion) }}</el-descriptions-item>
        <el-descriptions-item label="时长">{{ result.duration?.toFixed(2) }}s</el-descriptions-item>
        <el-descriptions-item label="文本" :span="2">{{ result.text }}</el-descriptions-item>
      </el-descriptions>

      <div class="audio-preview" v-if="result.status === 'completed'">
        <h4>音频预览</h4>
        <audio controls style="width: 100%; margin-top: 10px">
          <source :src="getAudioUrl(result.output_audio_path)" type="audio/wav" />
          您的浏览器不支持音频播放
        </audio>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoPlay, Refresh } from '@element-plus/icons-vue'
import { synthesisApi, knowledgeApi } from '@/utils/api'

const form = ref({
  dialect_id: 1,
  text: '',
  emotion: 'neutral',
  speed: 1.0,
  pitch: 1.0
})

const dialects = ref([])
const synthesizing = ref(false)
const result = ref(null)

const loadDialects = async () => {
  try {
    const response = await knowledgeApi.getDialects()
    dialects.value = response.data.dialects || []
    
    if (dialects.value.length === 0) {
      await knowledgeApi.initSampleData()
      const res = await knowledgeApi.getDialects()
      dialects.value = res.data.dialects || []
    }
  } catch (error) {
    ElMessage.error('加载方言列表失败')
  }
}

const handleSynthesize = async () => {
  if (!form.value.dialect_id || !form.value.text) {
    ElMessage.warning('请选择方言并输入文本')
    return
  }

  synthesizing.value = true
  try {
    const createRes = await synthesisApi.createTask(form.value)
    const taskId = createRes.data.task_id

    const executeRes = await synthesisApi.executeTask(taskId)
    result.value = executeRes.data

    if (executeRes.data.success) {
      ElMessage.success('语音合成成功！')
    }
  } catch (error) {
    ElMessage.error('合成失败: ' + (error.response?.data?.detail || error.message))
  } finally {
    synthesizing.value = false
  }
}

const resetForm = () => {
  form.value = {
    dialect_id: 1,
    text: '',
    emotion: 'neutral',
    speed: 1.0,
    pitch: 1.0
  }
  result.value = null
}

const getDialectName = (id) => {
  const dialect = dialects.value.find(d => d.id === id)
  return dialect?.name || '未知'
}

const getEmotionLabel = (emotion) => {
  const map = {
    neutral: '中性',
    happy: '开心',
    sad: '悲伤',
    angry: '生气',
    surprise: '惊讶'
  }
  return map[emotion] || emotion
}

const getAudioUrl = (path) => {
  return path ? `/api/audio/${encodeURIComponent(path)}` : ''
}

onMounted(() => {
  loadDialects()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.audio-preview {
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

.audio-preview h4 {
  margin: 0 0 10px;
  color: #333;
}
</style>
