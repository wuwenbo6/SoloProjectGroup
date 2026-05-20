<script>
  import { onMount } from 'svelte'
  import { audio, annotations } from '../lib/api.js'

  let samples = []
  let loading = true
  let currentSample = null
  let annotationText = ''
  let isPlaying = false
  let audioElement
  let currentTime = 0
  let duration = 0
  let progress = 0
  let saved = false

  onMount(async () => {
    try {
      const result = await audio.getAll({ limit: 20, status: 'pending' })
      samples = result.items || result
    } catch (error) {
      console.error('加载失败:', error)
    } finally {
      loading = false
    }
  })

  async function selectSample(sample) {
    currentSample = sample
    annotationText = sample.annotation_text || ''
    saved = false
    
    if (audioElement) {
      audioElement.pause()
    }
    
    audioElement = new Audio(audio.getStreamUrl(sample.id))
    audioElement.addEventListener('timeupdate', updateProgress)
    audioElement.addEventListener('loadedmetadata', () => {
      duration = audioElement.duration
    })
    audioElement.addEventListener('ended', () => {
      isPlaying = false
      progress = 0
    })
  }

  function updateProgress() {
    currentTime = audioElement.currentTime
    progress = (currentTime / duration) * 100
  }

  function togglePlay() {
    if (!audioElement) return
    
    if (isPlaying) {
      audioElement.pause()
    } else {
      audioElement.play()
    }
    isPlaying = !isPlaying
  }

  function seek(e) {
    if (!audioElement || !duration) return
    
    const rect = e.target.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    audioElement.currentTime = percent * duration
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  async function saveAnnotation() {
    if (!currentSample || !annotationText.trim()) return
    
    try {
      await annotations.create({
        audio_sample_id: currentSample.id,
        text: annotationText.trim()
      })
      saved = true
      setTimeout(() => { saved = false }, 2000)
    } catch (error) {
      alert('保存失败: ' + error.message)
    }
  }

  async function nextSample() {
    const currentIndex = samples.findIndex(s => s.id === currentSample.id)
    if (currentIndex < samples.length - 1) {
      selectSample(samples[currentIndex + 1])
    }
  }

  async function prevSample() {
    const currentIndex = samples.findIndex(s => s.id === currentSample.id)
    if (currentIndex > 0) {
      selectSample(samples[currentIndex - 1])
    }
  }
</script>

<div class="mobile-annotation">
  {#if loading}
    <div class="loading">
    <div class="spinner"></div>
    <p>加载中...</p>
    </div>
  {:else if !currentSample}
    <div class="sample-list">
    <div class="list-header">
    <h2>待标注语音</h2>
    <span class="count">{samples.length} 条</span>
    </div>
    {#each samples as sample}
    <div class="sample-item" on:click={() => selectSample(sample)}>
    <div class="sample-icon">🎵</div>
    <div class="sample-info">
    <div class="sample-name">{sample.filename}</div>
    <div class="sample-meta">
    {sample.duration ? formatTime(sample.duration) : ''}
    {#if sample.annotation_text}
    <span class="status-done">✓ 已标注</span>
    {/if}
    </div>
    </div>
    <div class="arrow">›</div>
    </div>
    {/each}
    </div>
  {:else}
    <div class="annotation-screen">
    <div class="sample-name-header">
    <button class="back-btn" on:click={() => currentSample = null}>←</button>
    <h3>{currentSample.filename}</h3>
    </div>

    <div class="audio-player">
    <div class="progress-container" on:click={seek}>
    <div class="progress-bar" style="width: {progress}%"></div>
    </div>
    <div class="time-display">
    <span>{formatTime(currentTime)}</span>
    <span>{formatTime(duration)}</span>
    </div>
    <button class="play-btn" on:click={togglePlay}>
    {isPlaying ? '⏸️' : '▶️'}
    </button>
    </div>

    <div class="annotation-area">
    <label>标注文本</label>
    <textarea
    bind:value={annotationText}
    placeholder="请输入方言内容..."
    rows="6"
    ></textarea>
    </div>

    <div class="action-buttons">
    <button class="btn-save" class:saved on:click={saveAnnotation}>
    {saved ? '✓ 已保存' : '💾 保存标注'}
    </button>
    </div>

    <div class="nav-buttons">
    <button class="nav-btn" disabled={samples.findIndex(s => s.id === currentSample.id) === 0} on:click={prevSample}>
    ← 上一条
    </button>
    <button class="nav-btn" disabled={samples.findIndex(s => s.id === currentSample.id) === samples.length - 1} on:click={nextSample}>
    下一条 →
    </button>
    </div>
    </div>
  {/if}
</div>

<style>
  .mobile-annotation {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 16px;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    color: white;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .sample-list {
    background: white;
    border-radius: 16px;
    overflow: hidden;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #f7fafc;
    border-bottom: 1px solid #e2e8f0;
  }

  .list-header h2 {
    margin: 0;
    font-size: 18px;
    color: #2d3748;
  }

  .count {
    font-size: 14px;
    color: #718096;
    background: #e2e8f0;
    padding: 4px 12px;
    border-radius: 12px;
  }

  .sample-item {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #e2e8f0;
    cursor: pointer;
    transition: background 0.2s;
  }

  .sample-item:hover {
    background: #f7fafc;
  }

  .sample-icon {
    font-size: 24px;
    margin-right: 12px;
  }

  .sample-info {
    flex: 1;
  }

  .sample-name {
    font-weight: 500;
    color: #2d3748;
    font-size: 14px;
    margin-bottom: 4px;
    word-break: break-all;
  }

  .sample-meta {
    font-size: 12px;
    color: #718096;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .status-done {
    color: #10b981;
    font-weight: 500;
  }

  .arrow {
    font-size: 20px;
    color: #cbd5e0;
  }

  .annotation-screen {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    min-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .sample-name-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    background: #f7fafc;
    border-bottom: 1px solid #e2e8f0;
    gap: 12px;
  }

  .back-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #667eea;
    padding: 4px 8px;
  }

  .sample-name-header h3 {
    margin: 0;
    font-size: 16px;
    color: #2d3748;
    flex: 1;
    word-break: break-all;
  }

  .audio-player {
    padding: 24px 20px;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  }

  .progress-container {
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 12px;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #667eea, #764ba2);
    border-radius: 4px;
    transition: width 0.1s;
  }

  .time-display {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #718096;
    margin-bottom: 16px;
  }

  .play-btn {
    display: block;
    width: 64px;
    height: 64px;
    margin: 0 auto;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    font-size: 28px;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: transform 0.2s;
  }

  .play-btn:hover {
    transform: scale(1.05);
  }

  .annotation-area {
    flex: 1;
    padding: 20px;
  }

  .annotation-area label {
    display: block;
    font-weight: 600;
    color: #4a5568;
    margin-bottom: 12px;
    font-size: 16px;
  }

  .annotation-area textarea {
    width: 100%;
    padding: 16px;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-size: 16px;
    resize: vertical;
    transition: border-color 0.2s;
  }

  .annotation-area textarea:focus {
    outline: none;
    border-color: #667eea;
  }

  .action-buttons {
    padding: 0 20px 16px;
  }

  .btn-save {
    width: 100%;
    padding: 16px;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    transition: all 0.2s;
  }

  .btn-save:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-save.saved {
    background: #10b981;
  }

  .nav-buttons {
    display: flex;
    gap: 12px;
    padding: 0 20px 20px;
  }

  .nav-btn {
    flex: 1;
    padding: 12px;
    border: 2px solid #e2e8f0;
    background: white;
    color: #4a5568;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .nav-btn:hover:not(:disabled) {
    border-color: #667eea;
    color: #667eea;
  }

  .nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (min-width: 768px) {
    .mobile-annotation {
      padding: 24px;
      max-width: 480px;
      margin: 0 auto;
    }
  }
</style>
