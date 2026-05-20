<template>
  <div class="branch-manager">
    <div class="manager-header">
      <h3>分支管理</h3>
      <el-button type="primary" size="small" @click="showCreateDialog = true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        新建分支
      </el-button>
    </div>

    <div class="branch-list" v-loading="loading">
      <div 
        class="branch-item" 
        v-for="branch in branches" 
        :key="branch.id"
        :class="{ active: currentBranchId === branch.id }"
        @click="selectBranch(branch)"
      >
        <div class="branch-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C9.79 2 8 3.79 8 6s1.79 4 4 4c1.49 0 2.79-.82 3.5-2.02L15 9c0 1.1-.9 2-2 2h-2c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-4.72c.61-.55 1-1.35 1-2.28 0-1.65-1.35-3-3-3s-3 1.35-3 3c0 .93.39 1.73 1 2.28V17h-2v-6h2c.37 0 .7-.11 1-.28V9h-1c-1.1 0-2-.9-2-2 0-1.65-1.35-3-3-3s-3 1.35-3 3c0 .93.39 1.73 1 2.28V20c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-4.72c.61-.55 1-1.35 1-2.28 0-1.65 1.35-3 3-3s3-1.35 3-3-1.35-3-3-3z"/>
          </svg>
        </div>
        <div class="branch-info">
          <div class="branch-name">{{ branch.name }}</div>
          <div class="branch-meta">
            <span class="creator">{{ branch.creator_name }}</span>
            <span class="time">{{ formatTime(branch.created_at) }}</span>
          </div>
        </div>
        <div class="branch-actions">
          <el-dropdown @command="(cmd) => handleBranchAction(cmd, branch)" trigger="click">
            <svg viewBox="0 0 24 24" fill="currentColor" class="more-icon">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="switch">切换到此分支</el-dropdown-item>
                <el-dropdown-item command="history">提交历史</el-dropdown-item>
                <el-dropdown-item command="merge">合并...</el-dropdown-item>
                <el-dropdown-item command="delete" divided style="color: #f56c6c">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="showCreateDialog"
      title="创建新分支"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form :model="newBranchForm" label-width="80px">
        <el-form-item label="分支名称">
          <el-input v-model="newBranchForm.name" placeholder="例如: feature/new-ui" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input 
            v-model="newBranchForm.description" 
            type="textarea" 
            :rows="3"
            placeholder="描述这个分支的用途"
          />
        </el-form-item>
        <el-form-item label="基于分支">
          <el-select v-model="newBranchForm.fromBranchId" placeholder="选择基准分支">
            <el-option
              v-for="b in branches"
              :key="b.id"
              :label="b.name"
              :value="b.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createBranch" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showCommitDialog"
      title="提交更改"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form :model="commitForm" label-width="80px">
        <el-form-item label="提交信息">
          <el-input 
            v-model="commitForm.message" 
            type="textarea" 
            :rows="3"
            placeholder="描述本次更改..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCommitDialog = false">取消</el-button>
        <el-button type="primary" @click="doCommit" :loading="committing">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showHistoryDialog"
      title="提交历史"
      width="600px"
      class="history-dialog"
    >
      <div class="commit-timeline" v-loading="historyLoading">
        <div v-if="commits.length === 0" class="empty-state">
          暂无提交记录
        </div>
        <div 
          class="commit-item" 
          v-for="(commit, index) in commits" 
          :key="commit.id"
        >
          <div class="commit-dot">
            <div class="dot"></div>
            <div class="line" v-if="index < commits.length - 1"></div>
          </div>
          <div class="commit-content">
            <div class="commit-message">{{ commit.message }}</div>
            <div class="commit-meta">
              <span class="author">{{ commit.creator_name }}</span>
              <span class="time">{{ formatTime(commit.created_at) }}</span>
              <span class="objects">{{ commit.object_count }} 个对象</span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="showMergeDialog"
      title="合并分支"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="mergeForm" label-width="100px">
        <el-form-item label="源分支">
          <el-select v-model="mergeForm.sourceBranchId" placeholder="选择要合并的分支">
            <el-option
              v-for="b in branches.filter(b => b.id !== currentBranchId)"
              :key="b.id"
              :label="b.name"
              :value="b.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标分支">
          <el-select v-model="mergeForm.targetBranchId" placeholder="选择合并到的分支">
            <el-option
              v-for="b in branches"
              :key="b.id"
              :label="b.name"
              :value="b.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="冲突策略">
          <el-radio-group v-model="mergeForm.strategy">
            <el-radio value="ours">保留当前分支更改</el-radio>
            <el-radio value="theirs">使用源分支更改</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMergeDialog = false">取消</el-button>
        <el-button type="primary" @click="doMerge" :loading="merging">合并</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showCompareDialog"
      title="快照对比"
      width="800px"
      class="compare-dialog"
    >
      <div class="compare-header">
        <el-select v-model="compareCommitA" placeholder="选择提交A" size="small">
          <el-option
            v-for="c in commits"
            :key="c.id"
            :label="c.message"
            :value="c.id"
          />
        </el-select>
        <span class="vs">VS</span>
        <el-select v-model="compareCommitB" placeholder="选择提交B" size="small">
          <el-option
            v-for="c in commits"
            :key="c.id"
            :label="c.message"
            :value="c.id"
          />
        </el-select>
        <el-button type="primary" size="small" @click="doCompare" :loading="comparing">对比</el-button>
      </div>

      <div class="compare-content" v-if="compareResult">
        <div class="compare-summary">
          <el-tag type="success">{{ compareResult.summary.added }} 新增</el-tag>
          <el-tag type="danger">{{ compareResult.summary.removed }} 删除</el-tag>
          <el-tag type="warning">{{ compareResult.summary.modified }} 修改</el-tag>
        </div>
        <div class="compare-changes">
          <div 
            class="change-item" 
            v-for="change in compareResult.changes" 
            :key="change.objectId"
            :class="change.type"
          >
            <div class="change-type">
              <span v-if="change.type === 'added'" class="added-icon">+</span>
              <span v-else-if="change.type === 'removed'" class="removed-icon">-</span>
              <span v-else class="modified-icon">~</span>
            </div>
            <div class="change-info">
              <div class="object-name">{{ change.objectName || '未命名对象' }}</div>
              <div class="change-details" v-if="change.changes">
                <div v-for="(c, i) in change.changes" :key="i" class="detail-item">
                  <span class="field">{{ c.field }}</span>:
                  <span class="old">{{ JSON.stringify(c.oldValue) }}</span>
                  <span class="arrow">→</span>
                  <span class="new">{{ JSON.stringify(c.newValue) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <el-button 
      class="commit-fab" 
      type="primary" 
      circle 
      @click="showCommitDialog = true"
      title="提交更改"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
    </el-button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../services/api';

const props = defineProps({
  sceneId: {
    type: String,
    required: true
  },
  currentBranchId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['branch-switch', 'commit-created', 'merge-completed']);

const loading = ref(false);
const branches = ref([]);
const commits = ref([]);
const historyLoading = ref(false);
const comparing = ref(false);
const compareResult = ref(null);

const showCreateDialog = ref(false);
const showCommitDialog = ref(false);
const showHistoryDialog = ref(false);
const showMergeDialog = ref(false);
const showCompareDialog = ref(false);

const creating = ref(false);
const committing = ref(false);
const merging = ref(false);

const newBranchForm = ref({
  name: '',
  description: '',
  fromBranchId: null
});

const commitForm = ref({
  message: ''
});

const mergeForm = ref({
  sourceBranchId: null,
  targetBranchId: null,
  strategy: 'ours'
});

const compareCommitA = ref('');
const compareCommitB = ref('');

const loadBranches = async () => {
  loading.value = true;
  try {
    const res = await api.get(`/scenes/${props.sceneId}/branches`);
    branches.value = res.data;
    
    if (!branches.value.find(b => b.id === props.currentBranchId) && branches.value.length > 0) {
      emit('branch-switch', branches.value[0]);
    }
  } catch (e) {
    ElMessage.error('加载分支失败');
  } finally {
    loading.value = false;
  }
};

const selectBranch = (branch) => {
  emit('branch-switch', branch);
};

const createBranch = async () => {
  if (!newBranchForm.value.name.trim()) {
    ElMessage.warning('请输入分支名称');
    return;
  }

  creating.value = true;
  try {
    const res = await api.post(`/scenes/${props.sceneId}/branches`, newBranchForm.value);
    ElMessage.success('分支创建成功');
    showCreateDialog.value = false;
    newBranchForm.value = { name: '', description: '', fromBranchId: null };
    await loadBranches();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '创建失败');
  } finally {
    creating.value = false;
  }
};

const loadCommitHistory = async (branchId) => {
  historyLoading.value = true;
  try {
    const res = await api.get(`/scenes/${props.sceneId}/branches/${branchId}/commits`);
    commits.value = res.data;
  } catch (e) {
    ElMessage.error('加载提交历史失败');
  } finally {
    historyLoading.value = false;
  }
};

const doCommit = async () => {
  if (!commitForm.value.message.trim()) {
    ElMessage.warning('请输入提交信息');
    return;
  }

  committing.value = true;
  try {
    emit('commit-created', {
      message: commitForm.value.message,
      callback: async (snapshotData) => {
        await api.post(`/scenes/${props.sceneId}/branches/${props.currentBranchId}/commits`, {
          message: commitForm.value.message,
          snapshotData
        });
        ElMessage.success('提交成功');
        showCommitDialog.value = false;
        commitForm.value.message = '';
      }
    });
  } catch (e) {
    ElMessage.error('提交失败');
  } finally {
    committing.value = false;
  }
};

const doMerge = async () => {
  if (!mergeForm.value.sourceBranchId || !mergeForm.value.targetBranchId) {
    ElMessage.warning('请选择源分支和目标分支');
    return;
  }

  merging.value = true;
  try {
    const res = await api.post(`/scenes/${props.sceneId}/merge`, mergeForm.value);
    
    ElMessage.success('合并成功');
    showMergeDialog.value = false;
    emit('merge-completed', res.data);
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '合并失败');
  } finally {
    merging.value = false;
  }
};

const doCompare = async () => {
  if (!compareCommitA.value || !compareCommitB.value) {
    ElMessage.warning('请选择两个提交进行对比');
    return;
  }

  comparing.value = true;
  try {
    const res = await api.get(`/scenes/${props.sceneId}/compare/${compareCommitA.value}/${compareCommitB.value}`);
    compareResult.value = res.data;
  } catch (e) {
    ElMessage.error('对比失败');
  } finally {
    comparing.value = false;
  }
};

const handleBranchAction = async (action, branch) => {
  switch (action) {
    case 'switch':
      emit('branch-switch', branch);
      break;
    case 'history':
      await loadCommitHistory(branch.id);
      showHistoryDialog.value = true;
      break;
    case 'merge':
      mergeForm.value.sourceBranchId = branch.id;
      mergeForm.value.targetBranchId = props.currentBranchId;
      showMergeDialog.value = true;
      break;
    case 'delete':
      try {
        await ElMessageBox.confirm(
          `确定要删除分支 "${branch.name}" 吗？此操作不可恢复。`,
          '删除分支',
          { type: 'warning' }
        );
        await api.delete(`/scenes/${props.sceneId}/branches/${branch.id}`);
        ElMessage.success('删除成功');
        await loadBranches();
      } catch {}
      break;
  }
};

const formatTime = (time) => {
  if (!time) return '';
  const date = new Date(time);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

onMounted(() => {
  loadBranches();
});
</script>

<style scoped>
.branch-manager {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
  color: #fff;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.manager-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.branch-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.branch-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.branch-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.branch-item.active {
  background: rgba(79, 195, 247, 0.15);
  border: 1px solid rgba(79, 195, 247, 0.3);
}

.branch-icon svg {
  width: 24px;
  height: 24px;
  color: #4fc3f7;
}

.branch-info {
  flex: 1;
  min-width: 0;
}

.branch-name {
  font-weight: 500;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.branch-meta {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
  display: flex;
  gap: 12px;
}

.branch-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.branch-item:hover .branch-actions {
  opacity: 1;
}

.more-icon {
  width: 20px;
  height: 20px;
  color: #888;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.more-icon:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.commit-fab {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  box-shadow: 0 4px 12px rgba(79, 195, 247, 0.4);
}

.commit-fab svg {
  width: 24px;
  height: 24px;
}

.history-dialog :deep(.el-dialog__body) {
  padding: 0;
  max-height: 500px;
  overflow-y: auto;
}

.commit-timeline {
  padding: 20px;
}

.commit-item {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.commit-dot {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #4fc3f7;
  flex-shrink: 0;
}

.line {
  width: 2px;
  flex: 1;
  min-height: 30px;
  background: rgba(79, 195, 247, 0.3);
  margin-top: 4px;
}

.commit-content {
  flex: 1;
  padding-bottom: 16px;
}

.commit-message {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
}

.commit-meta {
  font-size: 12px;
  color: #888;
  display: flex;
  gap: 16px;
}

.compare-dialog :deep(.el-dialog__body) {
  padding-top: 0;
}

.compare-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 16px;
}

.vs {
  color: #888;
  font-weight: 600;
}

.compare-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.compare-changes {
  max-height: 400px;
  overflow-y: auto;
}

.change-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.change-item.added {
  background: rgba(76, 175, 80, 0.1);
  border-left: 3px solid #4caf50;
}

.change-item.removed {
  background: rgba(244, 67, 54, 0.1);
  border-left: 3px solid #f44336;
}

.change-item.modified {
  background: rgba(255, 152, 0, 0.1);
  border-left: 3px solid #ff9800;
}

.change-type {
  font-size: 20px;
  font-weight: bold;
  width: 24px;
  text-align: center;
}

.added-icon { color: #4caf50; }
.removed-icon { color: #f44336; }
.modified-icon { color: #ff9800; }

.change-info {
  flex: 1;
}

.object-name {
  font-weight: 500;
  margin-bottom: 8px;
}

.change-details {
  font-size: 13px;
}

.detail-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
}

.field {
  color: #888;
  min-width: 100px;
}

.old {
  color: #f44336;
  text-decoration: line-through;
}

.new {
  color: #4caf50;
}

.arrow {
  color: #888;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #888;
}
</style>
