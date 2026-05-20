<template>
  <div class="editor-container">
    <div class="editor-header">
      <el-button @click="goBack" :icon="ArrowLeft">Back</el-button>
      <div class="scene-title">
        <h2>Scene: {{ sceneId }}</h2>
        <el-tag size="small" type="info" class="branch-tag">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M10.59 13.41c.41.39.91.59 1.41.59s1-.2 1.41-.59c.79-.78.79-2.04 0-2.83-.39-.39-.9-.59-1.41-.59s-1 .2-1.41.59c-.78.79-.78 2.05 0 2.83zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          </svg>
          {{ currentBranch?.name || 'loading...' }}
        </el-tag>
      </div>
      <div class="header-actions">
        <div class="online-users">
          <span class="dot"></span>
          <span>Collaborative Editing</span>
        </div>
        <el-button size="small" @click="showBranchPanel = !showBranchPanel">
          分支管理
        </el-button>
      </div>
    </div>
    <div class="editor-content">
      <div class="left-panel" :class="{ expanded: showBranchPanel }">
        <div class="panel-tabs">
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'properties' }"
            @click="activeTab = 'properties'"
          >
            属性
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'branches' }"
            @click="activeTab = 'branches'"
          >
            分支
          </button>
        </div>
        
        <div class="panel-content">
          <div v-show="activeTab === 'properties'">
            <PropertyPanel />
          </div>
          <div v-show="activeTab === 'branches'" class="branch-panel-wrapper">
            <BranchManager
              :scene-id="sceneId"
              :current-branch-id="currentBranch?.id"
              @branch-switch="handleBranchSwitch"
              @commit-created="handleCommitCreated"
              @merge-completed="handleMergeCompleted"
            />
          </div>
        </div>
      </div>
      
      <div class="viewport-wrapper">
        <ThreeViewport
          :objects="sceneStore.objects"
          :selected-object-id="sceneStore.selectedObjectId"
          @select-object="selectObject"
          @transform-change="handleTransformChange"
        />
      </div>
    </div>
    <AudioCallPanel 
      :userId="authStore.userId"
      :username="authStore.user?.username"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSceneStore } from '../store/scene';
import { useAuthStore } from '../store/auth';
import socketService from '../services/socket';
import webrtcService from '../services/webrtc';
import audioCallService from '../services/audioCall';
import ThreeViewport from '../components/ThreeViewport.vue';
import PropertyPanel from '../components/PropertyPanel.vue';
import AudioCallPanel from '../components/AudioCallPanel.vue';
import BranchManager from '../components/BranchManager.vue';
import { ArrowLeft } from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const sceneStore = useSceneStore();
const authStore = useAuthStore();

const sceneId = route.params.id;
const showBranchPanel = ref(false);
const activeTab = ref('properties');
const currentBranch = ref(null);

const selectObject = (objectId) => {
  sceneStore.selectObject(objectId);
};

const handleTransformChange = ({ objectId, position, rotation, scale }) => {
  sceneStore.updateObjectTransform(objectId, position, rotation, scale);
};

const handleBranchSwitch = async (branch) => {
  currentBranch.value = branch;
  if (branch.head_snapshot) {
    sceneStore.setObjects(branch.head_snapshot);
  }
};

const handleCommitCreated = async ({ message, callback }) => {
  const snapshotData = sceneStore.objects.map(obj => ({
    id: obj.id,
    type: obj.type,
    name: obj.name,
    position: obj.position,
    rotation: obj.rotation,
    scale: obj.scale,
    color: obj.color
  }));
  await callback(snapshotData);
};

const handleMergeCompleted = (data) => {
  if (data.snapshot) {
    sceneStore.setObjects(data.snapshot);
  }
};

const goBack = () => {
  router.push('/scenes');
};

onMounted(async () => {
  try {
    await socketService.connectAndWait(authStore.token);
    await sceneStore.initScene(sceneId);
    webrtcService.init(socketService.socket.id);
    webrtcService.joinScene(sceneId);
    
    audioCallService.init(sceneId, authStore.user?.id, authStore.user?.username);
    
    await sceneStore.fetchSnapshots();
  } catch (error) {
    console.error('Failed to connect to socket server:', error);
  }
});

onUnmounted(() => {
  sceneStore.leaveScene();
  audioCallService.destroy();
});
</script>

<style scoped>
.editor-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
  color: white;
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 15px 20px;
  border-bottom: 1px solid #333;
}

.scene-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.editor-header h2 {
  margin: 0;
  font-size: 18px;
}

.branch-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(79, 195, 247, 0.15);
  border-color: rgba(79, 195, 247, 0.3);
  color: #4fc3f7;
}

.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

.editor-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  width: 300px;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  background: #16162a;
  transition: width 0.3s;
}

.left-panel.expanded {
  width: 350px;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #333;
}

.tab-btn {
  flex: 1;
  padding: 12px;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  color: #4fc3f7;
  border-bottom: 2px solid #4fc3f7;
  background: rgba(79, 195, 247, 0.1);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.branch-panel-wrapper {
  height: 100%;
}

.viewport-wrapper {
  flex: 1;
  position: relative;
}

.online-users {
  display: flex;
  align-items: center;
  gap: 8px;
}

.online-users .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4caf50;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
  }
}
</style>
