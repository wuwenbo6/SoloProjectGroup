<template>
  <div class="audio-collection-page">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>音频采集</span>
              <el-tag v-if="isRecording" type="danger" :icon="Microphone">录制中</el-tag>
            </div>
          </template>

          <el-form :model="form" label-width="100px">
            <el-form-item label="选择方言" required>
              <el-select v-model="form.dialect_id" placeholder="请选择方言" style="width: 100%">
                <el-option
                  v-for="dialect in dialects"
                  :key="dialect.id"
                  :label="dialect.name"
                  :value="dialect.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="对应文本" required>
              <el-input
                v-model="form.text"
                type="textarea"
                :rows="3"
                placeholder="请输入音频对应的文本内容..."
              />
            </el-form-item>

            <el-form-item label="说话人ID">
              <el-input v-model="form.speaker_id" placeholder="可选，用于区分不同说话人" />
            </el-form-item>

            <el-divider content-position="left">录音控制</el-divider>
            
            <el-form-item label="录音参数">
              <el-select v-model="recordingConfig.sampleRate" placeholder="采样率">
                <el-option label="8000 Hz" :value="8000" />
                <el-option label="16000 Hz" :value="16000" />
                <el-option label="22050 Hz" :value="22050" />
                <el-option label="44100 Hz" :value="44100" />
                <el-option label="48000 Hz" :value="48000" />
              </el-select>
            </el-form-item>

            <el-form-item>
              <el-button
                v-if="!isRecording"
                type="primary"
                :icon="Microphone"
                @click="startRecording"
                :disabled="!hasMicPermission"
              >
                开始录音
              </el-button>
              <el-button
                v-else
                type="danger"
                :icon="VideoPauseFilled"
                @click="stopRecording"
              >
                停止录音
              </el-button>
              <el-button :icon="Refresh" @click="initMicrophone">初始化麦克风</el-button>
            </el-form-item>

            <el-form-item v-if="recordingDuration > 0">
              <el-progress
                :percentage="Math.min(100, recordingDuration / 300 * 100)"
                :format="() => formatDuration(recordingDuration)"
              />
            </el-form-item>
          </el-form>

          <el-divider content-position="left">文件上传</el-divider>
          
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept="audio/*"
            :on-change="handleFileChange"
          >
            <el-button type="primary" :icon="Upload">选择音频文件</el-button>
            <template #tip>
              <div class="el-upload__tip">
                支持 WAV、MP3 等音频格式，建议采样率 22050Hz 以上
              </div>
            </template>
          </el-upload>

          <div v-if="audioFile || recordedBlob" class="audio-preview-section">
            <h4>音频预览</h4>
            <audio controls style="width: 100%" ref="audioPreviewRef">
              <source :src="audioUrl" />
            </audio>
            
            <el-alert
              v-if="qualityInfo"
              :title="'质量评分: ' + qualityInfo.quality_score + '/100'"
              :type="qualityInfo.quality_score >= 80 ? 'success' : qualityInfo.quality_score >= 60 ? 'warning' : 'error'"
              style="margin-top: 10px"
            >
              <div v-if="qualityInfo.issues && qualityInfo.issues.length > 0">
                <p v-for="(issue, idx) in qualityInfo.issues" :key="idx" class="issue-text">{{ issue }}</p>
              </div>
            </el-alert>

            <el-form-item style="margin-top: 15px">
              <el-button
                type="success"
                :icon="Check"
                @click="handleUpload"
                :loading="uploading"
              >
                保存音频
              </el-button>
            </el-form-item>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>语料列表</span>
              <el-button size="small" :icon="Refresh" @click="loadCorpora">刷新</el-button>
            </div>
          </template>

          <el-table :data="corpora" stripe style="width: 100%" v-loading="loading">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="dialect_id" label="方言ID" width="80" />
            <el-table-column prop="text" label="文本内容" show-overflow-tooltip />
            <el-table-column prop="speaker_id" label="说话人" width="100" />
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button
                  size="small"
                  type="primary"
                  @click="extractFeatures(row.id)"
                >
                  提取特征
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Upload, Check, Refresh, Microphone, VideoPauseFilled
} from '@element-plus/icons-vue'
import { audioApi, knowledgeApi } from '@/utils/api'

const form = ref({
  dialect_id: '',
  text: '',
  speaker_id: ''
})

const dialects = ref([])
const corpora = ref([])
const audioFile = ref(null)
const recordedBlob = ref(null)
const audioUrl = ref('')
const uploading = ref(false)
const loading = ref(false)
const qualityInfo = ref(null)

const isRecording = ref(false)
const hasMicPermission = ref(false)
const mediaRecorder = ref(null)
const audioChunks = ref([])
const recordingStartTime = ref(0)
const recordingDuration = ref(0)
const recordingTimer = ref(null)

const recordingConfig = ref({
  sampleRate: 22050
})

const audioPreviewRef = ref(null)
const uploadRef = ref(null)

const initMicrophone = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: recordingConfig.value.sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    
    hasMicPermission.value = true
    stream.getTracks().forEach(track => track.stop())
    
    ElMessage.success('麦克风初始化成功')
  } catch (error) {
    ElMessage.error('无法访问麦克风: ' + error.message)
    hasMicPermission.value = false
  }
}

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: recordingConfig.value.sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    mediaRecorder.value = new MediaRecorder(stream, {
      mimeType: 'audio/webm'
    })

    audioChunks.value = []
    
    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }

    mediaRecorder.value.onstop = () => {
      recordedBlob.value = new Blob(audioChunks.value, { type: 'audio/wav' })
      audioUrl.value = URL.createObjectURL(recordedBlob.value)
      audioFile.value = new File([recordedBlob.value], `recording_${Date.now()}.wav`, { type: 'audio/wav' })
      
      stream.getTracks().forEach(track => track.stop())
      
      ElMessage.success(`录音完成，时长: ${formatDuration(recordingDuration.value)}`)
    }

    mediaRecorder.value.start(100)
    isRecording.value = true
    recordingStartTime.value = Date.now()
    
    recordingTimer.value = setInterval(() => {
      recordingDuration.value = (Date.now() - recordingStartTime.value) / 1000
      
      if (recordingDuration.value >= 300) {
        stopRecording()
        ElMessage.warning('录音已达到最大时长5分钟')
      }
    }, 1000)
    
  } catch (error) {
    ElMessage.error('录音失败: ' + error.message)
  }
}

const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false
    
    if (recordingTimer.value) {
      clearInterval(recordingTimer.value)
      recordingTimer.value = null
    }
  }
}

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handleFileChange = (file) => {
  audioFile.value = file.raw
  recordedBlob.value = null
  audioUrl.value = URL.createObjectURL(file.raw)
  qualityInfo.value = null
}

const handleUpload = async () => {
  if (!form.value.dialect_id || !form.value.text || !audioFile.value) {
    ElMessage.warning('请填写完整信息并选择或录制音频')
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('dialect_id', form.value.dialect_id)
    formData.append('text', form.value.text)
    if (form.value.speaker_id) {
      formData.append('speaker_id', form.value.speaker_id)
    }
    formData.append('file', audioFile.value)

    const response = await audioApi.upload(formData)
    
    if (response.data.success) {
      qualityInfo.value = {
        quality_score: response.data.quality_score,
        issues: response.data.quality_issues
      }
      
      ElMessage.success(response.data.message)
      
      if (response.data.validation_warnings && response.data.validation_warnings.length > 0) {
        ElMessage.warning('注意: ' + response.data.validation_warnings.join('; '))
      }
      
      loadCorpora()
    }
  } catch (error) {
    ElMessage.error('上传失败: ' + (error.response?.data?.detail || error.message))
  } finally {
    uploading.value = false
  }
}

const extractFeatures = async (corpusId) => {
  try {
    await audioApi.extractFeatures(corpusId)
    ElMessage.success('特征提取完成！')
  } catch (error) {
    ElMessage.error('特征提取失败')
  }
}

const loadCorpora = async () => {
  loading.value = true
  try {
    const response = await audioApi.getCorpora()
    corpora.value = response.data.corpora || []
  } catch (error) {
    console.error('加载语料列表失败:', error)
  } finally {
    loading.value = false
  }
}

const loadDialects = async () => {
  try {
    const response = await knowledgeApi.getDialects()
    dialects.value = response.data.dialects || []
  } catch (error) {
    console.error('加载方言列表失败:', error)
  }
}

onMounted(() => {
  loadDialects()
  loadCorpora()
  initMicrophone()
})

onUnmounted(() => {
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
  }
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
  }
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.audio-preview-section {
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

.audio-preview-section h4 {
  margin: 0 0 10px;
  color: #333;
}

.issue-text {
  margin: 4px 0;
  font-size: 12px;
  color: #666;
}
</style>
