<script>
  import { onMount } from 'svelte'
  import { navigate } from 'svelte-routing'
  import { tasks } from '../lib/api.js'
  import { authStore } from '../lib/store.js'
  
  let availableTasks = []
  let myTasks = []
  let loading = true
  let activeTab = 'available'
  
  onMount(loadTasks)
  
  async function loadTasks() {
    loading = true
    try {
      const [available, mine] = await Promise.all([
        tasks.getAvailable(),
        tasks.getAll({ myTasks: true })
      ])
      availableTasks = available
      myTasks = mine
    } catch (error) {
      console.error('加载任务失败:', error)
    } finally {
      loading = false
    }
  }
  
  async function claimTask(taskId) {
    try {
      await tasks.claim(taskId)
      await loadTasks()
      alert('任务领取成功！')
    } catch (error) {
      alert('领取失败: ' + error.message)
    }
  }
  
  async function releaseTask(taskId) {
    if (!confirm('确定要放弃这个任务吗？')) return
    
    try {
      await tasks.release(taskId)
      await loadTasks()
      alert('任务已放弃')
    } catch (error) {
      alert('放弃失败: ' + error.message)
    }
  }
  
  async function startTask(task) {
    try {
      await tasks.start(task.id)
      await loadTasks()
      navigate('/annotation')
    } catch (error) {
      alert('启动失败: ' + error.message)
    }
  }
  
  function getStatusLabel(status) {
    const labels = {
      pending: '待领取',
      assigned: '已分配',
      in_progress: '进行中',
      submitted: '已提交',
      completed: '已完成',
      rejected: '已拒绝'
    }
    return labels[status] || status
  }
  
  function getStatusColor(status) {
    const colors = {
      pending: '#48bb78',
      assigned: '#63b3ed',
      in_progress: '#f6ad55',
      submitted: '#667eea',
      completed: '#38a169',
      rejected: '#fc8181'
    }
    return colors[status] || '#718096'
  }
  
  function getPriorityLabel(priority) {
    const labels = { 1: '低', 2: '中', 3: '高' }
    return labels[priority] || '中'
  }
  
  function getPriorityColor(priority) {
    const colors = { 1: '#718096', 2: '#f6ad55', 3: '#e53e3e' }
    return colors[priority] || '#718096'
  }
</script>

<div class="tasks-page">
  <div class="page-header">
    <h1>标注任务中心</h1>
    <p>领取和管理您的方言标注任务</p>
  </div>
  
  <div class="tabs">
    <button 
      class="tab-btn"
      class:active={activeTab === 'available'}
      on:click={() => activeTab = 'available'}
    >
      可领取任务 ({availableTasks.length})
    </button>
    <button 
      class="tab-btn"
      class:active={activeTab === 'mine'}
      on:click={() => activeTab = 'mine'}
    >
      我的任务 ({myTasks.length})
    </button>
  </div>
  
  {#if loading}
    <div class="loading">加载中...</div>
  {:else}
    {#if activeTab === 'available'}
      {#if availableTasks.length === 0}
        <div class="empty-state card">
          <span class="empty-icon">📦</span>
          <h3>暂无可用任务</h3>
          <p>请稍后再来查看新任务</p>
        </div>
      {:else}
        <div class="tasks-grid">
          {#each availableTasks as task}
            <div class="task-card card">
              <div class="task-header">
                <h3 class="task-title">{task.title}</h3>
                <span class="priority-badge" style="background: {getPriorityColor(task.priority)}">
                  {getPriorityLabel(task.priority)}优先级
                </span>
              </div>
              
              {#if task.description}
                <p class="task-description">{task.description}</p>
              {/if}
              
              <div class="task-meta">
                {#if task.region}
                  <div class="meta-item">
                    <span class="meta-icon">📍</span>
                    <span>{task.region}</span>
                  </div>
                {/if}
                <div class="meta-item">
                  <span class="meta-icon">📊</span>
                  <span>进度: {Math.round(task.progress * 100)}%</span>
                </div>
              </div>
              
              <div class="task-actions">
                <button class="btn btn-primary" on:click={() => claimTask(task.id)}>
                  🎯 领取任务
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      {#if myTasks.length === 0}
        <div class="empty-state card">
          <span class="empty-icon">📝</span>
          <h3>您还没有任务</h3>
          <p>去可领取任务区挑选一些任务吧</p>
          <button class="btn btn-primary" on:click={() => activeTab = 'available'}>
            去领取任务
          </button>
        </div>
      {:else}
        <div class="tasks-grid">
          {#each myTasks as task}
            <div class="task-card card">
              <div class="task-header">
                <h3 class="task-title">{task.title}</h3>
                <span class="status-badge" style="background: {getStatusColor(task.status)}">
                  {getStatusLabel(task.status)}
                </span>
              </div>
              
              {#if task.description}
                <p class="task-description">{task.description}</p>
              {/if}
              
              <div class="task-progress">
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" style="width: {task.progress * 100}%"></div>
                </div>
                <span class="progress-text">{Math.round(task.progress * 100)}%</span>
              </div>
              
              <div class="task-meta">
                {#if task.region}
                  <div class="meta-item">
                    <span class="meta-icon">📍</span>
                    <span>{task.region}</span>
                  </div>
                {/if}
                {#if task.assignedAt}
                  <div class="meta-item">
                    <span class="meta-icon">📅</span>
                    <span>领取于: {new Date(task.assignedAt).toLocaleDateString()}</span>
                  </div>
                {/if}
              </div>
              
              <div class="task-actions">
                {#if task.status === 'assigned'}
                  <button class="btn btn-primary" on:click={() => startTask(task)}>
                    ▶️ 开始标注
                  </button>
                {/if}
                {#if task.status === 'in_progress'}
                  <a href="/annotation" class="btn btn-primary">
                    ✏️ 继续标注
                  </a>
                {/if}
                {#if task.status !== 'completed'}
                  <button class="btn btn-secondary" on:click={() => releaseTask(task.id)}>
                    ❌ 放弃任务
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .tasks-page {
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
  
  .tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
  }
  
  .tab-btn {
    padding: 12px 24px;
    border: none;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .tab-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  .tab-btn.active {
    background: white;
    color: #667eea;
  }
  
  .card {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
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
    margin-bottom: 20px;
  }
  
  .tasks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
  }
  
  .task-card {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  
  .task-title {
    font-size: 17px;
    font-weight: 600;
    color: #2d3748;
    margin: 0;
    flex: 1;
    line-height: 1.4;
  }
  
  .status-badge,
  .priority-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    color: white;
    white-space: nowrap;
  }
  
  .task-description {
    color: #718096;
    font-size: 14px;
    line-height: 1.5;
    margin: 0;
  }
  
  .task-progress {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .progress-bar-bg {
    flex: 1;
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 4px;
    transition: width 0.3s;
  }
  
  .progress-text {
    font-size: 13px;
    font-weight: 600;
    color: #667eea;
    min-width: 40px;
  }
  
  .task-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
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
  
  .task-actions {
    display: flex;
    gap: 10px;
    margin-top: auto;
  }
  
  .btn {
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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
  
  @media (max-width: 768px) {
    .tasks-grid {
      grid-template-columns: 1fr;
    }
    
    .tabs {
      flex-direction: column;
    }
  }
</style>
