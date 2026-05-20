<template>
  <div class="compare">
    <div class="compare-header">
      <h2>拓片对比</h2>
      <div class="compare-controls">
        <el-select v-model="compareMode" placeholder="对比模式" style="width: 140px; margin-right: 10px">
          <el-option label="左右对比" value="side-by-side" />
          <el-option label="叠加对比" value="overlay" />
          <el-option label="滑动对比" value="slider" />
        </el-select>
      </div>
    </div>

    <el-row :gutter="20" class="selector-row">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>左侧拓片</span>
          </template>
          <el-select
            v-model="leftRubbingId"
            placeholder="选择拓片"
            style="width: 100%"
            @change="loadRubbing('left')"
          >
            <el-option
              v-for="r in rubbings"
              :key="r.id"
              :label="r.title"
              :value="r.id"
            />
          </el-select>
          <div class="rubbing-info" v-if="leftRubbing">
            <p><strong>标题：</strong>{{ leftRubbing.title }}</p>
            <p><strong>朝代：</strong>{{ leftRubbing.dynasty || '未知' }}</p>
            <p><strong>分类：</strong>{{ getCategoryLabel(leftRubbing.category) }}</p>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>右侧拓片</span>
          </template>
          <el-select
            v-model="rightRubbingId"
            placeholder="选择拓片"
            style="width: 100%"
            @change="loadRubbing('right')"
          >
            <el-option
              v-for="r in rubbings"
              :key="r.id"
              :label="r.title"
              :value="r.id"
            />
          </el-select>
          <div class="rubbing-info" v-if="rightRubbing">
            <p><strong>标题：</strong>{{ rightRubbing.title }}</p>
            <p><strong>朝代：</strong>{{ rightRubbing.dynasty || '未知' }}</p>
            <p><strong>分类：</strong>{{ getCategoryLabel(rightRubbing.category) }}</p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="compare-area" style="margin-top: 20px">
      <template #header>
        <span>对比视图</span>
        <div class="zoom-controls">
          <el-button-group>
            <el-button size="small" @click="zoomOut">-</el-button>
            <el-button size="small">{{ zoomLevel }}%</el-button>
            <el-button size="small" @click="zoomIn">+</el-button>
          </el-button-group>
        </div>
      </template>

      <div v-if="compareMode === 'side-by-side'" class="side-by-side-container">
        <div class="compare-pane">
          <div class="pane-image" :style="{ transform: `scale(${zoomLevel / 100})` }">
            <img :src="leftImageSrc" alt="左侧拓片" v-if="leftImageSrc">
            <el-empty v-else description="请选择左侧拓片" />
          </div>
        </div>
        <div class="compare-divider"></div>
        <div class="compare-pane">
          <div class="pane-image" :style="{ transform: `scale(${zoomLevel / 100})` }">
            <img :src="rightImageSrc" alt="右侧拓片" v-if="rightImageSrc">
            <el-empty v-else description="请选择右侧拓片" />
          </div>
        </div>
      </div>

      <div v-if="compareMode === 'overlay'" class="overlay-container">
        <div class="overlay-image" :style="{ transform: `scale(${zoomLevel / 100})` }">
          <img :src="leftImageSrc" class="base-image" alt="底层拓片">
          <img
            :src="rightImageSrc"
            class="overlay-image-layer"
            alt="叠加拓片"
            :style="{ opacity: overlayOpacity }"
            v-if="rightImageSrc"
          >
        </div>
        <div class="opacity-control">
          <span>透明度：</span>
          <el-slider v-model="overlayOpacity" :min="0" :max="1" :step="0.01" style="width: 200px" />
        </div>
      </div>

      <div v-if="compareMode === 'slider'" class="slider-container">
        <div
          class="slider-image-wrapper"
          :style="{ transform: `scale(${zoomLevel / 100})` }"
          ref="sliderWrapper"
        >
          <img :src="leftImageSrc" class="slider-base-image" alt="底层拓片">
          <div
            class="slider-top-layer"
            :style="{ width: sliderPosition + '%' }"
            v-if="rightImageSrc"
          >
            <img :src="rightImageSrc" class="slider-overlay-image" alt="上层拓片">
          </div>
          <div
            class="slider-handle"
            :style="{ left: sliderPosition + '%' }"
            @mousedown="startDrag"
          >
            <el-icon><DArrowRight /></el-icon>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { DArrowRight } from '@element-plus/icons-vue'
import api from '@/services/api'

const sliderWrapper = ref()
const rubbings = ref([])
const leftRubbingId = ref('')
const rightRubbingId = ref('')
const leftRubbing = ref(null)
const rightRubbing = ref(null)
const compareMode = ref('side-by-side')
const zoomLevel = ref(100)
const overlayOpacity = ref(0.5)
const sliderPosition = ref(50)
const isDragging = ref(false)

const leftImageSrc = computed(() => leftRubbing.value?.processedImage || leftRubbing.value?.originalImage || '')
const rightImageSrc = computed(() => rightRubbing.value?.processedImage || rightRubbing.value?.originalImage || '')

async function loadRubbings() {
  try {
    const res = await api.get('/rubbing/list?pageSize=100')
    rubbings.value = res.data.rubbings || []
  } catch (err) {
    console.error(err)
  }
}

async function loadRubbing(side) {
  const id = side === 'left' ? leftRubbingId.value : rightRubbingId.value
  if (!id) return
  
  try {
    const res = await api.get(`/rubbing/${id}`)
    if (side === 'left') {
      leftRubbing.value = res.data
    } else {
      rightRubbing.value = res.data
    }
  } catch (err) {
    ElMessage.error('加载拓片失败')
  }
}

function zoomIn() {
  if (zoomLevel.value < 200) zoomLevel.value += 10
}

function zoomOut() {
  if (zoomLevel.value > 50) zoomLevel.value -= 10
}

function startDrag(e) {
  isDragging.value = true
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e) {
  if (!isDragging.value || !sliderWrapper.value) return
  const rect = sliderWrapper.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / (rect.width * (zoomLevel.value / 100))
  sliderPosition.value = Math.max(0, Math.min(100, x * 100))
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function getCategoryLabel(category) {
  const labels = { stele: '碑刻', bronze: '青铜', jade: '玉器', pottery: '陶器', other: '其他' }
  return labels[category] || category
}

onMounted(() => {
  loadRubbings()
})
</script>

<style scoped>
.compare {
  padding: 20px;
}

.compare-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.compare-header h2 {
  margin: 0;
}

.selector-row {
  margin-bottom: 20px;
}

.rubbing-info {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #e4e7ed;
}

.rubbing-info p {
  margin: 5px 0;
  font-size: 14px;
}

.zoom-controls {
  display: flex;
  align-items: center;
}

.side-by-side-container {
  display: flex;
  height: 600px;
}

.compare-pane {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.pane-image {
  padding: 20px;
  transform-origin: top center;
}

.pane-image img {
  max-width: 100%;
  display: block;
}

.compare-divider {
  width: 2px;
  background: #e4e7ed;
  margin: 0 10px;
}

.overlay-container {
  height: 600px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.overlay-image {
  position: relative;
  padding: 20px;
  transform-origin: top center;
}

.base-image {
  display: block;
  max-width: 100%;
}

.overlay-image-layer {
  position: absolute;
  top: 20px;
  left: 20px;
  max-width: 100%;
}

.opacity-control {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.slider-container {
  height: 600px;
  overflow: auto;
  display: flex;
  justify-content: center;
  padding: 20px;
}

.slider-image-wrapper {
  position: relative;
  transform-origin: top center;
  overflow: hidden;
}

.slider-base-image {
  display: block;
  max-width: 100%;
}

.slider-top-layer {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  overflow: hidden;
}

.slider-overlay-image {
  display: block;
  max-width: 100%;
  height: 100%;
}

.slider-handle {
  position: absolute;
  top: 0;
  width: 4px;
  height: 100%;
  background: #409eff;
  cursor: ew-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slider-handle .el-icon {
  background: #409eff;
  color: #fff;
  padding: 10px 5px;
  border-radius: 4px;
}
</style>
