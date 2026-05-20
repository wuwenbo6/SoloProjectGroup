<template>
  <div class="history-timeline">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>📜 纹样历史版本</span>
          <el-tag type="info" size="small">版本控制</el-tag>
        </div>
      </template>
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="5" animated />
      </div>
      <div v-else-if="records.length === 0" class="empty-state">
        <el-empty description="暂无历史记录" />
      </div>
      <div v-else class="timeline-container">
        <el-timeline>
          <el-timeline-item
            v-for="(record, index) in records"
            :key="record._id"
            :timestamp="formatDate(record.createdAt)"
            :type="getActionType(record.action)"
            :icon="getActionIcon(record.action)"
          >
            <div class="timeline-content">
              <div class="record-header">
                <h4>{{ getActionName(record.action) }}</h4>
                <el-tag size="small" type="info">v{{ record.version }}</el-tag>
              </div>
              <p class="user-info">
                <el-icon><User /></el-icon>
                {{ record.userName }}
                <span v-if="record.actionDescription">- {{ record.actionDescription }}</span>
              </p>
              <div v-if="record.changes && record.changes.length > 0" class="changes-list">
                <details>
                  <summary>查看变更详情 ({{ record.changes.length }}项)</summary>
                  <ul>
                    <li v-for="(change, cIndex) in record.changes" :key="cIndex">
                      <span class="field-name">{{ formatFieldName(change.field) }}:</span>
                      <span class="old-value">{{ truncateValue(change.oldValue) }}</span>
                      <el-icon><ArrowRight /></el-icon>
                      <span class="new-value">{{ truncateValue(change.newValue) }}</span>
                    </li>
                  </ul>
                </details>
              </div>
              <div v-if="record.snapshot && record.snapshot.colors" class="snapshot-preview">
                <span class="preview-label">色彩快照:</span>
                <div class="color-snapshot">
                  <div
                    v-for="(color, cIndex) in record.snapshot.colors.slice(0, 5)"
                    :key="cIndex"
                    class="snapshot-color"
                    :style="{ backgroundColor: color.hex || color }"
                    :title="color.hex || color"
                  />
                </div>
              </div>
              <div class="record-actions" v-if="record.action !== 'delete'">
                <el-button
                  type="primary"
                  size="small"
                  @click="restoreVersion(record)"
                  :loading="restoringId === record._id"
                >
                  <el-icon><Refresh /></el-icon>
                  恢复此版本
                </el-button>
                <el-button
                  size="small"
                  @click="viewSnapshot(record)"
                >
                  <el-icon><View /></el-icon>
                  查看详情
                </el-button>
              </div>
            </div>
          </el-timeline-item>
        </el-timeline>
        <div v-if="total > limit" class="pagination">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="limit"
            :total="total"
            layout="prev, pager, next"
            @current-change="loadHistory"
          />
        </div>
      </div>
    </el-card>
    <el-dialog
      v-model="showSnapshotDialog"
      title="版本快照详情"
      width="80%"
      :close-on-click-modal="false"
    >
      <div v-if="currentSnapshot" class="snapshot-detail">
        <div class="snapshot-section">
          <h4>基本信息</h4>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="纹样名称">{{ currentSnapshot.snapshot?.name || currentSnapshot.patternName }}</el-descriptions-item>
            <el-descriptions-item label="版本">v{{ currentSnapshot.version }}</el-descriptions-item>
            <el-descriptions-item label="操作人">{{ currentSnapshot.userName }}</el-descriptions-item>
            <el-descriptions-item label="操作时间">{{ formatDate(currentSnapshot.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="分类" :span="2">{{ currentSnapshot.snapshot?.category || '未分类' }}</el-descriptions-item>
          </el-descriptions>
        </div>
        <div v-if="currentSnapshot.snapshot?.tags" class="snapshot-section">
          <h4>标签</h4>
          <div class="tags-container">
            <el-tag v-for="(tag, index) in currentSnapshot.snapshot.tags" :key="index" class="mr-2">
              {{ tag }}
            </el-tag>
          </div>
        </div>
        <div v-if="currentSnapshot.snapshot?.colors" class="snapshot-section">
          <h4>色彩方案</h4>
          <div class="colors-detail">
            <div
              v-for="(color, index) in currentSnapshot.snapshot.colors"
              :key="index"
              class="color-detail-item"
            >
              <div class="color-swatch" :style="{ backgroundColor: color.hex || color }"></div>
              <span>{{ color.name || color.hex || color }}</span>
            </div>
          </div>
        </div>
        <div v-if="currentSnapshot.snapshot?.outline" class="snapshot-section">
          <h4>轮廓数据</h4>
          <el-alert
            title="包含轮廓路径数据，恢复时将同时恢复纹样轮廓"
            type="info"
            :closable="false"
            show-icon
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="showSnapshotDialog = false">关闭</el-button>
        <el-button
          type="primary"
          @click="restoreVersion(currentSnapshot)"
          :loading="restoringId === currentSnapshot._id"
        >
          恢复此版本
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { User, ArrowRight, Refresh, View } from '@element-plus/icons-vue';
import axios from 'axios';
const props = defineProps({
  patternId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    default: null
  },
  limit: {
    type: Number,
    default: 10
  }
});
const emit = defineEmits(['version-restored']);
const records = ref([]);
const total = ref(0);
const currentPage = ref(1);
const loading = ref(false);
const restoringId = ref(null);
const showSnapshotDialog = ref(false);
const currentSnapshot = ref(null);
onMounted(() => {
  loadHistory();
});
watch(() => props.patternId, () => {
  currentPage.value = 1;
  loadHistory();
});
const loadHistory = async () => {
  if (!props.patternId && !props.userId) return;
  loading.value = true;
  try {
    let url;
    if (props.patternId) {
      url = `/api/patterns/${props.patternId}/history?page=${currentPage.value}&limit=${props.limit}`;
    } else {
      url = `/api/patterns/history/user/${props.userId}?page=${currentPage.value}&limit=${props.limit}`;
    }
    const response = await axios.get(url);
    records.value = response.data.records;
    total.value = response.data.total;
  } catch (error) {
    console.error('加载历史记录失败:', error);
    ElMessage.error('加载历史记录失败');
  } finally {
    loading.value = false;
  }
};
const getActionType = (action) => {
  const types = {
    create: 'success',
    update: 'primary',
    delete: 'danger',
    restore: 'warning',
    label: 'info',
    classify: 'info',
    export: 'info'
  };
  return types[action] || 'info';
};
const getActionIcon = (action) => {
  return null;
};
const getActionName = (action) => {
  const names = {
    create: '创建纹样',
    update: '更新内容',
    delete: '删除纹样',
    restore: '恢复版本',
    label: '添加标签',
    classify: '修改分类',
    export: '导出数据'
  };
  return names[action] || action;
};
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
const formatFieldName = (field) => {
  const names = {
    name: '纹样名称',
    category: '分类',
    tags: '标签',
    colors: '色彩方案',
    outline: '轮廓数据',
    outlineData: '轮廓数据',
    description: '描述'
  };
  return names[field] || field;
};
const truncateValue = (value) => {
  if (!value) return '(空)';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  const str = String(value);
  return str.length > 30 ? str.slice(0, 30) + '...' : str;
};
const restoreVersion = async (record) => {
  try {
    await ElMessageBox.confirm(
      `确定要恢复到版本 v${record.version}吗？当前内容将被覆盖。`,
      '版本恢复确认',
      {
        confirmButtonText: '确定恢复',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    restoringId.value = record._id;
    await axios.post(`/api/patterns/${props.patternId}/restore`, {
      historyId: record._id,
      userId: props.userId || 'anonymous',
      userName: '当前用户'
    });
    ElMessage.success('版本恢复成功');
    emit('version-restored', record);
    await loadHistory();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('恢复版本失败:', error);
      ElMessage.error('恢复版本失败');
    }
  } finally {
    restoringId.value = null;
    showSnapshotDialog.value = false;
  }
};
const viewSnapshot = (record) => {
  currentSnapshot.value = record;
  showSnapshotDialog.value = true;
};
</script>
<style scoped>
.history-timeline {
  max-width: 100%;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.loading-container {
  padding: 20px;
}
.empty-state {
  padding: 40px 20px;
}
.timeline-container {
  max-height: 600px;
  overflow-y: auto;
  padding-right: 10px;
}
.timeline-content {
  padding: 10px 0;
}
.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.record-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}
.changes-list {
  margin-bottom: 12px;
}
.changes-list details {
  font-size: 12px;
}
.changes-list summary {
  cursor: pointer;
  color: #409eff;
  margin-bottom: 8px;
}
.changes-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 8px;
}
.changes-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.field-name {
  font-weight: 500;
  min-width: 80px;
}
.old-value {
  color: #f56c6c;
  text-decoration: line-through;
}
.new-value {
  color: #67c23a;
  font-weight: 500;
}
.snapshot-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.preview-label {
  font-size: 12px;
  color: #606266;
}
.color-snapshot {
  display: flex;
  gap: 4px;
}
.snapshot-color {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
}
.record-actions {
  display: flex;
  gap: 8px;
}
.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}
.snapshot-detail {
  padding: 10px 0;
}
.snapshot-section {
  margin-bottom: 24px;
}
.snapshot-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.colors-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.color-detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.color-swatch {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
}
@media (max-width: 768px) {
  .timeline-container {
    max-height: 400px;
  }
  .record-actions {
    flex-direction: column;
  }
}
</style>
