<template>
  <div class="register-container">
    <div class="register-box">
      <h1>3D Scene Editor</h1>
      <h2>Register</h2>
      <el-form @submit.prevent="handleRegister">
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
          <el-input
            v-model="confirmPassword"
            type="password"
            placeholder="Confirm Password"
            size="large"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            @click="handleRegister"
            style="width: 100%"
          >
            Register
          </el-button>
        </el-form-item>
        <div class="login-link">
          Already have an account? 
          <router-link to="/login">Login</router-link>
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
const confirmPassword = ref('');

const handleRegister = async () => {
  if (password.value !== confirmPassword.value) {
    ElMessage.error('Passwords do not match');
    return;
  }

  try {
    await authStore.register(username.value, password.value);
    ElMessage.success('Registration successful!');
    router.push('/');
  } catch (err) {
    ElMessage.error('Registration failed. Please try again.');
  }
};
</script>

<style scoped>
.register-container {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.register-box {
  background: #252526;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  width: 400px;
}

.register-box h1 {
  color: #ffffff;
  text-align: center;
  margin-bottom: 8px;
  font-size: 24px;
}

.register-box h2 {
  color: #cccccc;
  text-align: center;
  margin-bottom: 24px;
  font-size: 18px;
  font-weight: normal;
}

.login-link {
  text-align: center;
  color: #888888;
  font-size: 14px;
}

.login-link a {
  color: #4fc3f7;
  text-decoration: none;
}

.login-link a:hover {
  text-decoration: underline;
}
</style>
