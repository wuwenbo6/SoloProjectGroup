<template>
  <div class="editor-container">
    <div class="editor-header">
      <input 
        v-model="localTitle" 
        @blur="updateDocumentTitle"
        class="title-input"
        placeholder="文档标题"
      />
      <div class="status-bar">
        <span :class="['status', isOnline ? 'online' : 'offline']">
          {{ isOnline ? '● 在线' : '○ 离线' }}
        </span>
        <span class="pending" v-if="pendingUpdatesCount > 0">
          待同步: {{ pendingUpdatesCount }}
        </span>
        <span class="users">在线: {{ onlineUsers.length }} 人</span>
      </div>
    </div>
    <textarea ref="textareaRef" class="codemirror-textarea"></textarea>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';
import { useDocumentStore } from '../store/document';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/mode/markdown/markdown';
import { CodemirrorBinding } from 'y-codemirror';

const documentStore = useDocumentStore();
const { 
  content, 
  title, 
  isOnline, 
  onlineUsers, 
  ytext, 
  ydoc,
  insertImageAtCursor,
  pendingUpdates
} = documentStore;

const textareaRef = ref(null);
const cm = ref(null);
const localTitle = ref(title);
let binding = null;

const pendingUpdatesCount = computed(() => pendingUpdates.length);

watch(() => title, (newTitle) => {
  localTitle.value = newTitle;
});

function updateDocumentTitle() {
  const { ytitle } = documentStore;
  if (ytitle) {
    ytitle.delete(0, ytitle.length);
    ytitle.insert(0, localTitle.value);
  }
}

function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

async function handleImagePaste(file, position) {
  try {
    await insertImageAtCursor(file, position);
  } catch (error) {
    console.error('Failed to insert image:', error);
    alert('图片上传失败: ' + error.message);
  }
}

onMounted(async () => {
  await nextTick();

  cm.value = CodeMirror.fromTextArea(textareaRef.value, {
    mode: 'markdown',
    theme: 'monokai',
    lineNumbers: true,
    lineWrapping: true,
    indentUnit: 2,
    tabSize: 2,
    autofocus: true
  });

  if (ytext && ydoc) {
    binding = new CodemirrorBinding(ytext, cm.value, ydoc.awareness);
  }

  const unwatchYText = watch(() => documentStore.ytext, (newYText) => {
    if (newYText && cm.value && !binding) {
      binding = new CodemirrorBinding(newYText, cm.value, documentStore.ydoc.awareness);
    }
  });

  cm.value.on('paste', (cm, e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          const cursor = cm.getCursor();
          const pos = cm.indexFromPos(cursor);
          handleImagePaste(file, pos);
          break;
        }
      }
    }
  });

  cm.value.on('drop', (cm, e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.indexOf('image') !== -1) {
        const pos = cm.coordsChar({ left: e.clientX, top: e.clientY });
        const index = cm.indexFromPos(pos);
        handleImagePaste(file, index);
      }
    }
  });

  onUnmounted(() => {
    unwatchYText();
    if (binding) {
      binding.destroy();
    }
    if (cm.value) {
      cm.value.toTextArea();
    }
  });
});
</script>

<style scoped>
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid #e0e0e0;
}

.editor-header {
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-input {
  font-size: 18px;
  font-weight: 600;
  border: none;
  background: transparent;
  outline: none;
  flex: 1;
  margin-right: 16px;
}

.status-bar {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #666;
}

.status.online {
  color: #4caf50;
}

.status.offline {
  color: #f44336;
}

.pending {
  color: #ff9800;
  font-weight: 500;
}

:deep(.CodeMirror) {
  flex: 1;
  font-family: 'Fira Code', 'Monaco', monospace;
  font-size: 14px;
  height: 100% !important;
}

:deep(.CodeMirror-scroll) {
  height: 100% !important;
}
</style>
