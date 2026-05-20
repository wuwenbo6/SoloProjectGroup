<template>
  <div class="audio-call-panel" :class="{ expanded: isExpanded }">
    <div class="panel-header" @click="toggleExpand">
      <div class="header-left">
        <svg class="mic-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
        <span class="title">语音通话</span>
        <span class="participant-count" v-if="isJoined">
          {{ participants.length + 1 }} 人在线
        </span>
      </div>
      <div class="header-right">
        <svg class="expand-icon" viewBox="0 0 24 24" fill="currentColor">
          <path v-if="!isExpanded" d="M7 10l5 5 5-5z"/>
          <path v-else d="M7 14l5-5 5 5z"/>
        </svg>
      </div>
    </div>

    <div class="panel-content" v-if="isExpanded">
      <div class="participants-list" v-if="isJoined">
        <div class="participant-item local-user">
          <div class="avatar">
            {{ username?.charAt(0)?.toUpperCase() || 'U' }}
            <div class="speaking-indicator" :class="{ active: isSpeaking }"></div>
          </div>
          <div class="info">
            <span class="name">{{ username || '我' }}</span>
            <span class="status" v-if="isMuted">已静音</span>
          </div>
        </div>

        <div 
          class="participant-item" 
          v-for="p in participants" 
          :key="p.peerId"
        >
          <div class="avatar">
            {{ p.username?.charAt(0)?.toUpperCase() || 'U' }}
            <div class="speaking-indicator" :class="{ active: p.speaking && !p.muted }"></div>
          </div>
          <div class="info">
            <span class="name">{{ p.username || '用户' }}</span>
            <span class="status" v-if="p.muted">已静音</span>
          </div>
        </div>
      </div>

      <div class="controls">
        <template v-if="!isJoined">
          <el-button 
            type="primary" 
            class="join-btn"
            @click="joinAudio"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
            加入语音
          </el-button>
        </template>

        <template v-else>
          <el-button 
            :type="isMuted ? 'warning' : 'primary'"
            class="control-btn"
            @click="toggleMute"
          >
            <svg v-if="isMuted" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .43-.02.64-.05l3.05 3.05c-.51.31-1.05.58-1.63.77V21h2v-3.08c.49-.08.95-.26 1.38-.47L20 21.27 21.27 20 4.27 3z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
            {{ isMuted ? '取消静音' : '静音' }}
          </el-button>

          <el-button 
            type="danger"
            class="control-btn"
            @click="leaveAudio"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
            </svg>
            离开
          </el-button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import audioCallService from '../services/audioCall';

const props = defineProps({
  userId: String,
  username: String
});

const isExpanded = ref(true);
const isJoined = ref(false);
const isMuted = ref(false);
const isSpeaking = ref(false);
const participants = ref([]);

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

const joinAudio = async () => {
  const success = await audioCallService.joinAudio();
  if (success) {
    isJoined.value = true;
  }
};

const leaveAudio = () => {
  audioCallService.leaveAudio();
  isJoined.value = false;
  isMuted.value = false;
  isSpeaking.value = false;
};

const toggleMute = () => {
  isMuted.value = audioCallService.toggleMute();
};

const handleParticipantsChanged = (data) => {
  participants.value = data;
};

const handleMuteChanged = (muted) => {
  isMuted.value = muted;
};

const handleSpeakingState = (data) => {
  isSpeaking.value = data.speaking;
};

const handleLeft = () => {
  isJoined.value = false;
  isMuted.value = false;
  isSpeaking.value = false;
};

onMounted(() => {
  audioCallService.on('participants-changed', handleParticipantsChanged);
  audioCallService.on('mute-changed', handleMuteChanged);
  audioCallService.on('speaking-state', handleSpeakingState);
  audioCallService.on('left', handleLeft);
});

onUnmounted(() => {
  audioCallService.off('participants-changed', handleParticipantsChanged);
  audioCallService.off('mute-changed', handleMuteChanged);
  audioCallService.off('speaking-state', handleSpeakingState);
  audioCallService.off('left', handleLeft);
});
</script>

<style scoped>
.audio-call-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 280px;
  background: rgba(30, 30, 40, 0.95);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  overflow: hidden;
  z-index: 1000;
  transition: all 0.3s ease;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mic-icon {
  width: 20px;
  height: 20px;
  color: #4fc3f7;
}

.title {
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
}

.participant-count {
  color: #888;
  font-size: 12px;
  background: rgba(79, 195, 247, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
}

.expand-icon {
  width: 20px;
  height: 20px;
  color: #888;
  transition: transform 0.3s;
}

.panel-content {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.participants-list {
  margin-bottom: 16px;
}

.participant-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  margin-bottom: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.participant-item.local-user {
  background: rgba(79, 195, 247, 0.1);
  border: 1px solid rgba(79, 195, 247, 0.3);
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
  position: relative;
}

.speaking-indicator {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  background: #666;
  border-radius: 50%;
  border: 2px solid #1e1e28;
  transition: all 0.2s;
}

.speaking-indicator.active {
  background: #4caf50;
  box-shadow: 0 0 8px #4caf50;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.name {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.status {
  color: #888;
  font-size: 11px;
}

.controls {
  display: flex;
  gap: 8px;
}

.join-btn,
.control-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
}

.join-btn svg,
.control-btn svg {
  width: 18px;
  height: 18px;
}
</style>
