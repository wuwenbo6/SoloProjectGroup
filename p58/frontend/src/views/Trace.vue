<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">溯源查询</div>
      <el-button type="primary" @click="showGenerateDialog = true">
        <el-icon><Plus /></el-icon>
        生成溯源码
      </el-button>
    </div>

    <el-row :gutter="20" style="margin-bottom: 30px;">
      <el-col :span="16">
        <el-input
          v-model="traceCode"
          placeholder="请输入溯源码进行查询"
          size="large"
          clearable
        >
          <template #append>
            <el-button type="primary" @click="handleVerify" :loading="loading">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
          </template>
        </el-input>
      </el-col>
    </el-row>

    <el-card v-if="traceInfo" style="margin-bottom: 20px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>溯源信息 - {{ traceInfo.traceCode }}</span>
          <el-tag type="success">批次: {{ traceInfo.batchNo }}</el-tag>
        </div>
      </template>
      
      <el-descriptions :column="3" border>
        <el-descriptions-item label="溯源码">{{ traceInfo.traceCode }}</el-descriptions-item>
        <el-descriptions-item label="批次号">{{ traceInfo.batchNo }}</el-descriptions-item>
        <el-descriptions-item label="生成时间">{{ traceInfo.generateTime }}</el-descriptions-item>
        <el-descriptions-item label="验证次数">{{ traceInfo.verifyCount }}</el-descriptions-item>
        <el-descriptions-item label="最后验证时间">{{ traceInfo.verifyTime }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-row v-if="traceInfo" :gutter="20">
      <el-col :span="8">
        <el-card>
          <template #header>原料信息</template>
          <div class="trace-detail">
            <div v-for="(item, index) in materialList" :key="index" class="trace-step">
              <div class="step-title">{{ item.materialName }} ({{ item.materialType }})</div>
              <div class="step-content">
                <p>产地: {{ item.origin }}</p>
                <p>数量: {{ item.quantity }} {{ item.unit }}</p>
                <p>质量等级: {{ item.qualityLevel }}</p>
                <p>检验员: {{ item.inspector }}</p>
              </div>
            </div>
            <el-empty v-if="materialList.length === 0" description="暂无原料信息" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>工序记录</template>
          <div class="trace-detail">
            <div v-for="(item, index) in processList" :key="index" class="trace-step">
              <div class="step-title">{{ item.processName }}</div>
              <div class="step-content">
                <p>工匠: {{ item.craftsmanName }}</p>
                <p>开始时间: {{ item.startTime }}</p>
                <p>结束时间: {{ item.endTime }}</p>
                <p v-if="item.parameters">参数: {{ item.parameters }}</p>
              </div>
            </div>
            <el-empty v-if="processList.length === 0" description="暂无工序记录" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>质检报告</template>
          <div class="trace-detail">
            <div v-for="(item, index) in qualityList" :key="index" class="trace-step">
              <div class="step-title">{{ item.reportNo }}</div>
              <div class="step-content">
                <p>厚度: {{ item.thickness }} mm</p>
                <p>密度: {{ item.density }} g/cm³</p>
                <p>白度: {{ item.whiteness }}%</p>
                <p>质量等级: {{ getQualityLevelText(item.qualityLevel) }}</p>
                <p>检验员: {{ item.inspectorName }}</p>
              </div>
            </div>
            <el-empty v-if="qualityList.length === 0" description="暂无质检报告" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showGenerateDialog" title="生成溯源码" width="500px">
      <el-form :model="generateForm" label-width="100px">
        <el-form-item label="批次号">
          <el-input v-model="generateForm.batchNo" placeholder="请输入批次号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGenerateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleGenerate">生成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showSuccessDialog" title="溯源码生成成功" width="400px">
      <div style="text-align: center;">
        <el-icon size="60" color="#67C23A" style="margin-bottom: 20px;"><SuccessFilled /></el-icon>
        <p style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">溯源码: {{ newTraceCode }}</p>
        <p style="color: #999;">请妥善保存此溯源码</p>
      </div>
      <template #footer>
        <el-button type="primary" @click="showSuccessDialog = false">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { verifyTraceCode, generateTraceCode } from '../api/trace'

const traceCode = ref('')
const loading = ref(false)
const showGenerateDialog = ref(false)
const showSuccessDialog = ref(false)
const newTraceCode = ref('')
const generateForm = ref({ batchNo: '' })

const traceInfo = ref(null)
const materialList = ref([])
const processList = ref([])
const qualityList = ref([])

const handleVerify = async () => {
  if (!traceCode.value) {
    ElMessage.warning('请输入溯源码')
    return
  }

  loading.value = true
  try {
    const res = await verifyTraceCode(traceCode.value)
    traceInfo.value = res.data.traceInfo
    materialList.value = res.data.materials || []
    processList.value = res.data.processLogs || []
    qualityList.value = res.data.qualityReports || []
    ElMessage.success('查询成功')
  } catch (error) {
    console.error('查询溯源信息失败:', error)
    traceInfo.value = null
    materialList.value = []
    processList.value = []
    qualityList.value = []
  } finally {
    loading.value = false
  }
}

const handleGenerate = async () => {
  if (!generateForm.value.batchNo) {
    ElMessage.warning('请输入批次号')
    return
  }

  try {
    const res = await generateTraceCode(generateForm.value.batchNo)
    newTraceCode.value = res.data.traceCode
    showGenerateDialog.value = false
    showSuccessDialog.value = true
    generateForm.value.batchNo = ''
  } catch (error) {
    console.error('生成溯源码失败:', error)
  }
}

const getQualityLevelText = (level) => {
  const map = {
    'EXCELLENT': '优秀',
    'GOOD': '良好',
    'PASS': '合格',
    'FAIL': '不合格'
  }
  return map[level] || level
}
</script>
