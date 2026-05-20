<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <el-icon class="logo-icon"><VideoPlay /></el-icon>
          <h2>皮影道具采集系统</h2>
        </div>
      </template>
      <el-form :model="loginForm" label-width="80px" @submit.prevent="handleLogin">
        <el-form-item label="用户名">
          <el-input v-model="loginForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="login-btn" @click="handleLogin" :loading="loading">登录</el-button>
        </el-form-item>
      </el-form>
      <div class="tip">
        <p>测试账号：admin / admin</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { userApi } from '../api'

const router = useRouter()
const loading = ref(false)
const loginForm = ref({
  username: '',
  password: ''
})

const handleLogin = async () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  
  loading.value = true
  try {
    const res = await userApi.login(loginForm.value)
    localStorage.setItem('user', JSON.stringify(res.data))
    ElMessage.success('登录成功')
    router.push('/')
  } catch (error) {
    console.error('登录失败:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-card {
  width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.logo-icon {
  font-size: 28px;
  color: #667eea;
}
.card-header h2 {
  margin: 0;
  font-size: 22px;
}
.login-btn {
  width: 100%;
}
.tip {
  margin-top: 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}
.tip p {
  margin: 5px 0;
}

@media (max-width: 768px) {
  .login-card {
    width: 90%;
    max-width: 350px;
    margin: 20px;
  }
  .card-header h2 {
    font-size: 18px;
  }
}
</style>
