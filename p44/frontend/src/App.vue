<template>
  <div class="app-container">
    <header class="header">
      <div class="header-content">
        <h1 class="title">🎬 Audio-Video Sync Evaluator</h1>
        <p class="subtitle">Professional synchronization analysis for your media files</p>
      </div>
    </header>

    <main class="main-content">
      <div class="upload-section" v-if="!evaluationResult">
        <div class="upload-card">
          <h2>Upload Media Files</h2>
          <p class="description">Upload your video and corresponding audio files for synchronization analysis</p>

          <div class="upload-zones">
            <div class="upload-zone" @click="$refs.videoInput.click()" @dragover.prevent @drop="handleVideoDrop">
              <input ref="videoInput" type="file" accept="video/*" @change="handleVideoSelect" hidden>
              <div class="upload-icon">📹</div>
              <p class="upload-text">{{ videoFile ? videoFile.name : 'Click or drop video file here' }}</p>
              <div v-if="videoFile" class="file-info">
                <span class="file-name">{{ videoFile.name }}</span>
              </div>
            </div>

            <div class="upload-zone" @click="$refs.audioInput.click()" @dragover.prevent @drop="handleAudioDrop">
              <input ref="audioInput" type="file" accept="audio/*" @change="handleAudioSelect" hidden>
              <div class="upload-icon">🎵</div>
              <p class="upload-text">{{ audioFile ? audioFile.name : 'Click or drop audio file here' }}</p>
              <div v-if="audioFile" class="file-info">
                <span class="file-name">{{ audioFile.name }}</span>
              </div>
            </div>
          </div>

          <button @click="startEvaluation" :disabled="!canEvaluate || isEvaluating" class="evaluate-btn">
            <span v-if="isEvaluating" class="spinner"></span>
            {{ isEvaluating ? 'Analyzing...' : 'Start Evaluation' }}
          </button>
        </div>
      </div>

      <div class="results-section" v-else>
        <div class="results-header">
          <h2>Evaluation Results</h2>
          <div class="actions">
            <button @click="startAlignment" :disabled="isAligning" class="btn btn-success">
              <span v-if="isAligning" class="spinner small"></span>
              {{ isAligning ? '修复中...' : '🔧 修复对齐' }}
            </button>
            <button @click="generateReport" class="btn btn-primary">Generate PDF Report</button>
            <button @click="resetEvaluation" class="btn btn-secondary">New Evaluation</button>
          </div>
        </div>

        <div class="warnings-section" v-if="evaluationResult.warnings && evaluationResult.warnings.length > 0">
          <div class="warning-card" v-for="(warning, idx) in evaluationResult.warnings" :key="idx" :class="warning.type">
            <div class="warning-icon">{{ warning.type === 'critical' ? '⚠️' : '⚡' }}</div>
            <div class="warning-content">
              <h4>{{ warning.message }}</h4>
              <p>{{ warning.details }}</p>
            </div>
          </div>
        </div>

        <div class="alignment-status-section" v-if="alignmentResult">
          <div class="alignment-card success" :class="{ 'processing': isAligning }">
            <div class="alignment-icon">
              <span v-if="isAligning">⚙️</span>
              <span v-else-if="alignmentResult.success">✅</span>
              <span v-else>❌</span>
            </div>
            <div class="alignment-content">
              <h4 v-if="isAligning">正在进行音视频对齐修复...</h4>
              <h4 v-else-if="alignmentResult.success">对齐修复完成！</h4>
              <h4 v-else>对齐修复失败</h4>
              <p v-if="isAligning" class="alignment-progress">
                正在应用偏移校正...
              </p>
              <p v-else-if="alignmentResult.success" class="alignment-success">
                {{ alignmentResult.offset_description }}
              </p>
              <p v-else class="alignment-error">
                {{ alignmentResult.error }}
              </p>
              <div v-if="alignmentResult.success" class="alignment-actions">
                <a :href="alignmentResult.download_url" target="_blank" class="btn btn-success">
                  📥 下载对齐后的视频
                </a>
                <div class="file-info">
                  <span>文件大小: {{ formatFileSize(alignmentResult.file_size) }}</span>
                  <span>时长: {{ alignmentResult.duration.toFixed(2) }}s</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="multi-speaker-section" v-if="evaluationResult.multi_speaker_analysis">
          <h3 class="section-title">🎙️ 多说话人同步分析</h3>

          <div class="speaker-summary">
            <div class="speaker-overview">
              <p class="speaker-count">
                检测到 <strong>{{ evaluationResult.multi_speaker_analysis.num_speakers_detected }}</strong> 位说话人
              </p>
            </div>
          </div>

          <div class="speaker-cards-container">
            <div class="speaker-card" v-for="(speakerData, speakerName) in evaluationResult.multi_speaker_analysis.speaker_sync_scores" :key="speakerName">
              <div class="speaker-header">
                <div class="speaker-avatar">👤</div>
                <div class="speaker-info">
                  <h4>{{ speakerName }}</h4>
                  <span class="confidence-badge" :class="speakerData.confidence">{{ speakerData.confidence === 'high' ? '高置信度' : speakerData.confidence === 'medium' ? '中等置信度' : '低置信度' }}</span>
                </div>
                <div class="speaker-score" :class="getScoreClass(speakerData.sync_score)">
                  <span class="score-value">{{ speakerData.sync_score }}</span>
                  <span class="score-label">同步分</span>
                </div>
              </div>

              <div class="speaker-details" v-if="speakerData.statistics">
                <div class="stat-row">
                  <span class="stat-label">语音片段数</span>
                  <span class="stat-value">{{ speakerData.statistics.speech_segments_count }}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">总语音帧数</span>
                  <span class="stat-value">{{ speakerData.statistics.total_speech_frames }}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">相关系数</span>
                  <span class="stat-value">{{ speakerData.correlation }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="timeline-section" v-if="evaluationResult.multi_speaker_analysis.timeline_view.length > 0">
            <h4 class="timeline-title">📊 说话时间线</h4>
            <div class="timeline-container">
              <div class="timeline-item" v-for="(item, index) in evaluationResult.multi_speaker_analysis.timeline_view" :key="index">
                <div class="timeline-speaker" :class="item.speaker.replace('_', '-').toLowerCase()">
                  {{ item.speaker }}
                </div>
                <div class="timeline-bar">
                  <div class="timeline-progress" :style="{ left: (item.start_time / evaluationResult.video_info.duration * 100) + '%', width: (item.duration / evaluationResult.video_info.duration * 100) + '%' }"></div>
                </div>
                <div class="timeline-time">
                  {{ formatTime(item.start_time) }} - {{ formatTime(item.end_time) }}
                  <span class="duration">({{ item.duration }}s)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="sync-score-card">
          <div class="score-circle" :class="[syncLevelClass, { 'acoustic-mode': evaluationResult.sync_analysis.evaluation_mode === 'acoustic_only' }]">
            <span class="score-value">{{ evaluationResult.sync_analysis.sync_score }}</span>
            <span class="score-label">/ 100</span>
            <div class="mode-badge" v-if="evaluationResult.sync_analysis.evaluation_mode === 'acoustic_only'">仅音频</div>
          </div>
          <div class="score-details">
            <h3>{{ evaluationResult.sync_analysis.sync_level.toUpperCase() }}</h3>
            <p class="offset-info">
              Detected Offset: <strong>{{ evaluationResult.sync_analysis.offset_frames }} frames</strong>
              ({{ evaluationResult.sync_analysis.offset_seconds.toFixed(3) }}s)
            </p>
            <p class="correlation">
              Correlation Score: {{ (evaluationResult.sync_analysis.correlation_score * 100).toFixed(1) }}%
            </p>
            <p class="valid-ratio">
              有效帧比例: <strong>{{ (evaluationResult.sync_analysis.valid_frame_ratio * 100).toFixed(1) }}%</strong>
              <span class="ratio-indicator" :class="getRatioClass(evaluationResult.sync_analysis.valid_frame_ratio)"></span>
            </p>
            <div class="evaluation-mode-info">
              <span class="mode-label">评估模式:</span>
              <span class="mode-value">{{ getEvaluationModeText(evaluationResult.sync_analysis.evaluation_mode) }}</span>
            </div>
          </div>
        </div>

        <div class="player-section">
          <h3>Media Player with Waveform</h3>
          <div class="video-container">
            <video ref="videoPlayer" class="video-js vjs-big-play-centered" controls preload="auto" width="100%" height="400">
              <source :src="videoUrl" type="video/mp4">
              <p class="vjs-no-js">To view this video please enable JavaScript</p>
            </video>
          </div>
          <div class="waveform-container" ref="waveformContainer"></div>
        </div>

        <div class="charts-section">
          <h3>Analysis Charts</h3>
          <div class="chart-grid">
            <div class="chart-card">
              <h4>Audio Energy Envelope</h4>
              <canvas ref="audioChart"></canvas>
            </div>
            <div class="chart-card">
              <h4>Lip Movement Activity</h4>
              <canvas ref="visualChart"></canvas>
            </div>
            <div class="chart-card full-width">
              <h4>Synchronization Score Over Time</h4>
              <canvas ref="syncChart"></canvas>
            </div>
          </div>
        </div>

        <div class="info-section">
          <div class="info-card">
            <h4>Video Information</h4>
            <ul>
              <li><strong>Duration:</strong> {{ evaluationResult.video_info.duration.toFixed(2) }}s</li>
              <li><strong>FPS:</strong> {{ evaluationResult.video_info.fps.toFixed(1) }}</li>
              <li><strong>Resolution:</strong> {{ evaluationResult.video_info.resolution.width }}x{{ evaluationResult.video_info.resolution.height }}</li>
            </ul>
          </div>
          <div class="info-card">
            <h4>Audio Information</h4>
            <ul>
              <li><strong>Duration:</strong> {{ evaluationResult.audio_info.duration.toFixed(2) }}s</li>
              <li><strong>Sample Rate:</strong> {{ evaluationResult.audio_info.sample_rate }} Hz</li>
              <li><strong>Voice Segments:</strong> {{ evaluationResult.audio_info.voice_segments.length }} detected</li>
            </ul>
          </div>
          <div class="info-card quality-card">
            <h4>Frame Quality Metrics</h4>
            <div class="quality-stats">
              <div class="stat-item">
                <span class="stat-value">{{ evaluationResult.video_info.quality_metrics.valid_frames }}</span>
                <span class="stat-label">Valid Frames</span>
              </div>
              <div class="stat-item invalid">
                <span class="stat-value">{{ evaluationResult.video_info.quality_metrics.invalid_frames }}</span>
                <span class="stat-label">Invalid Frames</span>
              </div>
            </div>
            <ul class="quality-details">
              <li>
                <span class="icon">👤</span>
                <strong>No Face Detected:</strong> {{ evaluationResult.video_info.quality_metrics.no_face_frames }} frames
              </li>
              <li>
                <span class="icon">🔄</span>
                <strong>Side Face (&gt;45°):</strong> {{ evaluationResult.video_info.quality_metrics.side_face_frames }} frames
              </li>
              <li>
                <span class="icon">❌</span>
                <strong>Detection Failed:</strong> {{ evaluationResult.video_info.quality_metrics.detection_failed_frames }} frames
              </li>
            </ul>
            <div class="invalid-frames-list" v-if="evaluationResult.invalid_frames_info && evaluationResult.invalid_frames_info.length > 0">
              <h5>Invalid Frame Details (First 10 shown)</h5>
              <div class="frame-item" v-for="(frame, idx) in evaluationResult.invalid_frames_info.slice(0, 10)" :key="idx">
                <span class="frame-number">Frame {{ frame.frame }}</span>
                <span class="frame-reason">{{ frame.reason }}</span>
                <span class="frame-time">@ {{ frame.timestamp.toFixed(2) }}s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="footer">
      <p>Audio-Video Sync Evaluator © 2024</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import axios from 'axios'
import Chart from 'chart.js/auto'

const videoFile = ref(null)
const audioFile = ref(null)
const videoUrl = ref(null)
const isEvaluating = ref(false)
const evaluationResult = ref(null)
const audioChart = ref(null)
const visualChart = ref(null)
const syncChart = ref(null)
const waveformContainer = ref(null)
const isAligning = ref(false)
const alignmentResult = ref(null)

const canEvaluate = computed(() => videoFile.value && audioFile.value)

const syncLevelClass = computed(() => {
  if (!evaluationResult.value) return ''
  const score = evaluationResult.value.sync_analysis.sync_score
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
})

function handleVideoSelect(event) {
  videoFile.value = event.target.files[0]
  if (videoFile.value) {
    videoUrl.value = URL.createObjectURL(videoFile.value)
  }
}

function handleAudioSelect(event) {
  audioFile.value = event.target.files[0]
}

function handleVideoDrop(event) {
  const file = event.dataTransfer.files[0]
  if (file && file.type.startsWith('video/')) {
    videoFile.value = file
    videoUrl.value = URL.createObjectURL(file)
  }
}

function handleAudioDrop(event) {
  const file = event.dataTransfer.files[0]
  if (file && file.type.startsWith('audio/')) {
    audioFile.value = file
  }
}

async function startEvaluation() {
  isEvaluating.value = true
  try {
    const formData = new FormData()
    formData.append('video', videoFile.value)
    formData.append('audio', audioFile.value)

    const response = await axios.post('/api/evaluate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    evaluationResult.value = response.data.data
    await nextTick()
    initializeCharts()
  } catch (error) {
    console.error('Evaluation failed:', error)
    alert('Evaluation failed. Please try again.')
  } finally {
    isEvaluating.value = false
  }
}

function initializeCharts() {
  const signals = evaluationResult.value.signals

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { display: true, title: { display: true, text: 'Frame' } },
      y: { display: true, title: { display: true, text: 'Normalized Value' } }
    }
  }

  new Chart(audioChart.value, {
    type: 'line',
    data: {
      labels: Array.from({ length: signals.audio_envelope.length }, (_, i) => i),
      datasets: [{
        data: signals.audio_envelope,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: commonOptions
  })

  new Chart(visualChart.value, {
    type: 'line',
    data: {
      labels: Array.from({ length: signals.visual_activity.length }, (_, i) => i),
      datasets: [{
        data: signals.visual_activity,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: commonOptions
  })

  const syncData = signals.sync_curve
  new Chart(syncChart.value, {
    type: 'line',
    data: {
      labels: syncData.map(d => d.frame),
      datasets: [{
        data: syncData.map(d => d.local_sync_score),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 2
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        ...commonOptions.scales,
        y: { ...commonOptions.scales.y, min: 0, max: 100, title: { display: true, text: 'Sync Score' } }
      }
    }
  })
}

async function generateReport() {
  try {
    const response = await axios.post('/api/generate-report', evaluationResult.value)
    window.open(response.data.report_url, '_blank')
  } catch (error) {
    console.error('Report generation failed:', error)
    alert('Failed to generate report. Please try again.')
  }
}

function resetEvaluation() {
  videoFile.value = null
  audioFile.value = null
  videoUrl.value = null
  evaluationResult.value = null
  alignmentResult.value = null
}

function getRatioClass(ratio) {
  if (ratio >= 0.8) return 'good'
  if (ratio >= 0.5) return 'medium'
  return 'poor'
}

function getEvaluationModeText(mode) {
  const modeMap = {
    'visual_audio_sync': '音视频同步评估',
    'acoustic_only': '仅音频评估（视频质量不足）'
  }
  return modeMap[mode] || mode
}

async function startAlignment() {
  if (!evaluationResult.value) return

  isAligning.value = true
  alignmentResult.value = null

  try {
    const response = await axios.post('/api/align', {
      video_filename: videoFile.value.name,
      audio_filename: audioFile.value.name,
      offset_seconds: evaluationResult.value.sync_analysis.offset_seconds,
      original_video_path: evaluationResult.value.video_info.video_path,
      original_audio_path: evaluationResult.value.audio_info.audio_path
    })

    alignmentResult.value = response.data.data
  } catch (error) {
    console.error('Alignment failed:', error)
    alignmentResult.value = {
      success: false,
      error: error.response?.data?.detail || error.message || '对齐修复失败，请重试'
    }
  } finally {
    isAligning.value = false
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getScoreClass(score) {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: rgba(255, 255, 255, 0.95);
  padding: 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.title {
  font-size: 2rem;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #6b7280;
  font-size: 1rem;
}

.main-content {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.upload-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.upload-card h2 {
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.description {
  color: #6b7280;
  margin-bottom: 2rem;
}

.upload-zones {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.upload-zone {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #f9fafb;
}

.upload-zone:hover {
  border-color: #3b82f6;
  background: #eff6ff;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.upload-text {
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.file-info {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border-radius: 8px;
  display: inline-block;
}

.evaluate-btn {
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.evaluate-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.evaluate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.results-header h2 {
  color: white;
  font-size: 1.8rem;
}

.actions {
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #10b981;
  color: white;
}

.btn-primary:hover {
  background: #059669;
}

.btn-secondary {
  background: white;
  color: #1f2937;
}

.btn-secondary:hover {
  background: #f3f4f6;
}

.sync-score-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.score-circle {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  transition: all 0.3s ease;
  position: relative;
}

.score-circle.excellent {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.score-circle.good {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.score-circle.fair {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
}

.score-circle.poor {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.score-value {
  font-size: 3rem;
  line-height: 1;
}

.score-label {
  font-size: 1rem;
  opacity: 0.9;
}

.score-details h3 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: #1f2937;
}

.offset-info, .correlation {
  color: #6b7280;
  margin: 0.25rem 0;
}

.player-section {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.player-section h3 {
  color: #1f2937;
  margin-bottom: 1rem;
}

.video-container {
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.waveform-container {
  height: 100px;
  background: #f3f4f6;
  border-radius: 8px;
  overflow: hidden;
}

.charts-section {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.charts-section h3 {
  color: #1f2937;
  margin-bottom: 1.5rem;
}

.chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.chart-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 1rem;
}

.chart-card.full-width {
  grid-column: 1 / -1;
}

.chart-card h4 {
  color: #374151;
  margin-bottom: 1rem;
  font-size: 0.95rem;
}

.info-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.info-card {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.info-card h4 {
  color: #1f2937;
  margin-bottom: 1rem;
}

.info-card ul {
  list-style: none;
}

.info-card li {
  padding: 0.5rem 0;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
}

.info-card li:last-child {
  border-bottom: none;
}

.footer {
  background: rgba(0, 0, 0, 0.2);
  padding: 1.5rem;
  text-align: center;
  color: white;
}

.warnings-section {
  margin-bottom: 2rem;
}

.warning-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.warning-card.critical {
  border-left: 4px solid #ef4444;
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, white 100%);
}

.warning-card.warning {
  border-left: 4px solid #f59e0b;
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, white 100%);
}

.warning-icon {
  font-size: 1.5rem;
}

.warning-content h4 {
  margin: 0 0 0.25rem 0;
  color: #1f2937;
  font-size: 1rem;
}

.warning-content p {
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.score-circle.acoustic-mode {
  background: linear-gradient(135deg, #8b5cf6, #6366f1) !important;
}

.mode-badge {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.valid-ratio {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.ratio-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

.ratio-indicator.good {
  background: #10b981;
}

.ratio-indicator.medium {
  background: #f59e0b;
}

.ratio-indicator.poor {
  background: #ef4444;
}

.evaluation-mode-info {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.mode-label {
  color: #6b7280;
  margin-right: 0.5rem;
}

.mode-value {
  color: #8b5cf6;
  font-weight: 600;
}

.info-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.quality-card {
  grid-column: span 1;
}

.quality-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.stat-item {
  text-align: center;
}

.stat-item.invalid .stat-value {
  color: #ef4444;
}

.stat-value {
  display: block;
  font-size: 2rem;
  font-weight: bold;
  color: #1f2937;
  line-height: 1;
}

.stat-label {
  display: block;
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.quality-details {
  list-style: none;
  padding: 0;
  margin-bottom: 1rem;
}

.quality-details li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.quality-details li:last-child {
  border-bottom: none;
}

.quality-details .icon {
  font-size: 1.125rem;
}

.invalid-frames-list h5 {
  color: #374151;
  margin: 1rem 0 0.5rem 0;
  font-size: 0.875rem;
}

.frame-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
}

.frame-number {
  font-weight: 600;
  color: #1f2937;
}

.frame-reason {
  flex: 1;
  color: #ef4444;
}

.frame-time {
  color: #6b7280;
}

.btn-success {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.spinner.small {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.alignment-status-section {
  margin-bottom: 2rem;
}

.alignment-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 12px;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #10b981;
}

.alignment-card.processing {
  border-left-color: #f59e0b;
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, white 100%);
}

.alignment-card.success {
  border-left-color: #10b981;
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, white 100%);
}

.alignment-icon {
  font-size: 2rem;
  line-height: 1;
}

.alignment-content h4 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
  font-size: 1.1rem;
}

.alignment-progress {
  color: #f59e0b;
  margin: 0;
  font-weight: 500;
}

.alignment-success {
  color: #10b981;
  margin: 0 0 1rem 0;
  font-weight: 500;
}

.alignment-error {
  color: #ef4444;
  margin: 0;
  font-weight: 500;
}

.alignment-actions {
  margin-top: 1rem;
}

.alignment-actions .btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  margin-bottom: 0.5rem;
}

.alignment-actions .file-info {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.alignment-actions .file-info span {
  color: #6b7280;
  font-size: 0.875rem;
}

.multi-speaker-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.section-title {
  margin: 0 0 1.5rem 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 600;
}

.speaker-summary {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.speaker-count {
  margin: 0;
  color: #6b7280;
  font-size: 1rem;
}

.speaker-cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.speaker-card {
  background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
  border-radius: 10px;
  padding: 1.25rem;
  border: 1px solid #e5e7eb;
}

.speaker-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.speaker-avatar {
  font-size: 2rem;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 50%;
}

.speaker-info h4 {
  margin: 0 0 0.25rem 0;
  color: #1f2937;
  font-weight: 600;
}

.confidence-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.confidence-badge.high {
  background: #d1fae5;
  color: #059669;
}

.confidence-badge.medium {
  background: #fef3c7;
  color: #d97706;
}

.confidence-badge.low {
  background: #fee2e2;
  color: #dc2626;
}

.speaker-score {
  margin-left: auto;
  text-align: center;
}

.speaker-score .score-value {
  display: block;
  font-size: 1.5rem;
  font-weight: bold;
}

.speaker-score .score-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.speaker-score.excellent .score-value { color: #059669; }
.speaker-score.good .score-value { color: #3b82f6; }
.speaker-score.fair .score-value { color: #f59e0b; }
.speaker-score.poor .score-value { color: #ef4444; }

.speaker-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0;
  font-size: 0.875rem;
}

.stat-label {
  color: #6b7280;
}

.stat-value {
  color: #1f2937;
  font-weight: 500;
}

.timeline-section {
  margin-top: 1rem;
}

.timeline-title {
  margin: 0 0 1rem 0;
  color: #374151;
  font-size: 1rem;
  font-weight: 600;
}

.timeline-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-item {
  display: grid;
  grid-template-columns: 100px 1fr 180px;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 8px;
}

.timeline-speaker {
  font-weight: 600;
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  text-align: center;
}

.timeline-speaker.speaker-0 {
  background: #dbeafe;
  color: #1d4ed8;
}

.timeline-speaker.speaker-1 {
  background: #dcfce7;
  color: #166534;
}

.timeline-speaker.speaker-2 {
  background: #fef3c7;
  color: #92400e;
}

.timeline-bar {
  height: 12px;
  background: #e5e7eb;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}

.timeline-progress {
  position: absolute;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #6366f1);
  border-radius: 6px;
}

.timeline-time {
  font-size: 0.875rem;
  color: #6b7280;
  text-align: right;
}

.timeline-time .duration {
  margin-left: 0.5rem;
  color: #1f2937;
  font-weight: 500;
}

@media (max-width: 768px) {
  .timeline-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .timeline-time {
    text-align: left;
  }
}
</style>
