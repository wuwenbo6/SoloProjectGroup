<template>
  <div class="batch-manager">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>📦 批量管理工具</span>
          <el-tag v-if="selectedIds.length > 0" type="success" size="small">
            已选择 {{ selectedIds.length }} 项
          </el-tag>
        </div>
      </template>
      <div class="toolbar mb-4">
        <el-button-group>
          <el-button
            type="primary"
            :disabled="selectedIds.length === 0"
            @click="showLabelDialog = true"
          >
            <el-icon><Tag /></el-icon>
            批量标注
          </el-button>
          <el-button
            type="warning"
            :disabled="selectedIds.length === 0"
            @click="showClassifyDialog = true"
          >
            <el-icon><FolderOpened /></el-icon>
            批量分类
          </el-button>
          <el-button
            type="danger"
            :disabled="selectedIds.length === 0"
            @click="confirmBatchDelete"
          >
            <el-icon><Delete /></el-icon>
            批量删除
          </el-button>
        </el-button-group>
        <el-button
          type="info"
          @click="selectAll"
          :disabled="patterns.length === 0"
        >
          全选
        </el-button>
        <el-button
          @click="clearSelection"
          :disabled="selectedIds.length === 0"
        >
          取消选择
        </el-button>
      </div>
      <div class="pattern-list">
        <el-table
          :data="patterns"
          @selection-change="handleSelectionChange"
          style="width: 100%"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column label="预览" width="80">
            <template #default="{ row }">
              <div class="thumbnail" v-if="row.imageUrl">
                <img :src="row.imageUrl" alt="" class="thumbnail-img" />
              </div>
              <div v-else class="thumbnail-placeholder">
                <el-icon><Picture /></el-icon>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="纹样名称" min-width="150" />
          <el-table-column prop="category" label="分类" width="120">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.category || '未分类' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="标签" min-width="200">
            <template #default="{ row }">
              <el-tag
                v-for="(tag, index) in (row.tags || []).slice(0, 3)"
                :key="index"
                size="small"
                class="mr-1"
              >
                {{ tag }}
              </el-tag>
              <span v-if="(row.tags || []).length > 3" class="more-tags">
                +{{ (row.tags || []).length - 3 }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="色彩" width="120">
            <template #default="{ row }">
              <div class="color-preview">
                <div
                  v-for="(color, index) in (row.colors || []).slice(0, 4)"
                  :key="index"
                  class="color-dot"
                  :style="{ backgroundColor: color.hex || color }"
                  :title="color.name || color.hex || color"
                />
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>
        <div v-if="total > pageSize" class="pagination mt-4">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="total"
            layout="prev, pager, next, jumper, total"
            @current-change="loadPatterns"
          />
        </div>
      </div>
    </el-card>
    <el-dialog
      v-model="showLabelDialog"
      title="批量添加标签"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="dialog-content">
        <p class="hint">将为 {{ selectedIds.length }} 个纹样添加以下标签：</p>
        <el-select
          v-model="newTags"
          multiple
          filterable
          allow-create
          placeholder="输入或选择标签"
          style="width: 100%"
        >
          <el-option
            v-for="tag in availableTags"
            :key="tag"
            :label="tag"
            :value="tag"
          />
        </el-select>
        <p class="mt-4 text-sm text-gray-500">
          💡 提示：输入新标签后按回车即可创建
        </p>
      </div>
      <template #footer>
        <el-button @click="showLabelDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="labelingInProgress"
          :disabled="newTags.length === 0"
          @click="executeBatchLabel"
        >
          确认添加
        </el-button>
      </template>
    </el-dialog>
    <el-dialog
      v-model="showClassifyDialog"
      title="批量修改分类"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="dialog-content">
        <p class="hint">将为 {{ selectedIds.length }} 个纹样设置分类为：</p>
        <el-select
          v-model="newCategory"
          placeholder="选择分类"
          style="width: 100%"
        >
          <el-option label="未分类" value="" />
          <el-option label="生角" value="sheng" />
          <el-option label="旦角" value="dan" />
          <el-option label="净角" value="jing" />
          <el-option label="末角" value="mo" />
          <el-option label="丑角" value="chou" />
        </el-select>
      </div>
      <template #footer>
        <el-button @click="showClassifyDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="classifyingInProgress"
          :disabled="!newCategory"
          @click="executeBatchClassify"
        >
          确认设置
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Tag, FolderOpened, Delete, Picture } from '@element-plus/icons-vue';
import axios from 'axios';
const emit = defineEmits(['patterns-updated']);
const patterns = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);
const selectedIds = ref([]);
const showLabelDialog = ref(false);
const showClassifyDialog = ref(false);
const newTags = ref([]);
const newCategory = ref('');
const labelingInProgress = ref(false);
const classifyingInProgress = ref(false);
const availableTags = computed(() => {
  const allTags = new Set();
  patterns.value.forEach(p => {
    (p.tags || []).forEach(t => allTags.add(t));
  });
  return Array.from(allTags);
});
onMounted(() => {
  loadPatterns();
});
const loadPatterns = async () => {
  try {
    const response = await axios.get('/api/patterns', {
      params: {
        page: currentPage.value,
        limit: pageSize.value
      }
    });
    patterns.value = response.data.patterns;
    total.value = response.data.total;
  } catch (error) {
    console.error('加载纹样列表失败:', error);
    ElMessage.error('加载纹样列表失败');
  }
};
const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(p => p._id);
};
const selectAll = () => {
  selectedIds.value = patterns.value.map(p => p._id);
};
const clearSelection = () => {
  selectedIds.value = [];
};
const executeBatchLabel = async () => {
  if (newTags.value.length === 0 || selectedIds.value.length === 0) return;
  try {
    labelingInProgress.value = true;
    await axios.post('/api/patterns/batch/label', {
      ids: selectedIds.value,
      tags: newTags.value,
      userId: 'anonymous',
      userName: '当前用户'
    });
    ElMessage.success(`成功为 ${selectedIds.value.length} 个纹样添加标签`);
    showLabelDialog.value = false;
    newTags.value = [];
    clearSelection();
    await loadPatterns();
    emit('patterns-updated');
  } catch (error) {
    console.error('批量标注失败:', error);
    ElMessage.error('批量标注失败');
  } finally {
    labelingInProgress.value = false;
  }
};
const executeBatchClassify = async () => {
  if (!newCategory.value || selectedIds.value.length === 0) return;
  try {
    classifyingInProgress.value = true;
    await axios.post('/api/patterns/batch/classify', {
      ids: selectedIds.value,
      category: newCategory.value,
      userId: 'anonymous',
      userName: '当前用户'
    });
    ElMessage.success(`成功为 ${selectedIds.value.length} 个纹样设置分类`);
    showClassifyDialog.value = false;
    newCategory.value = '';
    clearSelection();
    await loadPatterns();
    emit('patterns-updated');
  } catch (error) {
    console.error('批量分类失败:', error);
    ElMessage.error('批量分类失败');
  } finally {
    classifyingInProgress.value = false;
  }
};
const confirmBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 个纹样吗？此操作不可恢复！`,
      '批量删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'danger',
        confirmButtonClass: 'el-button--danger'
      }
    );
    await axios.post('/api/patterns/batch/delete', {
      ids: selectedIds.value
    });
    ElMessage.success(`成功删除 ${selectedIds.value.length} 个纹样`);
    clearSelection();
    await loadPatterns();
    emit('patterns-updated');
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error);
      ElMessage.error('批量删除失败');
    }
  }
};
const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
</script>
<style scoped>
.batch-manager {
  max-width: 100%;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.thumbnail {
  width: 50px;
  height: 50px;
  border-radius: 4px;
  overflow: hidden;
  background: #f5f7fa;
}
.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumbnail-placeholder {
  width: 50px;
  height: 50px;
  border-radius: 4px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
}
.more-tags {
  font-size: 12px;
  color: #909399;
}
.color-preview {
  display: flex;
  gap: 4px;
}
.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid #dcdfe6;
}
.pagination {
  display: flex;
  justify-content: center;
}
.dialog-content {
  padding: 10px 0;
}
.hint {
  margin: 0 0 16px 0;
  color: #606266;
}
@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar .el-button-group {
    flex-wrap: wrap;
  }
}
</style>
