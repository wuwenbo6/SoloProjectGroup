<template>
  <div class="compare-page">
    <el-card class="select-card">
      <template #header>
        <span>选择拓片进行对比</span>
      </template>
      <el-row :gutter="20">
        <el-col :span="12">
          <div class="select-panel">
            <h4>左侧拓片</h4>
            <el-select
              v-model="leftRubbingId"
              placeholder="请选择拓片"
              style="width: 100%"
              filterable
              @change="loadLeftRubbing"
            >
              <el-option
                v-for="rubbing in rubbings"
                :key="rubbing._id"
                :label="rubbing.title"
                :value="rubbing._id"
              />
            </el-select>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="select-panel">
            <h4>右侧拓片</h4>
            <el-select
              v-model="rightRubbingId"
              placeholder="请选择拓片"
              style="width: 100%"
              filterable
              @change="loadRightRubbing"
            >
              <el-option
                v-for="rubbing in rubbings"
                :key="rubbing._id"
                :label="rubbing.title"
                :value="rubbing._id"
              />
            </el-select>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-row :gutter="20" class="compare-row" v-if="leftRubbing && rightRubbing">
      <el-col :span="12">
        <el-card class="rubbing-card">
          <template #header>
            <div class="card-title">
              <span>{{ leftRubbing.title }}</span>
              <el-tag size="small" type="info">{{ leftRubbing.dynasty || '未知' }}</el-tag>
            </div>
          </template>
          <div class="image-container">
            <img
              :src="getImageUrl(leftRubbing.processedImage || leftRubbing.originalImage)"
              alt="左侧拓片"
              class="compare-image"
              ref="leftImageRef"
            />
          </div>
          <div class="info-footer">
            <el-descriptions :column="3" size="small">
              <el-descriptions-item label="文字数">
                {{ leftRubbing.characters?.length || 0 }}
              </el-descriptions-item>
              <el-descriptions-item label="释读进度">
                {{ leftRubbing.progress || 0 }}%
              </el-descriptions-item>
              <el-descriptions-item label="出土地">
                {{ leftRubbing.location || '未知' }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="rubbing-card">
          <template #header>
            <div class="card-title">
              <span>{{ rightRubbing.title }}</span>
              <el-tag size="small" type="info">{{ rightRubbing.dynasty || '未知' }}</el-tag>
            </div>
          </template>
          <div class="image-container">
            <img
              :src="getImageUrl(rightRubbing.processedImage || rightRubbing.originalImage)"
              alt="右侧拓片"
              class="compare-image"
              ref="rightImageRef"
            />
          </div>
          <div class="info-footer">
            <el-descriptions :column="3" size="small">
              <el-descriptions-item label="文字数">
                {{ rightRubbing.characters?.length || 0 }}
              </el-descriptions-item>
              <el-descriptions-item label="释读进度">
                {{ rightRubbing.progress || 0 }}%
              </el-descriptions-item>
              <el-descriptions-item label="出土地">
                {{ rightRubbing.location || '未知' }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-empty
      v-else-if="!leftRubbing && !rightRubbing"
      description="请选择两张拓片开始对比"
      class="empty-state"
    />

    <el-card v-if="leftRubbing && rightRubbing" class="analysis-card" style="margin-top: 20px;">
      <template #header>
        <span>对比分析</span>
      </template>
      <el-row :gutter="20">
        <el-col :span="8">
          <div class="analysis-item">
            <h4>文字数量对比</h4>
            <el-progress
              :percentage="getCharPercentage(leftRubbing, rightRubbing).left"
              color="#409eff"
              :stroke-width="20"
            >
              <span class="progress-text">左: {{ leftRubbing.characters?.length || 0 }}</span>
            </el-progress>
            <el-progress
              :percentage="getCharPercentage(leftRubbing, rightRubbing).right"
              color="#67c23a"
              :stroke-width="20"
              style="margin-top: 8px;"
            >
              <span class="progress-text">右: {{ rightRubbing.characters?.length || 0 }}</span>
            </el-progress>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="analysis-item">
            <h4>释读进度对比</h4>
            <el-progress
              :percentage="leftRubbing.progress || 0"
              color="#409eff"
              :stroke-width="20"
            >
              <span class="progress-text">左: {{ leftRubbing.progress || 0 }}%</span>
            </el-progress>
            <el-progress
              :percentage="rightRubbing.progress || 0"
              color="#67c23a"
              :stroke-width="20"
              style="margin-top: 8px;"
            >
              <span class="progress-text">右: {{ rightRubbing.progress || 0 }}%</span>
            </el-progress>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="analysis-item">
            <h4>基本信息</h4>
            <el-descriptions :column="1" size="small" border>
              <el-descriptions-item label="左侧朝代">
                {{ leftRubbing.dynasty || '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="右侧朝代">
                {{ rightRubbing.dynasty || '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="差异度">
                <el-tag type="warning">计算中...</el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { rubbingAPI } from '@/api'
import { ElMessage } from 'element-plus'

const rubbings = ref([])
const leftRubbingId = ref('')
const rightRubbingId = ref('')
const leftRubbing = ref(null)
const rightRubbing = ref(null)

const loadRubbings = async () => {
  try {
    const response = await rubbingAPI.list({ limit: 100 })
    rubbings.value = response.data.rubbings
  } catch (error) {
    ElMessage.error('加载拓片列表失败')
  }
}

const loadLeftRubbing = async () => {
  if (!leftRubbingId.value) {
    leftRubbing.value = null
    return
  }
  try {
    const response = await rubbingAPI.get(leftRubbingId.value)
    leftRubbing.value = response.data.rubbing
  } catch (error) {
    ElMessage.error('加载左侧拓片失败')
  }
}

const loadRightRubbing = async () => {
  if (!rightRubbingId.value) {
    rightRubbing.value = null
    return
  }
  try {
    const response = await rubbingAPI.get(rightRubbingId.value)
    rightRubbing.value = response.data.rubbing
  } catch (error) {
    ElMessage.error('加载右侧拓片失败')
  }
}

const getCharPercentage = (left, right) => {
  const leftCount = left?.characters?.length || 0
  const rightCount = right?.characters?.length || 0
  const max = Math.max(leftCount, rightCount, 1)
  return {
    left: Math.round((leftCount / max) * 100),
    right: Math.round((rightCount / max) * 100)
  }
}

const getImageUrl = (path) => {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return path
}

onMounted(() => {
  loadRubbings()
})
</script>

<style scoped>
.compare-page {
  padding: 0;
}

.select-card {
  border: none;
  margin-bottom: 20px;
}

.select-panel h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #666;
}

.compare-row {
  min-height: 600px;
}

.rubbing-card {
  height: 100%;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.image-container {
  text-align: center;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
  border-radius: 8px;
  overflow: hidden;
}

.compare-image {
  max-width: 100%;
  max-height: 500px;
}

.info-footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.empty-state {
  margin-top: 100px;
}

.analysis-card {
  border: none;
}

.analysis-item h4 {
  margin: 0 0 16px;
  font-size: 14px;
  color: #333;
}

.progress-text {
  font-size: 12px;
  color: #666;
}
</style>
