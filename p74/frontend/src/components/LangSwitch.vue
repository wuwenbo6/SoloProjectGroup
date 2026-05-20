<template>
  <el-dropdown @command="changeLang" trigger="click">
    <span class="lang-switch">
      <el-icon><Location /></el-icon>
      <span>{{ currentLangName }}</span>
      <el-icon class="el-icon--right"><ArrowDown /></el-icon>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="zh-CN" :class="{ active: locale === 'zh-CN' }">
          🇨🇳 中文
        </el-dropdown-item>
        <el-dropdown-item command="en-US" :class="{ active: locale === 'en-US' }">
          🇺🇸 English
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const currentLangName = computed(() => {
  return locale.value === 'zh-CN' ? '中文' : 'English'
})

const changeLang = (lang) => {
  locale.value = lang
  localStorage.setItem('locale', lang)
  location.reload()
}
</script>

<style scoped>
.lang-switch {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  font-size: 14px;
  color: #606266;
  padding: 5px 10px;
  border-radius: 4px;
  transition: all 0.3s;
}

.lang-switch:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.active {
  color: #409eff;
  font-weight: bold;
}
</style>
