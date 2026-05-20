<script>
  import { onMount } from 'svelte'
  import { audio } from '../lib/api.js'
  
  let audioSamples = []
  let loading = true
  let loadingMore = false
  let uploading = false
  let regionFilter = ''
  let statusFilter = ''
  
  let page = 1
  let pageSize = 20
  let total = 0
  let hasMore = false
  
  let uploadFile = null
  let collectorName = ''
  let collectionLocation = ''
  let speakerAge = ''
  let speakerGender = ''
  
  let isPlaying = false
  let currentPlayingId = null
  let currentTime = 0
  let duration = 0
  let audioElement
  
  onMount(loadSamples)
  
  async function loadSamples(append = false) {
    if (append) {
      loadingMore = true
    } else {
      loading = true
      page = 1
    }
    
    try {
      const params = {
        page: append ? page + 1 : 1,
        pageSize
      }
      if (regionFilter) params.region = regionFilter
      if (statusFilter) params.statusFilter = statusFilter
      
      const result = await audio.getAll(params)
      
      if (append) {
        audioSamples = [...audioSamples, ...(result.items || result)]
        page += 1
      } else {
        audioSamples = result.items || result
        page = 1
      }
      
      total = result.total || audioSamples.length
      hasMore = audioSamples.length < total
    } catch (error) {
      console.error('加载语音样本失败:', error)
    } finally {
      if (append) {
        loadingMore = false
      } else {
        loading = false
      }
    }
  }

  function loadMore() {
    if (!loadingMore && hasMore) {
      loadSamples(true)
    }
  }
  
  function handleFileSelect(e) {
    uploadFile = e.target.files[0]
  }
  
  async function handleUpload() {
    if (!uploadFile) return
    
    uploading = true
    try {
      await audio.upload(uploadFile, {
        collectorName: collectorName || undefined,
        collectionLocation: collectionLocation || undefined,
        speakerAge: speakerAge ? parseInt(speakerAge) : undefined,
        speakerGender: speakerGender || undefined
      })
      
      alert('上传成功！')
      uploadFile = null
      collectorName = ''
      collectionLocation = ''
      speakerAge = ''
      speakerGender = ''
      await loadSamples()
    } catch (error) {
      alert('上传失败: ' + error.message)
    } finally {
      uploading = false
    }
  }
  
  function playSample(sample) {
    if (currentPlayingId === sample.id && isPlaying) {
      audioElement.pause()
      isPlaying = false
      return
    }
    
    currentPlayingId = sample.id
    audioElement.src = audio.getStreamUrl(sample.id)
    audioElement.play()
    isPlaying = true
  }
  
  function stopPlayback() {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    isPlaying = false
    currentPlayingId = null
  }
  
  function updateTime() {
    currentTime = audioElement.currentTime
  }
  
  function updateDuration() {
    duration = audioElement.duration
  }
  
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  function getStatusLabel(status) {
    const labels = {
      unannotated: '未标注',
      annotating: '标注中',
      submitted: '已提交',
      accepted: '已通过',
      rejected: '已拒绝'
    }
    return labels[status] || status
  }
  
  function getStatusColor(status) {
    const colors = {
      unannotated: '#718096',
      annotating: '#f6ad55',
      submitted: '#63b3ed',
      accepted: '#68d391',
      rejected: '#fc8181'
    }
    return colors[status] || '#718096'
  }
</script>

<div class="audio-page">
  <audio 
    bind:this={audioElement}
    on:timeupdate={updateTime}
    on:loadedmetadata={updateDuration}
    on:ended={() => { isPlaying = false; currentPlayingId = null }}
    style="display: none;"
  />
  
  <div class="page-header">
    <h1>语音样本库</h1>
    <p>管理和试听所有采集的方言语料</p>
  </div>
  
  <div class="upload-section">
    <div class="card">
      <h2>📤 上传新语音</h2>
      <div class="upload-form">
        <div class="form-group">
          <label>选择音频文件 *</label>
          <input 
            type="file" 
            accept="audio/*"
            on:change={handleFileSelect}
            class="file-input"
          />
          {#if uploadFile}
            <div class="file-info">
              ✅ 已选择: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          {/if}
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>采集人</label>
            <input bind:value={collectorName} placeholder="采集人姓名" />
          </div>
          <div class="form-group">
            <label>采集地点</label>
            <input bind:value={collectionLocation} placeholder="如: 广东省梅州市" />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>说话人年龄</label>
            <input bind:value={speakerAge} type="number" placeholder="年龄" />
          </div>
          <div class="form-group">
            <label>说话人性别</label>
            <select bind:value={speakerGender}>
              <option value="">请选择</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>
        </div>
        
        <button 
          class="upload-btn" 
          on:click={handleUpload}
          disabled={!uploadFile || uploading}
        >
          {uploading ? '上传中...' : '开始上传'}
        </button>
      </div>
    </div>
  </div>
  
  <div class="filters">
    <div class="filter-group">
      <label>状态筛选:</label>
      <select bind:value={statusFilter} on:change={loadSamples}>
        <option value="">全部状态</option>
        <option value="unannotated">未标注</option>
        <option value="annotating">标注中</option>
        <option value="submitted">已提交</option>
        <option value="accepted">已通过</option>
        <option value="rejected">已拒绝</option>
      </select>
    </div>
    
    <div class="filter-group">
      <label>地区筛选:</label>
      <input 
        type="text" 
        bind:value={regionFilter} 
        placeholder="输入地区关键词..."
        on:input={loadSamples}
      />
    </div>
  </div>
  
  {#if loading}
    <div class="loading">加载中...</div>
  {:else if audioSamples.length === 0}
    <div class="empty-state card">
      <span class="empty-icon">🎵</span>
      <h3>暂无语音样本</h3>
      <p>上传一些方言语音开始您的标注工作</p>
    </div>
  {:else}
    <div class="results-info">
      <span class="results-count">显示 {audioSamples.length} / {total} 条</span>
    </div>
    
    <div class="samples-grid">
      {#each audioSamples as sample (sample.id)}
        <div class="sample-card card">
          <div class="card-header">
            <h3 class="sample-filename">{sample.originalFilename}</h3>
            <span 
              class="status-badge"
              style="background: {getStatusColor(sample.annotationStatus)}"
            >
              {getStatusLabel(sample.annotationStatus)}
            </span>
          </div>
          
          <div class="sample-meta">
            <div class="meta-item">
              <span class="meta-icon">⏱️</span>
              <span>{sample.duration?.toFixed(2) || 0} 秒</span>
            </div>
            {#if sample.collectionLocation}
              <div class="meta-item">
                <span class="meta-icon">📍</span>
                <span>{sample.collectionLocation}</span>
              </div>
            {/if}
            {#if sample.speakerAge}
              <div class="meta-item">
                <span class="meta-icon">👤</span>
                <span>{sample.speakerAge}岁 {sample.speakerGender === 'male' ? '男' : sample.speakerGender === 'female' ? '女' : ''}</span>
              </div>
            {/if}
            {#if sample.format}
              <div class="meta-item">
                <span class="meta-icon">📁</span>
                <span>{sample.format.toUpperCase()}</span>
              </div>
            {/if}
          </div>
          
          {#if currentPlayingId === sample.id}
            <div class="mini-player">
              <button class="play-btn-small" on:click={stopPlayback}>
                ⏹️
              </button>
              <div class="progress-small">
                <div class="progress-fill" style="width: {(currentTime / (duration || 1)) * 100}%"></div>
              </div>
              <span class="time-small">{formatTime(currentTime)}/{formatTime(duration)}</span>
            </div>
          {:else}
            <button class="play-sample-btn" on:click={() => playSample(sample)}>
              ▶️ 播放试听
            </button>
          {/if}
        </div>
      {/each}
    </div>
    
    {#if hasMore}
      <div class="load-more-section">
        <button 
          class="load-more-btn"
          disabled={loadingMore}
          on:click={loadMore}
        >
          {loadingMore ? '加载中...' : '加载更多'}
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .audio-page {
    padding: 30px;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .page-header {
    margin-bottom: 30px;
    color: white;
  }
  
  .page-header h1 {
    font-size: 32px;
    margin-bottom: 8px;
  }
  
  .page-header p {
    opacity: 0.8;
  }
  
  .card {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
  
  .upload-section {
    margin-bottom: 30px;
  }
  
  .upload-section h2 {
    font-size: 20px;
    color: #2d3748;
    margin-bottom: 20px;
  }
  
  .upload-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .form-group label {
    font-weight: 500;
    color: #4a5568;
    font-size: 14px;
  }
  
  .form-group input,
  .form-group select {
    padding: 10px 14px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.2s;
  }
  
  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #667eea;
  }
  
  .file-input {
    padding: 8px 0;
  }
  
  .file-info {
    padding: 8px 12px;
    background: #f0fff4;
    border-radius: 6px;
    font-size: 13px;
    color: #2f855a;
  }
  
  .upload-btn {
    padding: 12px 24px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    align-self: flex-start;
  }
  
  .upload-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }
  
  .upload-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .filters {
    display: flex;
    gap: 20px;
    margin-bottom: 24px;
    align-items: center;
  }
  
  .filter-group {
    display: flex;
    align-items: center;
    gap: 10px;
    color: white;
  }
  
  .filter-group label {
    font-weight: 500;
    font-size: 14px;
  }
  
  .filter-group select,
  .filter-group input {
    padding: 8px 12px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    background: rgba(255, 255, 255, 0.9);
  }
  
  .loading {
    text-align: center;
    padding: 60px;
    color: white;
    font-size: 18px;
  }
  
  .empty-state {
    text-align: center;
    padding: 60px;
  }
  
  .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }
  
  .empty-state h3 {
    color: #2d3748;
    margin-bottom: 8px;
  }
  
  .empty-state p {
    color: #718096;
  }
  
  .samples-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }
  
  .sample-card {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  
  .sample-filename {
    font-size: 15px;
    font-weight: 600;
    color: #2d3748;
    word-break: break-all;
    margin: 0;
    flex: 1;
  }
  
  .status-badge {
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    color: white;
    white-space: nowrap;
  }
  
  .sample-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #718096;
  }
  
  .meta-icon {
    font-size: 14px;
  }
  
  .play-sample-btn {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .play-sample-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }
  
  .mini-player {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    background: #f7fafc;
    border-radius: 10px;
  }
  
  .play-btn-small {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #ef4444;
    color: white;
    border: none;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .progress-small {
    flex: 1;
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
  }
  
  .progress-small .progress-fill {
    height: 100%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 3px;
  }
  
  .time-small {
    font-size: 12px;
    color: #718096;
    min-width: 70px;
    text-align: right;
  }

  .results-info {
    color: white;
    margin-bottom: 20px;
    font-size: 14px;
    opacity: 0.9;
  }

  .results-count {
    font-weight: 500;
  }

  .load-more-section {
    display: flex;
    justify-content: center;
    padding: 30px 0;
  }

  .load-more-btn {
    padding: 12px 40px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    backdrop-filter: blur(10px);
  }

  .load-more-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }

  .load-more-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
    
    .filters {
      flex-direction: column;
      align-items: stretch;
    }
    
    .samples-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
