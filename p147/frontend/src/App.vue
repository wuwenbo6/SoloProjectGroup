<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-title">
        <el-icon><DataLine /></el-icon>
        <span>地震数据可视化平台</span>
      </div>
    </el-header>

    <el-container>
      <el-aside width="320px" class="sidebar">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="文件管理" name="files">
            <FileManager @file-selected="handleFileSelected" />
          </el-tab-pane>
          <el-tab-pane label="分析工具" name="analysis">
            <AnalysisPanel />
          </el-tab-pane>
          <el-tab-pane label="标注" name="annotations">
            <AnnotationPanel />
          </el-tab-pane>
          <el-tab-pane label="对比" name="compare">
            <ComparePanel />
          </el-tab-pane>
        </el-tabs>
      </el-aside>

      <el-main class="main-content">
        <template v-if="store.currentFile">
          <el-tabs v-model="viewTab" class="view-tabs">
            <el-tab-pane label="3D体渲染" name="3d">
              <VolumeRenderer :file-id="store.currentFile.id" />
            </el-tab-pane>
            <el-tab-pane label="切片查看" name="slices">
              <SliceViewer :file-id="store.currentFile.id" />
            </el-tab-pane>
            <el-tab-pane label="振幅分析" name="histogram">
              <HistogramView :file-id="store.currentFile.id" />
            </el-tab-pane>
          </el-tabs>
        </template>
        <el-empty v-else description="请选择一个SEG-Y文件进行查看" />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSeismicStore } from './stores/seismic'
import FileManager from './components/FileManager.vue'
import VolumeRenderer from './components/VolumeRenderer.vue'
import SliceViewer from './components/SliceViewer.vue'
import HistogramView from './components/HistogramView.vue'
import AnnotationPanel from './components/AnnotationPanel.vue'
import ComparePanel from './components/ComparePanel.vue'
import AnalysisPanel from './components/AnalysisPanel.vue'

const store = useSeismicStore()
const activeTab = ref('files')
const viewTab = ref('3d')

onMounted(async () => {
  await store.fetchFiles()
})

const handleFileSelected = async (fileId) => {
  await store.selectFile(fileId)
}
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: bold;
}

.sidebar {
  background: #f5f7fa;
  border-right: 1px solid #e4e7ed;
}

.main-content {
  padding: 20px;
  background: #f0f2f5;
}

.view-tabs {
  height: 100%;
}

:deep(.view-tabs .el-tabs__content) {
  height: calc(100% - 50px);
  overflow: auto;
}
</style>
