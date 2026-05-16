<template>
  <div class="preview-container">
    <div class="preview-header">
      <h3>预览</h3>
      <div class="online-users">
        <span v-for="user in onlineUsers" :key="user.userId" class="user-avatar">
          {{ user.userName.slice(-2) }}
        </span>
      </div>
    </div>
    <div class="preview-content" v-html="renderedContent"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDocumentStore } from '../store/document'
import { marked } from 'marked'

const documentStore = useDocumentStore()
const { content, onlineUsers } = documentStore

marked.setOptions({
  breaks: true,
  gfm: true
})

const renderedContent = computed(() => {
  return marked(content || '')
})
</script>

<style scoped>
.preview-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.preview-header {
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.online-users {
  display: flex;
  gap: 4px;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 500;
}

.preview-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
}

.preview-content :deep(h1) {
  font-size: 2em;
  margin: 0.67em 0;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 0.3em;
}

.preview-content :deep(h2) {
  font-size: 1.5em;
  margin: 0.83em 0;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 0.3em;
}

.preview-content :deep(h3) {
  font-size: 1.25em;
  margin: 1em 0;
}

.preview-content :deep(p) {
  margin: 1em 0;
}

.preview-content :deep(code) {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
}

.preview-content :deep(pre) {
  background: #272822;
  color: #f8f8f2;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
}

.preview-content :deep(pre code) {
  background: none;
  padding: 0;
}

.preview-content :deep(blockquote) {
  border-left: 4px solid #667eea;
  padding-left: 16px;
  margin: 1em 0;
  color: #666;
}

.preview-content :deep(ul),
.preview-content :deep(ol) {
  padding-left: 2em;
  margin: 1em 0;
}

.preview-content :deep(li) {
  margin: 0.5em 0;
}

.preview-content :deep(img) {
  max-width: 100%;
  border-radius: 6px;
}

.preview-content :deep(a) {
  color: #667eea;
  text-decoration: none;
}

.preview-content :deep(a:hover) {
  text-decoration: underline;
}

.preview-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

.preview-content :deep(th),
.preview-content :deep(td) {
  border: 1px solid #e0e0e0;
  padding: 8px 12px;
  text-align: left;
}

.preview-content :deep(th) {
  background: #f5f5f5;
}
</style>
