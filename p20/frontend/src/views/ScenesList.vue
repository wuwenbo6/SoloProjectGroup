<template>
  <div class="scenes-container">
    <div class="header">
      <h1>My Scenes</h1>
      <div class="header-actions">
        <el-button type="primary" @click="showCreateDialog = true">
          Create New Scene
        </el-button>
        <el-button @click="joinScene">
          Join Scene
        </el-button>
        <el-button @click="logout">
          Logout
        </el-button>
      </div>
    </div>

    <div class="scenes-grid" v-if="scenes.length > 0">
      <div 
        v-for="scene in scenes" 
        :key="scene.id"
        class="scene-card"
        @click="openScene(scene.id)"
      >
        <div class="scene-preview">
          <div class="preview-placeholder">
            <svg viewBox="0 0 100 100" fill="none">
              <rect x="20" y="30" width="60" height="40" fill="#4fc3f7" opacity="0.3" transform="rotate(-10 50 50)"/>
              <circle cx="50" cy="50" r="15" fill="#7c4dff" opacity="0.5"/>
            </svg>
          </div>
        </div>
        <div class="scene-info">
          <h3>{{ scene.name }}</h3>
          <p>{{ formatDate(scene.created_at) }}</p>
        </div>
      </div>
    </div>

    <div class="empty-state" v-else>
      <h3>No scenes yet</h3>
      <p>Create your first 3D scene to start collaborating!</p>
      <el-button type="primary" @click="showCreateDialog = true">
        Create Scene
      </el-button>
    </div>

    <el-dialog
      v-model="showCreateDialog"
      title="Create New Scene"
      width="400px"
    >
      <el-form>
        <el-form-item label="Scene Name">
          <el-input v-model="newSceneName" placeholder="Enter scene name" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">Cancel</el-button>
        <el-button type="primary" @click="createScene">Create</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showJoinDialog"
      title="Join Scene"
      width="400px"
    >
      <el-form>
        <el-form-item label="Scene ID">
          <el-input v-model="joinSceneId" placeholder="Enter scene ID" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showJoinDialog = false">Cancel</el-button>
        <el-button type="primary" @click="confirmJoinScene">Join</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';
import socketService from '../services/socket';
import api from '../services/api';
import { ElMessage } from 'element-plus';

const router = useRouter();
const authStore = useAuthStore();

const scenes = ref([]);
const showCreateDialog = ref(false);
const showJoinDialog = ref(false);
const newSceneName = ref('Untitled Scene');
const joinSceneId = ref('');

const fetchScenes = async () => {
  try {
    const response = await api.get('/scenes');
    scenes.value = response.data;
  } catch (err) {
    console.error('Failed to fetch scenes:', err);
  }
};

const createScene = async () => {
  try {
    const response = await api.post('/scenes', { name: newSceneName.value });
    showCreateDialog.value = false;
    newSceneName.value = 'Untitled Scene';
    ElMessage.success('Scene created!');
    router.push(`/scene/${response.data.id}`);
  } catch (err) {
    ElMessage.error('Failed to create scene');
  }
};

const joinScene = () => {
  showJoinDialog.value = true;
};

const confirmJoinScene = async () => {
  try {
    await api.post(`/scenes/${joinSceneId.value}/join`);
    showJoinDialog.value = false;
    joinSceneId.value = '';
    ElMessage.success('Joined scene!');
    await fetchScenes();
  } catch (err) {
    ElMessage.error('Failed to join scene');
  }
};

const openScene = (sceneId) => {
  router.push(`/scene/${sceneId}`);
};

const logout = () => {
  authStore.logout();
  socketService.disconnect();
  router.push('/login');
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

onMounted(async () => {
  socketService.connect(authStore.token);
  await fetchScenes();
});
</script>

<style scoped>
.scenes-container {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 40px;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.header h1 {
  color: #ffffff;
  font-size: 32px;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.scenes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 24px;
}

.scene-card {
  background: #252526;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.scene-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.scene-preview {
  height: 150px;
  background: #1e1e1e;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-placeholder svg {
  width: 80px;
  height: 80px;
}

.scene-info {
  padding: 16px;
}

.scene-info h3 {
  color: #ffffff;
  margin: 0 0 8px 0;
  font-size: 16px;
}

.scene-info p {
  color: #888888;
  margin: 0;
  font-size: 12px;
}

.empty-state {
  text-align: center;
  padding: 80px 40px;
  color: #888888;
}

.empty-state h3 {
  color: #cccccc;
  margin-bottom: 12px;
}

.empty-state p {
  margin-bottom: 24px;
}
</style>
