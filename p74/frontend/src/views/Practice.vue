<template>
  <div class="practice-page">
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button @click="goBack" :icon="ArrowLeft">返回</el-button>
          <h1>{{ t('practice.title') }}</h1>
        </div>
        <div class="header-right">
          <LangSwitch />
        </div>
      </el-header>
      
      <el-main class="main">
        <StitchPractice />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LangSwitch from '@/components/LangSwitch.vue'
import StitchPractice from '@/components/Practice/StitchPractice.vue'

const router = useRouter()
const { t } = useI18n()

const goBack = () => {
  router.push('/')
}
</script>

<style scoped>
.practice-page {
  min-height: 100vh;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 30px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header h1 {
  color: white;
  font-size: 20px;
  margin: 0;
}

.main {
  padding: 0;
}
</style>
