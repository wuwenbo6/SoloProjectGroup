<script>
  import { onMount } from 'svelte'
  import { audio, annotations } from '../lib/api.js'
  
  let audioSamples = []
  let selectedSample = null
  let annotationText = ''
  let phoneticTranscription = ''
  let notes = ''
  let loading = true
  let saving = false
  let isPlaying = false
  let currentTime = 0
  let duration = 0
  
  let audioElement
  
  onMount(async () => {
    try {
      audioSamples = await audio.getAll({ statusFilter: 'unannotated' })
    } catch (error) {
      console.error('加载语音样本失败:', error)
    } finally {
      loading = false
    }
  })
  
  function selectSample(sample) {
    selectedSample = sample
    annotationText = ''
    phoneticTranscription = ''
    notes = ''
    currentTime = 0
    isPlaying = false
    
    setTimeout(() => {
      if (audioElement) {
        audioElement.src = audio.getStreamUrl(sample.id)
        audioElement.load()
      }
    }, 100)
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
  
  function updateTime() {
    currentTime = audioElement.currentTime
  }
  
  function updateDuration() {
    duration = audioElement.duration
  }
  
  function seek(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    audioElement.currentTime = percent * duration
  }
  
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  async function saveAnnotation() {
    if (!selectedSample || !annotationText.trim()) return
    
    saving = true
    try {
      await annotations.create({
        audioSampleId: selectedSample.id,
        text: annotationText,
        phoneticTranscription: phoneticTranscription || undefined,
        notes: notes || undefined
      })
      
      alert('标注保存成功！')
      selectedSample = null
      annotationText = ''
      phoneticTranscription = ''
      notes = ''
    } catch (error) {
      alert('保存失败: ' + error.message)
    } finally {
      saving = false
    }
  }
  
  async function submitAnnotation() {
    if (!selectedSample || !annotationText.trim()) return
    
    saving = true
    try {
      const result = await annotations.create({
        audioSampleId: selectedSample.id,
        text: annotationText,
        phoneticTranscription: phoneticTranscription || undefined,
        notes: notes || undefined
      })
      
      await annotations.submit(result.id)
      
      alert('标注提交成功！')
      audioSamples = audioSamples.filter(s => s.id !== selectedSample.id)
      selectedSample = null
      annotationText = ''
      phoneticTranscription = ''
      notes = ''
    } catch (error) {
      alert('提交失败: ' + error.message)
    } finally {
      saving = false
    }
  }
</script>

<div class="annotation-page">
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>待标注语音</h2>
    </div>
    
    {#if loading}
      <div class="loading">加载中...</div>
    {:else if audioSamples.length === 0}
      <div class="empty-state">
        <span class="empty-icon">🎵</span>
        <p>暂无待标注的语音样本</p>
      </div>
    {:else}
      <div class="sample-list">
        {#each audioSamples as sample}
          <div 
            class="sample-item"
            class:active={selectedSample?.id === sample.id}
            on:click={() => selectSample(sample)}
          >
            <div class="sample-name">{sample.originalFilename}</div>
            <div class="sample-meta">
              <span>⏱️ {sample.duration?.toFixed(2) || 0}s</span>
              {#if sample.collectionLocation}
                <span>📍 {sample.collectionLocation}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
  
  <div class="main-content">
    {#if !selectedSample}
      <div class="placeholder">
        <span class="placeholder-icon">👆</span>
        <h2>请从左侧选择一个语音样本开始标注</h2>
        <p>点击左侧列表中的语音文件，即可开始转写标注</p>
      </div>
    {:else}
      <div class="annotation-workspace">
        <div class="audio-player-section">
          <h3>语音播放</h3>
          <div class="player-container">
            <button class="play-btn" on:click={togglePlay}>
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            
            <div class="progress-container" on:click={seek}>
              <div class="progress-bar">
                <div class="progress-fill" style="width: {(currentTime / (duration || 1)) * 100}%"></div>
              </div>
              <div class="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
          
          <audio 
            bind:this={audioElement}
            on:timeupdate={updateTime}
            on:loadedmetadata={updateDuration}
            on:ended={() => isPlaying = false}
            style="display: none;"
          />
          
          <div class="sample-info">
            <div class="info-item">
              <span class="label">文件名:</span>
              <span class="value">{selectedSample.originalFilename}</span>
            </div>
            {#if selectedSample.collectionLocation}
              <div class="info-item">
                <span class="label">采集地点:</span>
                <span class="value">{selectedSample.collectionLocation}</span>
              </div>
            {/if}
            {#if selectedSample.speakerAge}
              <div class="info-item">
                <span class="label">说话人年龄:</span>
                <span class="value">{selectedSample.speakerAge}岁</span>
              </div>
            {/if}
            {#if selectedSample.speakerGender}
              <div class="info-item">
                <span class="label">说话人性别:</span>
                <span class="value">{selectedSample.speakerGender}</span>
              </div>
            {/if}
          </div>
        </div>
        
        <div class="annotation-form">
          <h3>文本标注</h3>
          
          <div class="form-group">
            <label>方言文本转写 *</label>
            <textarea
              bind:value={annotationText}
              placeholder="请仔细听录音，将方言内容转写成规范的汉字文本..."
              rows="6"
            />
          </div>
          
          <div class="form-group">
            <label>音标/拼音标注（可选）</label>
            <textarea
              bind:value={phoneticTranscription}
              placeholder="如果熟悉方言拼音或音标，可以在此处标注..."
              rows="3"
            />
          </div>
          
          <div class="form-group">
            <label>备注说明（可选）</label>
            <textarea
              bind:value={notes}
              placeholder="如有不确定的内容或其他需要说明的情况..."
              rows="2"
            />
          </div>
          
          <div class="form-actions">
            <button class="btn btn-secondary" on:click={saveAnnotation} disabled={saving}>
              💾 保存草稿
            </button>
            <button class="btn btn-primary" on:click={submitAnnotation} disabled={saving}>
              ✅ 提交标注
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .annotation-page {
    display: flex;
    min-height: calc(100vh - 64px);
  }
  
  .sidebar {
    width: 320px;
    background: white;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
  }
  
  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .sidebar-header h2 {
    font-size: 18px;
    color: #2d3748;
  }
  
  .loading {
    padding: 40px;
    text-align: center;
    color: #718096;
  }
  
  .empty-state {
    padding: 60px 20px;
    text-align: center;
    color: #718096;
  }
  
  .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }
  
  .sample-list {
    overflow-y: auto;
    flex: 1;
  }
  
  .sample-item {
    padding: 16px 20px;
    border-bottom: 1px solid #f7fafc;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .sample-item:hover {
    background: #f7fafc;
  }
  
  .sample-item.active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
    border-left: 3px solid #667eea;
  }
  
  .sample-name {
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 6px;
    word-break: break-all;
  }
  
  .sample-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #718096;
  }
  
  .main-content {
    flex: 1;
    padding: 30px;
  }
  
  .placeholder {
    text-align: center;
    padding: 100px 20px;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .placeholder-icon {
    font-size: 64px;
    display: block;
    margin-bottom: 20px;
  }
  
  .placeholder h2 {
    font-size: 24px;
    margin-bottom: 12px;
  }
  
  .annotation-workspace {
    background: white;
    border-radius: 16px;
    padding: 30px;
    max-width: 900px;
  }
  
  .audio-player-section {
    margin-bottom: 30px;
    padding-bottom: 30px;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .audio-player-section h3 {
    font-size: 18px;
    color: #2d3748;
    margin-bottom: 20px;
  }
  
  .player-container {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
  }
  
  .play-btn {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  
  .play-btn:hover {
    transform: scale(1.1);
  }
  
  .progress-container {
    flex: 1;
    cursor: pointer;
  }
  
  .progress-bar {
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 4px;
    transition: width 0.1s;
  }
  
  .time-display {
    font-size: 14px;
    color: #718096;
    text-align: right;
  }
  
  .sample-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    background: #f7fafc;
    padding: 16px;
    border-radius: 10px;
  }
  
  .info-item {
    display: flex;
    gap: 8px;
    font-size: 14px;
  }
  
  .info-item .label {
    color: #718096;
    font-weight: 500;
  }
  
  .info-item .value {
    color: #2d3748;
  }
  
  .annotation-form h3 {
    font-size: 18px;
    color: #2d3748;
    margin-bottom: 20px;
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  .form-group label {
    display: block;
    font-weight: 500;
    color: #4a5568;
    margin-bottom: 8px;
  }
  
  .form-group textarea {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    transition: border-color 0.2s;
  }
  
  .form-group textarea:focus {
    outline: none;
    border-color: #667eea;
  }
  
  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 30px;
  }
  
  .btn {
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }
  
  .btn-secondary {
    background: #e2e8f0;
    color: #4a5568;
  }
  
  .btn-secondary:hover {
    background: #cbd5e0;
  }
  
  .btn-primary {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
  }
  
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }
  
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
