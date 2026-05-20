<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-title">释读结果对比</div>
      <div class="header-actions">
        <el-button @click="$router.push('/collection')">返回采集台</el-button>
      </div>
    </div>
    <div class="page-content">
      <el-row :gutter="20" style="height: 100%;">
        <el-col :span="6" style="height: 100%;">
          <div class="sidebar">
            <h3 style="margin-bottom: 16px;">选择释读版本</h3>
            <div class="version-list" v-infinite-scroll="loadMoreHistory" :infinite-scroll-disabled="historyLoading || !hasMoreHistory">
              <div v-for="item in interpretationList" :key="item.id" class="version-item-wrapper">
                <el-checkbox v-model="selectedVersions" :value="item.id">
                  <div>
                    <div style="font-weight: 500;">版本 {{ item.id }}</div>
                    <div style="font-size: 12px; color: #909399;">
                      用户: {{ item.userId }} | {{ item.status === 'COMPLETED' ? '已完成' : '草稿' }}
                    </div>
                    <div style="font-size: 12px; color: #909399;">
                      时间: {{ formatDate(item.updatedAt) }}
                    </div>
                  </div>
                </el-checkbox>
              </div>
              <div v-if="historyLoading" style="text-align: center; padding: 12px;">加载中...</div>
            </div>
            <el-button
              type="primary"
              style="width: 100%; margin-top: 20px;"
              @click="startComparison"
              :disabled="selectedVersions.length < 2 || loading"
            >
              开始对比
            </el-button>
          </div>
        </el-col>
        <el-col :span="18" style="height: 100%;">
          <div class="canvas-container">
            <div class="toolbar">
              <span style="margin-right: 20px;">已选择 {{ selectedVersions.length }} 个版本</span>
              <el-button size="small" @click="showDiffOnly = !showDiffOnly">
                {{ showDiffOnly ? '显示全部' : '只显示差异' }}
              </el-button>
              <span v-if="comparisonResult" style="margin-left: 20px;">
                共 {{ comparisonResult.total }} 条差异，当前显示 {{ diffAnnotations.length }} 条
              </span>
            </div>
            <div class="canvas-area" v-loading="loading">
              <div v-if="!comparisonResult" class="empty-tip">
                <el-empty description="请选择至少两个版本进行对比" />
              </div>
              <div v-else class="comparison-result" v-infinite-scroll="loadMoreDiff" :infinite-scroll-disabled="loading || !hasMoreDiffs" :infinite-scroll-distance="100">
                <el-table :data="diffAnnotations" stripe style="width: 100%;" :row-key="'annotationId'">
                  <el-table-column prop="annotationId" label="标注ID" width="100" />
                  <el-table-column prop="text" label="基准文字" width="150" />
                  <el-table-column prop="x" label="X坐标" width="80" />
                  <el-table-column prop="y" label="Y坐标" width="80" />
                  <el-table-column label="版本对比">
                    <template #default="{ row }">
                      <div class="version-compare">
                        <div
                          v-for="ver in row.versions"
                          :key="ver.interpretationId"
                          class="version-item"
                          :class="{ 'has-diff': ver.diff !== 'same' }"
                        >
                          <div class="version-header">
                            <span class="version-label">版本 {{ ver.interpretationId }}</span>
                            <el-tag v-if="ver.diff === 'same'" type="success" size="small">相同</el-tag>
                            <el-tag v-else-if="ver.diff === 'text'" type="warning" size="small">文字不同</el-tag>
                            <el-tag v-else-if="ver.diff === 'position'" type="danger" size="small">位置不同</el-tag>
                            <el-tag v-else-if="ver.diff === 'missing'" type="info" size="small">缺失</el-tag>
                            <el-tag v-else type="info" size="small">新增</el-tag>
                          </div>
                          <div class="version-text">{{ ver.text || '(空)' }}</div>
                        </div>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
                <div v-if="loading && comparisonResult" style="text-align: center; padding: 20px;">加载更多...</div>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { comparisonApi } from '@/api'
import type { Interpretation } from '@/types'

const loading = ref(false)
const historyLoading = ref(false)
const interpretationList = ref<Interpretation[]>([])
const selectedVersions = ref<number[]>([])
const comparisonResult = ref<any>(null)
const showDiffOnly = ref(false)
const currentHistoryPage = ref(0)
const currentDiffPage = ref(0)
const hasMoreHistory = ref(true)
const pageSize = 10

const allDiffAnnotations = ref<any[]>([])

const diffAnnotations = computed(() => {
  if (showDiffOnly.value) {
    return allDiffAnnotations.value.filter((item: any) =>
      item.versions.some((v: any) => v.diff !== 'same')
    )
  }
  return allDiffAnnotations.value
})

const hasMoreDiffs = computed(() => {
  if (!comparisonResult.value) return false
  return comparisonResult.value.hasMore && allDiffAnnotations.value.length < comparisonResult.value.total
})

const formatDate = (date: any) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

const loadInterpretationList = async () => {
  historyLoading.value = true
  try {
    const res: any = await comparisonApi.getHistory(0, pageSize)
    interpretationList.value = res.list || []
    hasMoreHistory.value = interpretationList.value.length < res.total
    currentHistoryPage.value = 1
  } catch (error) {
    console.error(error)
  } finally {
    historyLoading.value = false
  }
}

const loadMoreHistory = async () => {
  if (historyLoading.value || !hasMoreHistory.value) return
  historyLoading.value = true
  try {
    const res: any = await comparisonApi.getHistory(currentHistoryPage.value, pageSize)
    const newItems = res.list || []
    interpretationList.value = [...interpretationList.value, ...newItems]
    hasMoreHistory.value = interpretationList.value.length < res.total
    currentHistoryPage.value++
  } catch (error) {
    console.error(error)
  } finally {
    historyLoading.value = false
  }
}

const startComparison = async () => {
  if (selectedVersions.value.length < 2) {
    ElMessage.warning('请选择至少两个版本')
    return
  }
  loading.value = true
  currentDiffPage.value = 0
  allDiffAnnotations.value = []
  try {
    const res = await comparisonApi.compare(selectedVersions.value, 0, 20)
    comparisonResult.value = res
    allDiffAnnotations.value = res.diffAnnotations || []
    currentDiffPage.value = 1
    ElMessage.success('对比完成')
  } catch (error) {
    ElMessage.error('对比失败')
  } finally {
    loading.value = false
  }
}

const loadMoreDiff = async () => {
  if (loading.value || !hasMoreDiffs.value || !comparisonResult.value) return
  loading.value = true
  try {
    const res = await comparisonApi.compare(selectedVersions.value, currentDiffPage.value, 20)
    const newItems = res.diffAnnotations || []
    allDiffAnnotations.value = [...allDiffAnnotations.value, ...newItems]
    comparisonResult.value.hasMore = res.hasMore
    currentDiffPage.value++
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadInterpretationList()
})
</script>

<style scoped lang="scss">
.canvas-area {
  height: calc(100% - 57px);
  overflow: auto;
  background: #f5f7fa;
  padding: 20px;
}

.empty-tip {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.comparison-result {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  min-height: 200px;
}

.version-list {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
}

.version-item-wrapper {
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background: #fafafa;
  transition: all 0.2s;

  &:hover {
    border-color: #409eff;
    background: #ecf5ff;
  }
}

.version-compare {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.version-item {
  flex: 1;
  min-width: 180px;
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fafafa;

  &.has-diff {
    border-color: #e6a23c;
    background: #fdf6ec;
  }
}

.version-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.version-label {
  font-weight: 500;
  font-size: 13px;
}

.version-text {
  font-size: 14px;
  color: #303133;
  word-break: break-all;
}
</style>
