<template>
  <div class="login-container">
    <div class="login-box">
      <h1 class="title">刺绣针法教学操作台</h1>
      <el-tabs v-model="activeTab" class="login-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" ref="loginFormRef" label-width="80px">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="loginForm.username" placeholder="请输入用户名" />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleLogin" style="width: 100%">登录</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="注册" name="register">
          <el-form :model="registerForm" ref="registerFormRef" label-width="80px">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="registerForm.username" placeholder="请输入用户名" />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="registerForm.password" type="password" placeholder="请输入密码" show-password />
            </el-form-item>
            <el-form-item label="角色" prop="role">
              <el-select v-model="registerForm.role" style="width: 100%">
                <el-option label="学员" value="student" />
                <el-option label="教师" value="teacher" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleRegister" style="width: 100%">注册</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <div class="tip">
        <p>测试账号：student / 123456（学员）</p>
        <p>测试账号：teacher / 123456（教师）</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authAPI } from '@/api'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref('login')
const loginForm = ref({
  username: '',
  password: ''
})
const registerForm = ref({
  username: '',
  password: '',
  role: 'student'
})

const handleLogin = async () => {
  try {
    const res = await authAPI.login(loginForm.value)
    if (res.success) {
      userStore.login(res.user, res.token)
      ElMessage.success('登录成功')
      router.push('/')
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '登录失败')
  }
}

const handleRegister = async () => {
  try {
    const res = await authAPI.register(registerForm.value)
    if (res.success) {
      userStore.login(res.user, res.token)
      ElMessage.success('注册成功')
      router.push('/')
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '注册失败')
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.login-box {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  width: 450px;
}

.title {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
  font-size: 24px;
}

.login-tabs {
  margin-bottom: 20px;
}

.tip {
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
  font-size: 12px;
  color: #666;
}

.tip p {
  margin: 5px 0;
}
</style>
