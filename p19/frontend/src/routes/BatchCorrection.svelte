<script>
  import { onMount, createEventDispatcher } from 'svelte'
  import { correction } from '../lib/api.js'

  let errors = []
  let selectedIds = new Set()
  let loading = true
  let correcting = false
  let correctionType = 'text'
  let correctionText = ''

  onMount(async () => {
    try {
      const result = await correction.findErrors()
      errors = result.errors || []
    } catch (error) {
      console.error('加载错误失败:', error)
    } finally {
      loading = false
    }
  })

  function toggleSelect(id) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id)
    } else {
      selectedIds.add(id)
    }
    selectedIds = selectedIds
  }

  function selectAll() {
    if (selectedIds.size === errors.length) {
      selectedIds.clear()
    } else {
      errors.forEach(e => selectedIds.add(e.id))
    }
    selectedIds = selectedIds
  }

  async function batchCorrect() {
    if (selectedIds.size === 0) return

    correcting = true
    try {
      const items = Array.from(selectedIds).map(id => ({
        id,
        field: correctionType,
        old_value: errors.find(e => e.id === id)?.current_text || '',
        new_value: correctionText
      }))

      await correction.batchCorrect({
        items,
        reason: '批量修正'
      })

      correctionText = ''
      selectedIds.clear()
      selectedIds = selectedIds

      const result = await correction.findErrors()
      errors = result.errors || []
    } catch (error) {
      console.error('批量修正失败:', error)
    } finally {
      correcting = false
    }
  }

  function getSeverityColor(severity) {
    switch (severity) {
      case 'high': return '#ef4444'
      case 'medium': return '#f59e0b'
      case 'low': return '#10b981'
      default: return '#6b7280'
    }
  }
</script>

<div class="correction-page">
  <div class="page-header">
    <h1>🔧 批量纠错中心</h1>
    <p>自动检测并批量修正标注错误</p>
  </div>

  {#if loading}
    <div class="loading">加载中...</div>
  {:else}
    <div class="content">
      <div class="control-panel">
        <div class="stats">
          <div class="stat-item">
            <span class="stat-label">检测到错误</span>
            <span class="stat-value">{errors.length}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">已选择</span>
            <span class="stat-value">{selectedIds.size}</span>
          </div>
        </div>

        <div class="correction-controls">
          <div class="control-group">
            <label>修正类型</label>
            <select bind:value={correctionType}>
              <option value="text">文本修正</option>
              <option value="phonetic">拼音修正</option>
              <option value="dialect_category">方言分类</option>
              <option value="quality_score">质量评分</option>
            </select>
          </div>

          <div class="control-group full">
            <label>统一修正为</label>
            <input
              type="text"
              bind:value={correctionText}
              placeholder="输入统一的修正值..."
            />
          </div>

          <button
            class="btn-correct"
            disabled={selectedIds.size === 0 || !correctionText || correcting}
            on:click={batchCorrect}
          >
            {correcting ? '修正中...' : `一键修正 ${selectedIds.size} 项`}
          </button>
        </div>
      </div>

      <div class="error-list">
        <div class="list-header">
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={selectedIds.size === errors.length && errors.length > 0}
              on:change={selectAll}
            />
            <span>全选</span>
          </label>
          <span class="header-filename">文件名</span>
          <span class="header-type">错误类型</span>
          <span class="header-severity">严重程度</span>
        </div>

        {#if errors.length === 0}
          <div class="empty-state">
            <span class="empty-icon">✅</span>
            <h3>太棒了！未检测到标注错误</h3>
            <p>所有语料标注质量良好</p>
          </div>
        {:else}
          {#each errors as error}
            <div class="error-item" class:selected={selectedIds.has(error.id)}>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedIds.has(error.id)}
                  on:change={() => toggleSelect(error.id)}
                />
              </label>

              <div class="filename">
                <div class="filename-text">{error.filename}</div>
                <div class="text-preview">
                  <span class="label">当前:</span>
                  <span class="current">{error.current_text || '无'}</span>
                </div>
                {#if error.suggestion}
                  <div class="text-preview">
                    <span class="label">建议:</span>
                    <span class="suggestion">{error.suggestion}</span>
                  </div>
                {/if}
              </div>

              <div class="error-type">
                <span class="type-badge">{error.error_type}</span>
              </div>

              <div class="severity">
                <span
                  class="severity-badge"
                  style="background: {getSeverityColor(error.severity)}"
                >
                  {error.severity === 'high' ? '高' : error.severity === 'medium' ? '中' : '低'}
                </span>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .correction-page {
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
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .control-panel {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }

  .stats {
    display: flex;
    gap: 40px;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e2e8f0;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-label {
    font-size: 14px;
    color: #718096;
  }

  .stat-value {
    font-size: 32px;
    font-weight: 700;
    color: #667eea;
  }

  .correction-controls {
    display: grid;
    grid-template-columns: 200px 1fr 200px;
    gap: 16px;
    align-items: end;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .control-group.full {
    grid-column: span 1;
  }

  .control-group label {
    font-size: 14px;
    font-weight: 600;
    color: #4a5568;
  }

  .control-group select,
  .control-group input {
    padding: 12px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 14px;
    transition: all 0.2s;
  }

  .control-group select:focus,
  .control-group input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .btn-correct {
    padding: 12px 20px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-correct:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-correct:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-list {
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    overflow: hidden;
  }

  .list-header {
    display: grid;
    grid-template-columns: 60px 1fr 150px 120px;
    gap: 16px;
    padding: 16px 20px;
    background: #f7fafc;
    border-bottom: 2px solid #e2e8f0;
    font-weight: 600;
    color: #4a5568;
    font-size: 14px;
    align-items: center;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    color: #4a5568;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #667eea;
  }

  .error-item {
    display: grid;
    grid-template-columns: 60px 1fr 150px 120px;
    gap: 16px;
    padding: 16px 20px;
    border-bottom: 1px solid #e2e8f0;
    transition: background 0.2s;
    align-items: center;
  }

  .error-item:hover {
    background: #f7fafc;
  }

  .error-item.selected {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05));
  }

  .filename-text {
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 6px;
  }

  .text-preview {
    display: flex;
    gap: 8px;
    font-size: 13px;
    margin-bottom: 4px;
  }

  .text-preview .label {
    color: #718096;
  }

  .text-preview .current {
    color: #ef4444;
  }

  .text-preview .suggestion {
    color: #10b981;
  }

  .type-badge {
    padding: 6px 12px;
    background: #e2e8f0;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    color: #4a5568;
  }

  .severity-badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    color: white;
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

  @media (max-width: 1024px) {
    .correction-controls {
      grid-template-columns: 1fr;
    }

    .list-header,
    .error-item {
      grid-template-columns: 40px 1fr;
    }

    .header-type,
    .header-severity,
    .error-type,
    .severity {
      display: none;
    }
  }
</style>
