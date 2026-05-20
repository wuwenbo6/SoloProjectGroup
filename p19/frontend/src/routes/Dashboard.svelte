<script>
  import { onMount } from 'svelte'
  import { annotations } from '../lib/api.js'
  
  let stats = null
  let loading = true
  
  onMount(async () => {
    try {
      stats = await annotations.getStats()
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      loading = false
    }
  })
  
  function formatPercent(value, total) {
    if (!total) return '0%'
    return ((value / total) * 100).toFixed(1) + '%'
  }
</script>

<div class="dashboard">
  <div class="dashboard-header">
    <h1>数据概览</h1>
    <p>欢迎使用方言语料标注平台</p>
  </div>
  
  {#if loading}
    <div class="loading">加载中...</div>
  {:else if stats}
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">🎵</div>
        <div class="stat-content">
          <div class="stat-value">{stats.total_samples}</div>
          <div class="stat-label">语音样本总数</div>
        </div>
        <div class="stat-progress">
          <div class="progress-bar" style="width: {formatPercent(stats.annotated_samples, stats.total_samples)}"></div>
        </div>
      </div>
      
      <div class="stat-card highlight">
        <div class="stat-icon">✍️</div>
        <div class="stat-content">
          <div class="stat-value">{stats.annotated_samples}</div>
          <div class="stat-label">已标注样本</div>
        </div>
        <div class="stat-percent">
          {formatPercent(stats.annotated_samples, stats.total_samples)}
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <div class="stat-value">{stats.pending_tasks}</div>
          <div class="stat-label">待领取任务</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">⏳</div>
        <div class="stat-content">
          <div class="stat-value">{stats.in_progress_tasks}</div>
          <div class="stat-label">进行中任务</div>
        </div>
      </div>
      
      <div class="stat-card success">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">{stats.completed_tasks}</div>
          <div class="stat-label">已完成任务</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-content">
          <div class="stat-value">{stats.total_users}</div>
          <div class="stat-label">平台用户数</div>
        </div>
      </div>
      
      <div class="stat-card dialect">
        <div class="stat-icon">🗣️</div>
        <div class="stat-content">
          <div class="stat-value">{stats.dialect_categories}</div>
          <div class="stat-label">方言分类数</div>
        </div>
      </div>
    </div>
    
    <div class="quick-actions">
      <h2>快捷操作</h2>
      <div class="actions-grid">
        <a href="/annotation" class="action-card">
          <span class="action-icon">📝</span>
          <span class="action-text">开始标注</span>
        </a>
        <a href="/tasks" class="action-card">
          <span class="action-icon">📦</span>
          <span class="action-text">领取任务</span>
        </a>
        <a href="/audio" class="action-card">
          <span class="action-icon">🎧</span>
          <span class="action-text">试听语音</span>
        </a>
        <a href="/upload" class="action-card">
          <span class="action-icon">⬆️</span>
          <span class="action-text">上传语料</span>
        </a>
      </div>
    </div>
  {/if}
</div>

<style>
  .dashboard {
    padding: 30px;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .dashboard-header {
    margin-bottom: 30px;
  }
  
  .dashboard-header h1 {
    font-size: 32px;
    color: #fff;
    margin-bottom: 8px;
  }
  
  .dashboard-header p {
    color: rgba(255, 255, 255, 0.8);
    font-size: 16px;
  }
  
  .loading {
    text-align: center;
    padding: 60px;
    color: white;
    font-size: 18px;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
  }
  
  .stat-card {
    background: white;
    border-radius: 16px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s;
  }
  
  .stat-card:hover {
    transform: translateY(-4px);
  }
  
  .stat-card.highlight {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
  }
  
  .stat-card.success {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  }
  
  .stat-card.dialect {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
  }
  
  .stat-icon {
    font-size: 32px;
  }
  
  .stat-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .stat-value {
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
  }
  
  .stat-label {
    font-size: 14px;
    opacity: 0.8;
  }
  
  .stat-percent {
    font-size: 18px;
    font-weight: 600;
    opacity: 0.9;
  }
  
  .stat-progress {
    height: 6px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }
  
  .progress-bar {
    height: 100%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 3px;
    transition: width 0.5s ease;
  }
  
  .quick-actions h2 {
    color: white;
    font-size: 24px;
    margin-bottom: 20px;
  }
  
  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
  
  .action-card {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: #4a5568;
    font-weight: 600;
    transition: all 0.2s;
  }
  
  .action-card:hover {
    background: white;
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
  
  .action-icon {
    font-size: 36px;
  }
  
  .action-text {
    font-size: 16px;
  }
</style>
