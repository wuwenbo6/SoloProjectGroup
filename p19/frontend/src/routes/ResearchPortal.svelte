<script>
  import { onMount } from 'svelte'
  import { research } from '../lib/api.js'

  let stats = null
  let dialectDistribution = []
  let qualityReport = null
  let leaderboard = []
  let lexicon = null
  let loading = true
  let activeTab = 'overview'
  let selectedDays = 30

  onMount(async () => {
    try {
      [stats, dialectDistribution, leaderboard] = await Promise.all([
        research.getStats(),
        research.getDialectDistribution(),
        research.getAnnotatorLeaderboard(selectedDays)
      ])
    } catch (error) {
      console.error('加载研究数据失败:', error)
    } finally {
      loading = false
    }
  })

  async function loadQualityReport() {
    try {
      qualityReport = await research.getQualityReport(selectedDays)
    } catch (error) {
      alert('加载质量报告失败: ' + error.message)
    }
  }

  async function loadLexicon() {
    try {
      lexicon = await research.getDialectLexicon()
    } catch (error) {
      alert('加载词汇表失败: ' + error.message)
    }
  }

  async function exportData() {
    try {
      const result = await research.exportCsv({
        include_annotations: true,
        quality_min: 0.7
      })
      alert(`导出成功! 共 ${result.total_records} 条记录`)
      console.log('导出预览:', result.preview)
    } catch (error) {
      alert('导出失败: ' + error.message)
    }
  }

  function formatNumber(num) {
    return num?.toFixed(2) || '0'
  }
</script>

<div class="research-page">
  <div class="page-header">
    <h1>📚 方言语料研究数据中心</h1>
    <p>为方言研究人员提供专业的数据分析与导出服务</p>
  </div>

  {#if loading}
    <div class="loading">加载中...</div>
  {:else}
    <div class="content">
      <div class="sidebar">
        <div class="menu-item" class:active={activeTab === 'overview'} on:click={() => activeTab = 'overview'}>
          <span class="icon">📊</span>
          <span>数据概览</span>
        </div>
        <div class="menu-item" class:active={activeTab === 'dialects'} on:click={() => activeTab = 'dialects'}>
          <span class="icon">🗺️</span>
          <span>方言分布</span>
        </div>
        <div class="menu-item" class:active={activeTab === 'quality'} on:click={() => { activeTab = 'quality'; loadQualityReport() }}>
          <span class="icon">📈</span>
          <span>质量报告</span>
        </div>
        <div class="menu-item" class:active={activeTab === 'leaderboard'} on:click={() => activeTab = 'leaderboard'}>
          <span class="icon">🏆</span>
          <span>标注排行</span>
        </div>
        <div class="menu-item" class:active={activeTab === 'lexicon'} on:click={() => { activeTab = 'lexicon'; loadLexicon() }}>
          <span class="icon">📖</span>
          <span>方言词汇</span>
        </div>
        <div class="menu-divider"></div>
        <button class="export-btn" on:click={exportData}>
          💾 导出研究数据
        </button>
      </div>

      <div class="main-content">
        {#if activeTab === 'overview'}
          <div class="overview-panel">
            <h2>📊 语料数据概览</h2>
            
            <div class="stats-grid">
              <div class="stat-card large">
                <span class="stat-value">{stats?.total_corpora || 0}</span>
                <span class="stat-label">语料总条数</span>
              </div>
              <div class="stat-card large">
                <span class="stat-value">{formatNumber(stats?.total_duration_hours)}h</span>
                <span class="stat-label">总时长（小时）</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">{formatNumber(stats?.average_score)}</span>
                <span class="stat-label">平均质量分</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">{stats?.annotator_count || 0}</span>
                <span class="stat-label">标注人数</span>
              </div>
            </div>

            <div class="section">
              <h3>📈 近7天增长趋势</h3>
              <div class="growth-chart">
                {#each stats?.growth_trend || [] as day}
                  <div class="chart-bar-container">
                    <div class="chart-bar" style="height: {Math.max(day.count * 3, 10)}px"></div>
                    <span class="chart-label">{day.date.slice(8, 10)}</span>
                  </div>
                {/each}
              </div>
            </div>

            <div class="section">
              <h3>🎯 质量分布</h3>
              <div class="quality-bars">
                {#each stats?.quality_distribution || [] as q}
                  <div class="quality-item">
                    <span class="quality-label">{q.level}</span>
                    <div class="quality-bar">
                      <div class="quality-fill" style="width: {Math.min(q.count * 0.5, 100)}%"></div>
                    </div>
                    <span class="quality-count">{q.count}</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}

        {#if activeTab === 'dialects'}
          <div class="dialects-panel">
            <h2>🗺️ 方言分布详情</h2>
            
            <div class="distribution-list">
              {#each dialectDistribution as dialect}
                <div class="dialect-card">
                  <div class="dialect-header">
                    <span class="dialect-name">{dialect.category_name}</span>
                    <span class="dialect-code">{dialect.code}</span>
                  </div>
                  <div class="dialect-meta">
                    <span class="dialect-region">📍 {dialect.region || '未知区域'}</span>
                    <span class="dialect-level">Level {dialect.level}</span>
                  </div>
                  <div class="dialect-stats">
                    <span class="sample-count">{dialect.sample_count} 条语料</span>
                    <span class="checked-count">{dialect.checked_count} 条已质检</span>
                  </div>
                  {#if dialect.description}
                    <div class="dialect-desc">{dialect.description}</div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if activeTab === 'quality'}
          <div class="quality-panel">
            <h2>📈 标注质量分析报告</h2>
            
            <div class="report-controls">
              <label>统计周期:</label>
              <select bind:value={selectedDays} on:change={loadQualityReport}>
                <option value={7}>最近7天</option>
                <option value={30}>最近30天</option>
                <option value={90}>最近90天</option>
              </select>
            </div>

            {#if qualityReport}
              <div class="report-summary">
                <div class="report-stat">
                  <span class="value">{qualityReport.total_checked}</span>
                  <span class="label">总审核数</span>
                </div>
                <div class="report-stat">
                  <span class="value">{qualityReport.average_quality_score}</span>
                  <span class="label">平均质量分</span>
                </div>
              </div>

              {#if qualityReport.annotator_ranking && qualityReport.annotator_ranking.length > 0}
                <div class="ranking-section">
                  <h3>🏆 标注人员质量排行</h3>
                  <div class="ranking-list">
                    {#each qualityReport.annotator_ranking as (rank, idx)}
                      <div class="ranking-item">
                        <span class="rank-num">#{idx + 1}</span>
                        <span class="rank-name">{rank.annotator_name || '未知'}</span>
                        <span class="rank-count">{rank.annotation_count} 条</span>
                        <span class="rank-score">{rank.average_score} 分</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {:else}
              <div class="loading-small">正在生成质量报告...</div>
            {/if}
          </div>
        {/if}

        {#if activeTab === 'leaderboard'}
          <div class="leaderboard-panel">
            <h2>🏆 标注人员排行榜</h2>
            
            <div class="leaderboard-list">
              {#each leaderboard as (user, idx)}
                <div class="leaderboard-item">
                  <span class="rank">{idx + 1}</span>
                  <div class="user-info">
                    <span class="username">{user.username || '匿名用户'}</span>
                    <span class="user-id">ID: {user.annotator_id}</span>
                  </div>
                  <div class="user-stats">
                    <span class="accepted-count">{user.accepted_count} 条通过</span>
                    <span class="quality-score">{user.average_quality || '-'} 平均质量</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if activeTab === 'lexicon'}
          <div class="lexicon-panel">
            <h2>📖 方言词汇表</h2>
            
            {#if lexicon}
              <div class="lexicon-stats">
                <span>共 {lexicon.total_unique_words} 个词汇，展示前 {lexicon.lexicon_entries} 个高频词</span>
              </div>
              
              <div class="word-cloud">
                {#each lexicon.lexicon || [] as word}
                  <span 
                    class="word-tag"
                    class:common={word.is_dialect}
                    title="出现次数: {word.frequency}"
                  >
                    {word.word}
                  </span>
                {/each}
              </div>
            {:else}
              <div class="loading-small">正在生成词汇表...</div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .research-page {
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

  .loading-small {
    text-align: center;
    padding: 40px;
    color: #718096;
  }

  .content {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 20px;
  }

  .sidebar {
    background: white;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    height: fit-content;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    cursor: pointer;
    color: #4a5568;
    transition: all 0.2s;
    margin-bottom: 4px;
  }

  .menu-item:hover {
    background: #f7fafc;
  }

  .menu-item.active {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
  }

  .menu-divider {
    height: 1px;
    background: #e2e8f0;
    margin: 12px 0;
  }

  .export-btn {
    width: 100%;
    padding: 12px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .export-btn:hover {
    background: #059669;
    transform: translateY(-2px);
  }

  .main-content {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    min-height: 500px;
  }

  .overview-panel h2,
  .dialects-panel h2,
  .quality-panel h2,
  .leaderboard-panel h2,
  .lexicon-panel h2 {
    margin: 0 0 24px 0;
    color: #2d3748;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }

  .stat-card {
    background: #f7fafc;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
  }

  .stat-card.large {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  }

  .stat-value {
    display: block;
    font-size: 28px;
    font-weight: 700;
    color: #667eea;
    margin-bottom: 8px;
  }

  .stat-label {
    font-size: 14px;
    color: #718096;
  }

  .section {
    margin-bottom: 32px;
  }

  .section h3 {
    margin: 0 0 16px 0;
    color: #4a5568;
    font-size: 18px;
  }

  .growth-chart {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    height: 150px;
    padding: 20px;
    background: #f7fafc;
    border-radius: 12px;
  }

  .chart-bar-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .chart-bar {
    width: 30px;
    background: linear-gradient(to top, #667eea, #764ba2);
    border-radius: 4px 4px 0 0;
  }

  .chart-label {
    font-size: 12px;
    color: #718096;
  }

  .quality-bars {
    background: #f7fafc;
    padding: 20px;
    border-radius: 12px;
  }

  .quality-item {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .quality-label {
    width: 60px;
    font-size: 14px;
    color: #4a5568;
  }

  .quality-bar {
    flex: 1;
    height: 20px;
    background: #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
  }

  .quality-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea, #764ba2);
    border-radius: 10px;
  }

  .quality-count {
    width: 50px;
    text-align: right;
    font-size: 14px;
    color: #718096;
  }

  .distribution-list {
    display: grid;
    gap: 16px;
  }

  .dialect-card {
    padding: 20px;
    background: #f7fafc;
    border-radius: 12px;
    border-left: 4px solid #667eea;
  }

  .dialect-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .dialect-name {
    font-weight: 600;
    color: #2d3748;
    font-size: 16px;
  }

  .dialect-code {
    font-size: 12px;
    color: #667eea;
    background: rgba(102, 126, 234, 0.1);
    padding: 4px 10px;
    border-radius: 10px;
  }

  .dialect-meta {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
    font-size: 13px;
    color: #718096;
  }

  .dialect-stats {
    display: flex;
    gap: 16px;
    font-size: 14px;
  }

  .sample-count {
    color: #667eea;
    font-weight: 500;
  }

  .checked-count {
    color: #10b981;
  }

  .dialect-desc {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    font-size: 13px;
    color: #718096;
  }

  .report-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .report-controls label {
    font-weight: 500;
    color: #4a5568;
  }

  .report-controls select {
    padding: 8px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
  }

  .report-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 32px;
  }

  .report-stat {
    background: #f7fafc;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
  }

  .report-stat .value {
    display: block;
    font-size: 32px;
    font-weight: 700;
    color: #667eea;
    margin-bottom: 4px;
  }

  .report-stat .label {
    font-size: 14px;
    color: #718096;
  }

  .ranking-section h3 {
    margin: 0 0 16px 0;
    color: #4a5568;
  }

  .ranking-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ranking-item {
    display: grid;
    grid-template-columns: 60px 1fr 100px 100px;
    align-items: center;
    padding: 12px 16px;
    background: #f7fafc;
    border-radius: 10px;
  }

  .rank-num {
    font-weight: 700;
    color: #667eea;
  }

  .rank-name {
    font-weight: 500;
    color: #2d3748;
  }

  .rank-count, .rank-score {
    text-align: right;
    font-size: 14px;
    color: #718096;
  }

  .rank-score {
    color: #10b981;
  }

  .leaderboard-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .leaderboard-item {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 16px 20px;
    background: #f7fafc;
    border-radius: 12px;
  }

  .leaderboard-item:nth-child(1) {
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.1));
  }

  .leaderboard-item:nth-child(2) {
    background: linear-gradient(135deg, rgba(192, 192, 192, 0.2), rgba(169, 169, 169, 0.1));
  }

  .leaderboard-item:nth-child(3) {
    background: linear-gradient(135deg, rgba(205, 127, 50, 0.2), rgba(184, 115, 51, 0.1));
  }

  .rank {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #667eea;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 18px;
  }

  .user-info {
    flex: 1;
  }

  .username {
    display: block;
    font-weight: 600;
    color: #2d3748;
    font-size: 16px;
  }

  .user-id {
    font-size: 12px;
    color: #718096;
  }

  .user-stats {
    text-align: right;
  }

  .accepted-count {
    display: block;
    font-weight: 500;
    color: #10b981;
  }

  .quality-score {
    font-size: 12px;
    color: #718096;
  }

  .lexicon-stats {
    margin-bottom: 20px;
    padding: 12px;
    background: #f7fafc;
    border-radius: 10px;
    color: #4a5568;
  }

  .word-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .word-tag {
    padding: 6px 14px;
    background: #e2e8f0;
    border-radius: 20px;
    font-size: 14px;
    color: #4a5568;
    transition: all 0.2s;
  }

  .word-tag.common {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
    color: #667eea;
    font-weight: 500;
  }

  .word-tag:hover {
    transform: scale(1.05);
  }

  @media (max-width: 1024px) {
    .content {
      grid-template-columns: 1fr;
    }
    
    .stats-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
