<template>
  <div class="login-container">
    <div class="login-box">
      <h1>3D Scene Editor</h1>
      <h2>Login</h2>
      <el-form @submit.prevent="handleLogin">
        <el-form-item>
          <el-input
            v-model="username"
            placeholder="Username"
            size="large"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="password"
            type="password"
            placeholder="Password"
            size="large"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            @click="handleLogin"
            style="width: 100%"
          >
            Login
          </el-button>
        </el-form-item>
        <div class="register-link">
          Don't have an account? 
          <router-link to="/register">Register</router-link>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';
import { ElMessage } from 'element-plus';

const router = useRouter();
const authStore = useAuthStore();

const username = ref('');
const password = ref('');

const handleLogin = async () => {
  try {
    await authStore.login(username.value, password.value);
    ElMessage.success('Login successful!');
    router.push('/');
  } catch (err) {
    ElMessage.error('Login failed. Please check your credentials.');
  }
};
</script>

<style scoped>
.login-container {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.login-box {
  background: #252526;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  width: 400px;
}

.login-box h1 {
  color: #ffffff;
  text-align: center;
  margin-bottom: 8px;
  font-size: 24px;
}

.login-box h2 {
  color: #cccccc;
  text-align: center;
  margin-bottom: 24px;
  font-size: 18px;
  font-weight: normal;
}

.register-link {
  text-align: center;
  color: #888888;
  font-size: 14px;
}

.register-link a {
  color: #4fc3f7;
  text-decoration: none;
}

.register-link a:hover {
  text-decoration: underline;
}
</style>
