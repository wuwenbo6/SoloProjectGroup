<script>
  import { authStore, isAdmin, isManager, isReviewer } from '../lib/store.js'
  import { navigate } from 'svelte-routing'
  
  let showMenu = false
  
  function handleLogout() {
    authStore.logout()
    navigate('/login')
  }
</script>

<nav class="navbar">
  <div class="nav-container">
    <div class="nav-brand" on:click={() => navigate('/')}>
      <span class="brand-icon">🎙️</span>
      <span class="brand-text">方言语料标注平台</span>
    </div>
    
    {#if $authStore.isAuthenticated}
      <button class="menu-toggle" on:click={() => showMenu = !showMenu}>
        ☰
      </button>
      
      <div class="nav-links" class:active={showMenu}>
        <a href="/" on:click|preventDefault={() => navigate('/')}>首页</a>
        <a href="/annotation" on:click|preventDefault={() => navigate('/annotation')}>标注工作台</a>
        <a href="/audio" on:click|preventDefault={() => navigate('/audio')}>语音试听</a>
        <a href="/tasks" on:click|preventDefault={() => navigate('/tasks')}>任务中心</a>
        <a href="/dialect-tree" on:click|preventDefault={() => navigate('/dialect-tree')}>方言谱系</a>
        <a href="/pronunciation" on:click|preventDefault={() => navigate('/pronunciation')}>读音对比</a>
        {#if $isReviewer || $isManager}
          <a href="/correction" on:click|preventDefault={() => navigate('/correction')}>批量纠错</a>
          <a href="/quality-check" on:click|preventDefault={() => navigate('/quality-check')}>质量抽检</a>
        {/if}
        {#if $isResearcher || $isManager}
          <a href="/research" on:click|preventDefault={() => navigate('/research')}>研究数据</a>
        {/if}
        {#if $isManager}
          <a href="/dialects" on:click|preventDefault={() => navigate('/dialects')}>方言分类</a>
        {/if}
        {#if $isAdmin}
          <a href="/users" on:click|preventDefault={() => navigate('/users')}>用户管理</a>
        {/if}
        
        <div class="user-menu">
          <span class="user-name">{$authStore.user?.fullName || $authStore.user?.username}</span>
          <span class="user-role">{$authStore.user?.role}</span>
          <button class="logout-btn" on:click={handleLogout}>退出</button>
        </div>
      </div>
    {/if}
  </div>
</nav>

<style>
  .navbar {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 1000;
  }
  
  .nav-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 64px;
  }
  
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    text-decoration: none;
  }
  
  .brand-icon {
    font-size: 28px;
  }
  
  .brand-text {
    font-size: 18px;
    font-weight: 700;
    color: #4a5568;
    background: linear-gradient(135deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .menu-toggle {
    display: none;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    padding: 8px;
  }
  
  .nav-links {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .nav-links a {
    padding: 8px 16px;
    text-decoration: none;
    color: #4a5568;
    font-weight: 500;
    border-radius: 6px;
    transition: all 0.2s;
  }
  
  .nav-links a:hover {
    background: rgba(102, 126, 234, 0.1);
    color: #667eea;
  }
  
  .user-menu {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: 20px;
    padding-left: 20px;
    border-left: 1px solid #e2e8f0;
  }
  
  .user-name {
    font-weight: 600;
    color: #2d3748;
  }
  
  .user-role {
    font-size: 12px;
    padding: 2px 8px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border-radius: 10px;
    text-transform: capitalize;
  }
  
  .logout-btn {
    padding: 6px 16px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s;
  }
  
  .logout-btn:hover {
    background: #dc2626;
  }
  
  @media (max-width: 1024px) {
    .menu-toggle {
      display: block;
    }
    
    .nav-links {
      display: none;
      position: absolute;
      top: 64px;
      left: 0;
      right: 0;
      background: white;
      flex-direction: column;
      padding: 20px;
      gap: 10px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    }
    
    .nav-links.active {
      display: flex;
    }
    
    .nav-links a {
      width: 100%;
      text-align: center;
    }
    
    .user-menu {
      margin-left: 0;
      padding-left: 0;
      border-left: none;
      flex-direction: column;
      gap: 8px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      width: 100%;
    }
  }
</style>
