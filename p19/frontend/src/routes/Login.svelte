<script>
  import { authStore } from '../lib/store.js'
  import { navigate } from 'svelte-routing'
  
  let isLogin = true
  let username = ''
  let password = ''
  let email = ''
  let fullName = ''
  let region = ''
  let role = 'annotator'
  let error = ''
  let loading = false
  
  async function handleSubmit() {
    error = ''
    loading = true
    
    try {
      if (isLogin) {
        await authStore.login(username, password)
        navigate('/')
      } else {
        await authStore.register({
          username,
          password,
          email,
          fullName,
          region,
          role
        })
        isLogin = true
        error = '注册成功，请登录'
      }
    } catch (err) {
      error = err.message
    } finally {
      loading = false
    }
  }
</script>

<div class="auth-container">
  <div class="auth-card">
    <div class="auth-header">
      <span class="auth-icon">🎙️</span>
      <h1>{isLogin ? '登录' : '注册'}</h1>
      <p>方言语料标注平台</p>
    </div>
    
    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    
    <form on:submit|preventDefault={handleSubmit} class="auth-form">
      <div class="form-group">
        <label>用户名</label>
        <input
          type="text"
          bind:value={username}
          placeholder="请输入用户名"
          required
        />
      </div>
      
      <div class="form-group">
        <label>密码</label>
        <input
          type="password"
          bind:value={password}
          placeholder="请输入密码"
          required
        />
      </div>
      
      {#if !isLogin}
        <div class="form-group">
          <label>邮箱</label>
          <input
            type="email"
            bind:value={email}
            placeholder="请输入邮箱"
          />
        </div>
        
        <div class="form-group">
          <label>姓名</label>
          <input
            type="text"
            bind:value={fullName}
            placeholder="请输入姓名"
          />
        </div>
        
        <div class="form-group">
          <label>地区</label>
          <input
            type="text"
            bind:value={region}
            placeholder="请输入所在地区"
          />
        </div>
        
        <div class="form-group">
          <label>角色</label>
          <select bind:value={role}>
            <option value="annotator">标注员</option>
            <option value="reviewer">审核员</option>
            <option value="manager">管理员</option>
          </select>
        </div>
      {/if}
      
      <button type="submit" class="submit-btn" disabled={loading}>
        {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
      </button>
    </form>
    
    <div class="auth-footer">
      <button class="toggle-btn" on:click={() => isLogin = !isLogin}>
        {isLogin ? '没有账号？去注册' : '已有账号？去登录'}
      </button>
    </div>
  </div>
</div>

<style>
  .auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .auth-card {
    background: white;
    border-radius: 20px;
    padding: 40px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  
  .auth-header {
    text-align: center;
    margin-bottom: 30px;
  }
  
  .auth-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 10px;
  }
  
  .auth-header h1 {
    font-size: 28px;
    color: #2d3748;
    margin-bottom: 8px;
  }
  
  .auth-header p {
    color: #718096;
    font-size: 14px;
  }
  
  .error-message {
    background: #fee2e2;
    color: #dc2626;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    text-align: center;
    font-size: 14px;
  }
  
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .form-group label {
    font-size: 14px;
    font-weight: 500;
    color: #4a5568;
  }
  
  .form-group input,
  .form-group select {
    padding: 12px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 14px;
    transition: border-color 0.2s;
  }
  
  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #667eea;
  }
  
  .submit-btn {
    margin-top: 10px;
    padding: 14px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }
  
  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .auth-footer {
    margin-top: 24px;
    text-align: center;
  }
  
  .toggle-btn {
    background: none;
    border: none;
    color: #667eea;
    font-size: 14px;
    cursor: pointer;
    text-decoration: underline;
  }
  
  .toggle-btn:hover {
    color: #764ba2;
  }
</style>
