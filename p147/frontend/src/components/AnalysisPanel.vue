<template>
  <el-card class="analysis-panel">
    <template #header>
      <div class="panel-header">
        <el-icon><DataAnalysis /></el-icon>
        <span>地震数据分析</span>
      </div>
    </template>

    <el-tabs v-model="activeTab" size="small">
      <el-tab-pane label="断层检测" name="fault">
        <div class="tab-content">
          <el-form size="small" label-width="90px">
            <el-form-item label="切片类型">
              <el-select v-model="faultParams.sliceType" style="width: 100%">
                <el-option label="Inline" value="inline" />
                <el-option label="Crossline" value="crossline" />
                <el-option label="Time slice" value="timeslice" />
              </el-select>
            </el-form-item>

            <el-form-item label="切片索引">
              <el-input-number 
                v-model="faultParams.sliceIndex" 
                :min="0" 
                style="width: 100%" 
              />
            </el-form-item>

            <el-form-item label="低阈值">
              <el-slider 
                v-model="faultParams.lowThreshold" 
                :min="0" 
                :max="1" 
                :step="0.05" 
                size="small" 
              />
              <span class="slider-value">{{ faultParams.lowThreshold }}</span>
            </el-form-item>

            <el-form-item label="高阈值">
              <el-slider 
                v-model="faultParams.highThreshold" 
                :min="0" 
                :max="1" 
                :step="0.05" 
                size="small" 
              />
              <span class="slider-value">{{ faultParams.highThreshold }}</span>
            </el-form-item>

            <el-form-item label="平滑系数">
              <el-slider 
                v-model="faultParams.sigma" 
                :min="0.5" 
                :max="5" 
                :step="0.1" 
                size="small" 
              />
              <span class="slider-value">{{ faultParams.sigma }}</span>
            </el-form-item>
          </el-form>

          <el-button 
            type="primary" 
            size="small" 
            @click="runFaultDetection" 
            :loading="loading" 
            :disabled="!store.currentFile"
            style="width: 100%; margin-top: 10px"
          >
            运行断层检测
          </el-button>

          <div v-if="faultResult" class="result-info">
            <el-divider content-position="left">检测结果</el-divider>
            <el-statistic title="检测到边缘点数" :value="faultResult.edge_count" />
            <div class="result-stats">
              <div>
                <span>检测到边缘点数：</span>
                <strong>{{ faultResult.edge_count }}</strong>
              </div>
              <div>
                <span>切片尺寸：</span>
                <strong>{{ faultResult.shape?.join(' × ') }}</strong>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="地层追踪" name="horizon">
        <div class="tab-content">
          <el-form size="small" label-width="90px">
            <el-form-item label="切片类型">
              <el-select v-model="horizonParams.sliceType" style="width: 100%">
                <el-option label="Inline" value="inline" />
                <el-option label="Crossline" value="crossline" />
                <el-option label="Time slice" value="timeslice" />
              </el-select>
            </el-form-item>

            <el-form-item label="切片索引">
              <el-input-number 
                v-model="horizonParams.sliceIndex" 
                :min="0" 
                style="width: 100%" 
              />
            </el-form-item>

            <el-form-item label="相似阈值">
              <el-slider 
                v-model="horizonParams.similarityThreshold" 
                :min="0" 
                :max="1" 
                :step="0.05" 
                size="small" 
              />
              <span class="slider-value">{{ horizonParams.similarityThreshold }}</span>
            </el-form-item>
          </el-form>

          <div class="seed-points-section">
            <el-divider content-position="left">种子点</el-divider>
            <div class="seed-points-list">
              <div 
                v-for="(point, index) in seedPoints" 
                :key="index" 
                class="seed-point-item"
              >
                <span>({{ point[0] }}, {{ point[1] }})</span>
                <el-button 
                  type="danger" 
                  size="mini" 
                  icon="Close" 
                  circle 
                  @click="removeSeedPoint(index)"
                />
              </div>
              <el-empty v-if="!seedPoints.length" description="点击图像添加种子点" />
            </div>
          </div>

          <el-button 
            type="primary" 
            size="small" 
            @click="runHorizonTracking" 
            :loading="loading" 
            :disabled="!store.currentFile || seedPoints.length === 0"
            style="width: 100%; margin-top: 10px"
          >
            运行地层追踪
          </el-button>

          <div v-if="horizonResult" class="result-info">
            <el-divider content-position="left">追踪结果</el-divider>
            <div class="result-stats">
              <div>
                <span>区域大小：</span>
                <strong>{{ horizonResult.region_size }}</strong>
              </div>
              <div>
                <span>边界点数：</span>
                <strong>{{ horizonResult.boundary_points?.length }}</strong>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="导出GeoTIFF" name="export">
        <div class="tab-content">
          <el-form size="small" label-width="90px">
            <el-form-item label="切片类型">
              <el-select v-model="exportParams.sliceType" style="width: 100%">
                <el-option label="Inline" value="inline" />
                <el-option label="Crossline" value="crossline" />
                <el-option label="Time slice" value="timeslice" />
              </el-select>
            </el-form-item>

            <el-form-item label="切片索引">
              <el-input-number 
                v-model="exportParams.sliceIndex" 
                :min="0" 
                style="width: 100%" 
              />
            </el-form-item>
          </el-form>

          <el-button 
            type="success" 
            size="small" 
            @click="runExportGeotiff" 
            :loading="loading" 
            :disabled="!store.currentFile"
            style="width: 100%; margin-top: 10px"
          >
            <el-icon><Download /></el-icon>
            导出GeoTIFF
          </el-button>

          <div v-if="exportResult" class="result-info">
            <el-divider content-position="left">导出结果</el-divider>
            <div class="result-stats">
              <div>
                <span>文件名：</span>
                <strong>{{ exportResult.filename }}</strong>
              </div>
              <div>
                <span>尺寸：</span>
                <strong>{{ exportResult.shape?.join(' × ') }}</strong>
              </div>
              <div>
                <span>振幅范围：</span>
                <strong>{{ exportResult.min_amplitude?.toFixed(2) }} ~ {{ exportResult.max_amplitude?.toFixed(2) }}</strong>
              </div>
            </div>
            <el-alert 
              title="文件已保存到服务器" 
              type="success" 
              :closable="false" 
              size="small" 
              style="margin-top: 10px" 
            />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useSeismicStore } from '../stores/seismic'
import { ElMessage } from 'element-plus'

const store = useSeismicStore()

const activeTab = ref('fault')
const loading = ref(false)

const faultParams = reactive({
  sliceType: 'inline',
  sliceIndex: 0,
  lowThreshold: 0.1,
  highThreshold: 0.3,
  sigma: 1.5
})

const horizonParams = reactive({
  sliceType: 'inline',
  sliceIndex: 0,
  similarityThreshold: 0.15
})

const exportParams = reactive({
  sliceType: 'inline',
  sliceIndex: 0
})

const seedPoints = ref([])
const faultResult = ref(null)
const horizonResult = ref(null)
const exportResult = ref(null)

const runFaultDetection = async () => {
  if (!store.currentFile) return
  
  loading.value = true
  try {
    const result = await store.detectFaults(store.currentFile.id, {
      slice_type: faultParams.sliceType,
      index: faultParams.sliceIndex,
      low_threshold: faultParams.lowThreshold,
      high_threshold: faultParams.highThreshold,
      sigma: faultParams.sigma
    })
    faultResult.value = result
    ElMessage.success('断层检测完成')
  } catch (error) {
    ElMessage.error('断层检测失败')
  } finally {
    loading.value = false
  }
}

const removeSeedPoint = (index) => {
  seedPoints.value.splice(index, 1)
}

const runHorizonTracking = async () => {
  if (!store.currentFile || seedPoints.value.length === 0) return
  
  loading.value = true
  try {
    const result = await store.trackHorizon(
      store.currentFile.id,
      horizonParams.sliceType,
      horizonParams.sliceIndex,
      seedPoints.value,
      horizonParams.similarityThreshold
    )
    horizonResult.value = result
    ElMessage.success('地层追踪完成')
  } catch (error) {
    ElMessage.error('地层追踪失败')
  } finally {
    loading.value = false
  }
}

const runExportGeotiff = async () => {
  if (!store.currentFile) return
  
  loading.value = true
  try {
    const result = await store.exportGeotiff(
      store.currentFile.id,
      exportParams.sliceType,
      exportParams.sliceIndex
    )
    exportResult.value = result
    ElMessage.success('GeoTIFF导出成功')
  } catch (error) {
    ElMessage.error('GeoTIFF导出失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.analysis-panel {
  height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}

.tab-content {
  max-height: 600px;
  overflow-y: auto;
}

.slider-value {
  display: inline-block;
  margin-left: 10px;
  font-size: 12px;
  color: #606266;
  min-width: 40px;
}

.seed-points-section {
  margin: 10px 0;
}

.seed-points-list {
  max-height: 150px;
  overflow-y: auto;
}

.seed-point-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 6px;
  font-size: 12px;
}

.result-info {
  margin-top: 15px;
}

.result-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.result-stats span:first-child {
  color: #606266;
}
</style>
