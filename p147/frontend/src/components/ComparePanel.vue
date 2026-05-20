<template>
  <div class="compare-panel">
    <el-alert
      title="选择要对比的文件"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 15px"
    />

    <div class="file-selector">
      <el-checkbox-group v-model="selectedFileIds">
        <el-checkbox
          v-for="file in store.files"
          :key="file.id"
          :label="file.id"
          class="file-checkbox"
        >
          <div class="file-info">
            <div class="file-name">{{ file.filename }}</div>
            <div class="file-meta">
              {{ file.inline_count }}×{{ file.crossline_count }}×{{ file.sample_count }}
            </div>
          </div>
        </el-checkbox>
      </el-checkbox-group>
    </div>

    <el-button
      type="primary"
      size="small"
      :disabled="selectedFileIds.length < 2"
      @click="compareFiles"
      style="width: 100%; margin: 15px 0"
    >
      对比选中的文件 ({{ selectedFileIds.length }})
    </el-button>

    <div v-if="compareResults.length" class="compare-results">
      <el-divider>对比结果</el-divider>
      
      <el-table :data="compareResults" size="small" border>
        <el-table-column prop="filename" label="文件名" />
        <el-table-column prop="inline_count" label="Inline数" />
        <el-table-column prop="crossline_count" label="Crossline数" />
        <el-table-column prop="sample_count" label="采样数" />
        <el-table-column prop="file_size" label="文件大小">
          <template #default="{ row }">
            {{ (row.file_size / 1024 / 1024).toFixed(2) }} MB
          </template>
        </el-table-column>
      </el-table>

      <el-card style="margin-top: 15px">
        <template #header>统计对比</template>
        <div class="stats-compare">
          <div class="stat-row">
            <span class="label">振幅范围:</span>
            <span class="value">
              {{ overallStats.min_amp?.toFixed(4) }} ~ {{ overallStats.max_amp?.toFixed(4) }}
            </span>
          </div>
          <div class="stat-row">
            <span class="label">文件数量:</span>
            <span class="value">{{ selectedFileIds.length }}</span>
          </div>
          <div class="stat-row">
            <span class="label">总数据点:</span>
            <span class="value">{{ totalVoxels.toLocaleString() }}</span>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useSeismicStore } from '../stores/seismic'
import { ElMessage } from 'element-plus'

const store = useSeismicStore()

const selectedFileIds = ref([])
const compareResults = ref([])

const overallStats = computed(() => {
  if (!compareResults.value.length) return {}
  
  const files = compareResults.value
  return {
    min_amp: Math.min(...files.map(f => f.min_amplitude)),
    max_amp: Math.max(...files.map(f => f.max_amplitude))
  }
})

const totalVoxels = computed(() => {
  if (!compareResults.value.length) return 0
  
  return compareResults.value.reduce((sum, f) => {
    return sum + f.inline_count * f.crossline_count * f.sample_count
  }, 0)
})

const compareFiles = async () => {
  if (selectedFileIds.value.length < 2) {
    ElMessage.warning('请至少选择2个文件进行对比')
    return
  }
  
  try {
    const result = await store.compareFiles(selectedFileIds.value)
    compareResults.value = result.files
    ElMessage.success('对比完成')
  } catch (error) {
    ElMessage.error('对比失败')
  }
}

watch(() => store.selectedFiles, (newVal) => {
  selectedFileIds.value = [...newVal]
}, { deep: true })
</script>

<style scoped>
.compare-panel {
  padding: 10px;
  height: 100%;
  overflow-y: auto;
}

.file-selector {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 10px;
}

.file-checkbox {
  display: block;
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.file-checkbox:hover {
  background-color: #f5f7fa;
}

.file-info {
  margin-left: 8px;
}

.file-name {
  font-weight: 500;
  font-size: 13px;
  word-break: break-all;
}

.file-meta {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}

.compare-results {
  margin-top: 10px;
}

.stats-compare {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-row .label {
  font-size: 13px;
  color: #606266;
}

.stat-row .value {
  font-weight: bold;
  font-size: 14px;
  color: #303133;
}
</style>
