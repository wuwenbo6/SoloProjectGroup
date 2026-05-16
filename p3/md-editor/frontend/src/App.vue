<template>
  <div class="app">
    <header class="app-header">
      <h1>📝 Markdown 协作编辑器</h1>
      <div class="header-actions">
        <button @click="createNewDoc" class="btn btn-primary">新建文档</button>
        <button @click="togglePublic" class="btn btn-secondary">
          {{ isPublic ? '设为私有' : '设为公开' }}
        </button>
      </div>
    </header>

    <main class="app-main">
      <Editor />
      <Preview />
    </main>

    <footer class="app-footer">
      <span>文档 ID: {{ currentDocumentId || '未加载' }}</span>
      <span v-if="pendingUpdates.length > 0" class="pending">
        待同步: {{ pendingUpdates.length }} 个操作
      </span>
      <span v-if="!isOnline" class="offline">离线模式</span>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useDocumentStore } from './store/document';
import Editor from './components/Editor.vue';
import Preview from './components/Preview.vue';

const documentStore = useDocumentStore();
const {
  connect,
  joinDocument,
  createNewDocument,
  currentDocumentId,
  pendingUpdates,
  setPermission,
  isOnline
} = documentStore;

const isPublic = ref(false);

async function createNewDoc() {
  const newId = await createNewDocument();
  joinDocument(newId);
}

function togglePublic() {
  isPublic.value = !isPublic.value;
  setPermission(isPublic.value);
}

onMounted(() => {
  connect();
  const defaultDocId = 'demo-document-002';
  joinDocument(defaultDocId);
});
</script>

<style>
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}

#app {
  height: 100%;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-header {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:hover {
  opacity: 0.9;
}

.btn-primary {
  background: white;
  color: #667eea;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.app-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
}

.app-footer {
  padding: 8px 24px;
  background: #f5f5f5;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #666;
}

.pending {
  color: #f59e0b;
  font-weight: 500;
}

.offline {
  color: #f44336;
  font-weight: 500;
}
</style>
