<script>
  import { onMount } from 'svelte'
  import { pronunciation, audio } from '../lib/api.js'

  let samples = []
  let loading = true
  let selectedSample = null
  let comparisonData = null

  let dialectPlaying = false
  let standardPlaying = false
  let dialectAudio = null
  let standardAudio = null

  onMount(async () => {
    try {
      const result = await pronunciation.withStandard()
      samples = result.samples || []
    } catch (error) {
      console.error('加载失败:', error)
    } finally {
      loading = false
    }
  })

  async function selectSample(sample) {
    selectedSample = sample
    try {
      comparisonData = await pronunciation.compare(sample.id)

      dialectAudio = new Audio(comparisonData.dialect_audio_url)
      standardAudio = new Audio(comparisonData.standard_audio_url)

      dialectAudio.addEventListener('ended', () => {
        dialectPlaying = false
      })
      standardAudio.addEventListener('ended', () => {
        standardPlaying = false
      })
    } catch (error) {
      console.error('获取对比数据失败:', error)
    }
  }

  function toggleDialectAudio() {
    if (!dialectAudio) return

    if (dialectPlaying) {
      dialectAudio.pause()
    } else {
      if (standardAudio && standardPlaying) {
        standardAudio.pause()
        standardPlaying = false
      }
      dialectAudio.play()
    }
    dialectPlaying = !dialectPlaying
  }

  function toggleStandardAudio() {
    if (!standardAudio) return

    if (standardPlaying) {
      standardAudio.pause()
    } else {
      if (dialectAudio && dialectPlaying) {
        dialectAudio.pause()
        dialectPlaying = false
      }
      standardAudio.play()
    }
    standardPlaying = !standardPlaying
  }

  function playBoth() {
    if (dialectAudio && standardAudio) {
      dialectAudio.currentTime = 0
      standardAudio.currentTime = 0
      dialectAudio.play()
      dialectPlaying = true
      standardPlaying = true
    }
  }

  function stopAll() {
    if (dialectAudio) dialectAudio.pause()
    if (standardAudio) standardAudio.pause()
    dialectPlaying = false
    standardPlaying = false
  }
</script>

<div class="pronunciation-page">
  <div class="page-header">
    <h1>🎵 方言读音对比试听</h1>
    <p>方言语音与标准读音的对比分析</p>
  </div>

  {#if loading}
    <div class="loading">加载中...</div>
  {:else}
    <div class="content">
      <div class="sidebar">
        <div class="list-header">
          <h3>已标注语音列表</h3>
          <span class="count">共 {samples.length} 条</span>
        </div>

        <div class="sample-list">
          {#each samples as sample}
            <div
              class="sample-item"
              class:active={selectedSample?.id === sample.id}
              on:click={() => selectSample(sample)}
            >
              <div class="sample-name">{sample.filename}</div>
              <div class="sample-meta">
                {#if sample.similarity_score}
                  <span class="similarity" class:high={sample.similarity_score > 0.8}>
                    相似度 {Math.round(sample.similarity_score * 100)}%
                  </span>
                {/if}
                {#if sample.standard_source}
                  <span class="source">{sample.standard_source}</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="main">
        {#if !selectedSample}
          <div class="empty-state">
            <span class="empty-icon">👆</span>
            <h3>请选择一条语音进行对比</h3>
            <p>从左侧列表中选择一条已有标准读音的语料</p>
          </div>
        {:else if comparisonData}
          <div class="comparison-card">
            <div class="card-header">
              <h2>{selectedSample.filename}</h2>
              <div class="similarity-badge" class:high={comparisonData.similarity_score > 0.8}>
                相似度 {Math.round((comparisonData.similarity_score || 0) * 100)}%
              </div>
            </div>

            <div class="text-comparison">
              <div class="text-section">
                <h4>方言标注文本</h4>
                <div class="text-content dialect-text">
                  {comparisonData.dialect_text || '暂无标注'}
                </div>
              </div>
              {#if comparisonData.standard_text}
                <div class="text-section">
                  <h4>标准读音文本</h4>
                  <div class="text-content standard-text">
                    {comparisonData.standard_text}
                  </div>
                </div>
              {/if}
            </div>

            <div class="audio-players">
              <div class="audio-player">
                <div class="player-header">
                  <span class="player-label">🎙️ 方言语音</span>
                  {#if dialectPlaying}
                    <span class="playing-indicator">播放中...</span>
                  {/if}
                </div>
                <button
                  class="play-button dialect"
                  class:playing={dialectPlaying}
                  on:click={toggleDialectAudio}
                >
                  {dialectPlaying ? '⏸️' : '▶️'}
                  <span>{dialectPlaying ? '暂停' : '播放方言'}</span>
                </button>
              </div>

              <div class="audio-player">
                <div class="player-header">
                  <span class="player-label">🎵 标准读音</span>
                  {#if standardPlaying}
                    <span class="playing-indicator">播放中...</span>
                  {/if}
                </div>
                <button
                  class="play-button standard"
                  class:playing={standardPlaying}
                  on:click={toggleStandardAudio}
                >
                  {standardPlaying ? '⏸️' : '▶️'}
                  <span>{standardPlaying ? '暂停' : '播放标准'}</span>
                </button>
              </div>
            </div>

            <div class="action-buttons">
              <button class="btn btn-primary" on:click={playBoth}>
                🔄 对比播放
              </button>
              <button class="btn btn-secondary" on:click={stopAll}>
                ⏹️ 停止全部
              </button>
            </div>

            {#if comparisonData.dialect_category}
              <div class="category-info">
                <h4>方言分类</h4>
                <p>ID: {comparisonData.dialect_category.id}</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .pronunciation-page {
    padding: 24px;
    min-height: calc(100vh - 64px);
  }

  .page-header {
    color: white;
    margin-bottom: 24px;
  }

  .page-header h1 {
    margin: 0 0 8px 0;
    font-size: 28px;
  }

  .page-header p {
    margin: 0;
    opacity: 0.9;
  }

  .loading {
    text-align: center;
    padding: 60px;
    color: white;
    font-size: 18px;
  }

  .content {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 24px;
  }

  .sidebar {
    background: white;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    max-height: 70vh;
    overflow-y: auto;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .list-header h3 {
    margin: 0;
    color: #2d3748;
  }

  .count {
    font-size: 14px;
    color: #718096;
    background: #e2e8f0;
    padding: 4px 12px;
    border-radius: 12px;
  }

  .sample-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sample-item {
    padding: 12px 16px;
    border-radius: 10px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s;
  }

  .sample-item:hover {
    background: #f7fafc;
  }

  .sample-item.active {
    border-color: #667eea;
    background: linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1));
  }

  .sample-name {
    font-weight: 500;
    color: #2d3748;
    margin-bottom: 6px;
    word-break: break-all;
    font-size: 14px;
  }

  .sample-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .similarity {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 10px;
    background: #e2e8f0;
    color: #718096;
  }

  .similarity.high {
    background: #c6f6d5;
    color: #22543d;
  }

  .source {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 10px;
    background: #bee3f8;
    color: #2a4365;
  }

  .main {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    min-height: 400px;
  }

  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: #718096;
  }

  .empty-icon {
    font-size: 64px;
    display: block;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    color: #4a5568;
  }

  .comparison-card {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 2px solid #e2e8f0;
  }

  .card-header h2 {
    margin: 0;
    color: #2d3748;
    font-size: 20px;
    word-break: break-all;
  }

  .similarity-badge {
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: 600;
    background: #e2e8f0;
    color: #4a5568;
  }

  .similarity-badge.high {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
  }

  .text-comparison {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .text-section h4 {
    margin: 0 0 12px 0;
    color: #4a5568;
    font-size: 14px;
  }

  .text-content {
    padding: 16px;
    border-radius: 10px;
    min-height: 80px;
    line-height: 1.6;
  }

  .dialect-text {
    background: #fff5f5;
    border: 2px solid #fc8181;
  }

  .standard-text {
    background: #f0fff4;
    border: 2px solid #9ae6b4;
  }

  .audio-players {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .audio-player {
    padding: 20px;
    border-radius: 12px;
    background: #f7fafc;
  }

  .player-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .player-label {
    font-weight: 600;
    color: #4a5568;
  }

  .playing-indicator {
    font-size: 12px;
    color: #667eea;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .play-button {
    width: 100%;
    padding: 14px 20px;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .play-button.dialect {
    background: linear-gradient(135deg, #fc8181, #f56565);
    color: white;
  }

  .play-button.standard {
    background: linear-gradient(135deg, #68d391, #48bb78);
    color: white;
  }

  .play-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  .play-button.playing {
    opacity: 0.9;
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    padding-top: 8px;
  }

  .btn {
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102,126,234,0.4);
  }

  .btn-secondary {
    background: #e2e8f0;
    color: #4a5568;
  }

  .btn-secondary:hover {
    background: #cbd5e0;
  }

  .category-info {
    padding: 16px;
    background: #f7fafc;
    border-radius: 10px;
  }

  .category-info h4 {
    margin: 0 0 8px 0;
    color: #4a5568;
    font-size: 14px;
  }

  .category-info p {
    margin: 0;
    color: #718096;
  }
</style>
