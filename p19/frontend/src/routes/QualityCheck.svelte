<script>
  import { onMount } from 'svelte'
  import { qualityCheck, audio } from '../lib/api.js'

  let pendingSamples = []
  let stats = null
  let loading = true
  let selectedSample = null
  let checkScore = 0.8
  let checkComment = ''
  let filterPassed = false

  onMount(async () => {
    try {
      [pendingSamples, stats] = await Promise.all([
        qualityCheck.getPending(),
        qualityCheck.getStats()
      ])
    } catch (error) {
      console.error('加载失败:', error)
    } finally {
      loading = false
    }
  })

  async function handleAutoSample() {
    try {
      const result = await qualityCheck.autoSample(10)
      alert(result.message)
      pendingSamples = await qualityCheck.getPending()
    } catch (error) {
      alert('自动抽样失败: ' + error.message)
    }
  }

  async function submitCheck(passed) {
    if (!selectedSample) return

    try {
      await qualityCheck.submitCheck(selectedSample.id, passed, checkScore, checkComment)
      alert('审核提交成功')
      
      pendingSamples = pendingSamples.filter(s => s.id !== selectedSample.id)
      stats = await qualityCheck.getStats()
      selectedSample = null
      checkComment = ''
    } catch (error) {
      alert('提交失败: ' + error.message)
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'passed': return '#10b981'
      case 'failed': return '#ef4444'
      default: return '#6b7280'
    }
  }
</script>

<div class="quality-page">
  <div class="page-header">
    <h1>🔍 语料质量抽检</h1>
    <p>自动发现并审核标注质量问题</p>
  </div>

  {#if loading}
    <div class="loading">加载中...</div>
  {:else}
    <div class="content">
      <div class="stats-panel">
        <h3>📊 统计概览</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value">{stats?.total_checked || 0}</span>
            <span class="stat-label">已审核</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{stats?.pending_count || 0}</span>
            <span class="stat-label">待审核</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{stats?.pass_rate || 0}%</span>
            <span class="stat-label">通过率</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{stats?.average_score || 0}</span>
            <span class="stat-label">平均质量分</span>
          </div>
        </div>
        <button class="btn-sample" on:click={handleAutoSample}>
          🎲 自动抽取10条审核
        </button>
      </div>

      <div class="main-content">
        <div class="pending-list">
          <div class="list-header">
            <h3>📋 待审核列表 ({pendingSamples.length})</h3>
          </div>
          
          {#if pendingSamples.length === 0}
            <div class="empty-list">
              <span class="empty-icon">✅</span>
              <p>暂无待审核语料</p>
            </div>
          {:else}
            <div class="sample-items">
              {#each pendingSamples as sample}
                <div 
                  class="sample-item"
                  class:active={selectedSample?.id === sample.id}
                  on:click={() => selectedSample = sample}
                >
                  <div class="sample-info">
                    <span class="filename">{sample.original_filename}</span>
                    <span class="annotator">标注: {sample.annotator || '未知'}</span>
                  </div>
                  {#if sample.annotation_text}
                    <div class="text-preview">{sample.annotation_text}</div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>

        {#if selectedSample}
          <div class="check-panel">
            <h3>✏️ 审核标注</h3>
            
            <div class="sample-detail">
              <label>文件名</label>
              <div class="value">{selectedSample.original_filename}</div>
            </div>

            <div class="sample-detail">
              <label>标注文本</label>
              <div class="value text-value">{selectedSample.annotation_text || '无标注'}</div>
            </div>

            <div class="sample-detail">
              <label>标注人员</label>
              <div class="value">{selectedSample.annotator || '未知'}</div>
            </div>

            <div class="score-section">
              <label>质量评分: <span class="score-value">{checkScore.toFixed(2)}</span></label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                bind:value={checkScore}
                class="score-slider"
              />
              <div class="scale-labels">
                <span>低</span>
                <span>中</span>
                <span>高</span>
              </div>
            </div>

            <div class="comment-section">
              <label>审核备注</label>
              <textarea 
                bind:value={checkComment}
                placeholder="输入审核意见..."
                rows="3"
              ></textarea>
            </div>

            <div class="action-buttons">
              <button class="btn btn-pass" on:click={() => submitCheck(true)}>
                ✓ 通过
              </button>
              <button class="btn btn-reject" on:click={() => submitCheck(false)}>
                ✗ 驳回
              </button>
            </div>

            {#if selectedSample.status && selectedSample.status !== 'pending'}
              <div class="status-badge" style="background: {getStatusColor(selectedSample.status)}">
                {selectedSample.status === 'passed' ? '已通过' : '已驳回'}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .quality-page {
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
    grid-template-columns: 280px 1fr;
    gap: 20px;
  }

  .stats-panel {
    background: white;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    height: fit-content;
  }

  .stats-panel h3 {
    margin: 0 0 16px 0;
    color: #2d3748;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }

  .stat-card {
    background: #f7fafc;
    padding: 12px;
    border-radius: 10px;
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 22px;
    font-weight: 700;
    color: #667eea;
  }

  .stat-label {
    font-size: 12px;
    color: #718096;
  }

  .btn-sample {
    width: 100%;
    padding: 10px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .btn-sample:hover {
    transform: translateY(-2px);
  }

  .main-content {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 20px;
  }

  .pending-list {
    background: white;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    max-height: 70vh;
    overflow-y: auto;
  }

  .list-header {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e2e8f0;
  }

  .list-header h3 {
    margin: 0;
    color: #2d3748;
  }

  .empty-list {
    text-align: center;
    padding: 40px;
    color: #718096;
  }

  .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
  }

  .sample-items {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sample-item {
    padding: 14px;
    background: #f7fafc;
    border-radius: 10px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s;
  }

  .sample-item:hover {
    background: #edf2f7;
  }

  .sample-item.active {
    border-color: #667eea;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05));
  }

  .sample-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .filename {
    font-weight: 600;
    color: #2d3748;
    word-break: break-all;
    font-size: 14px;
  }

  .annotator {
    font-size: 12px;
    color: #718096;
  }

  .text-preview {
    font-size: 13px;
    color: #4a5568;
    padding: 8px;
    background: white;
    border-radius: 6px;
    word-break: break-all;
  }

  .check-panel {
    background: white;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    height: fit-content;
  }

  .check-panel h3 {
    margin: 0 0 16px 0;
    color: #2d3748;
  }

  .sample-detail {
    margin-bottom: 16px;
  }

  .sample-detail label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #718096;
    margin-bottom: 6px;
  }

  .sample-detail .value {
    padding: 10px;
    background: #f7fafc;
    border-radius: 8px;
    color: #2d3748;
    word-break: break-all;
  }

  .text-value {
    min-height: 60px;
  }

  .score-section {
    margin-bottom: 20px;
  }

  .score-section label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #4a5568;
    margin-bottom: 10px;
  }

  .score-value {
    color: #667eea;
  }

  .score-slider {
    width: 100%;
    margin-bottom: 8px;
  }

  .scale-labels {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #718096;
  }

  .comment-section {
    margin-bottom: 20px;
  }

  .comment-section label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #4a5568;
    margin-bottom: 8px;
  }

  .comment-section textarea {
    width: 100%;
    padding: 10px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 14px;
    resize: vertical;
  }

  .action-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .btn {
    padding: 12px;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-pass {
    background: #10b981;
    color: white;
  }

  .btn-pass:hover {
    background: #059669;
  }

  .btn-reject {
    background: #ef4444;
    color: white;
  }

  .btn-reject:hover {
    background: #dc2626;
  }

  .status-badge {
    margin-top: 16px;
    padding: 8px 16px;
    border-radius: 20px;
    text-align: center;
    color: white;
    font-weight: 600;
  }

  @media (max-width: 1024px) {
    .content {
      grid-template-columns: 1fr;
    }
    
    .main-content {
      grid-template-columns: 1fr;
    }
  }
</style>
