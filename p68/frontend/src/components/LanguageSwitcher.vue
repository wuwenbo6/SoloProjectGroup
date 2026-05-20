<template>
  <el-dropdown @command="changeLanguage" trigger="click">
    <span class="language-switcher">
      <el-icon><Translate /></el-icon>
      <span>{{ currentLangLabel }}</span>
      <el-icon class="el-icon--right"><ArrowDown /></el-icon>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="zh-CN" :disabled="i18n.locale === 'zh-CN'">
          简体中文
        </el-dropdown-item>
        <el-dropdown-item command="en-US" :disabled="i18n.locale === 'en-US'">
          English
        </el-dropdown-item>
        <el-dropdown-item command="ja-JP" :disabled="i18n.locale === 'ja-JP'">
          日本語
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Translate, ArrowDown } from '@element-plus/icons-vue'

const { locale } = useI18n()
const i18n = useI18n()

const currentLangLabel = computed(() => {
  const labels = {
    'zh-CN': '简体中文',
    'en-US': 'English',
    'ja-JP': '日本語'
  }
  return labels[locale.value] || '简体中文'
})

const changeLanguage = (lang) => {
  locale.value = lang
  localStorage.setItem('language', lang)
}
</script>

<style scoped>
.language-switcher {
  display: flex;
  align-items: center;
  gap: 5px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.language-switcher:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>
