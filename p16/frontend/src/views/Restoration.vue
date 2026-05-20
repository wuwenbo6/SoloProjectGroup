<template>
  <div class="restoration-page">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>古籍图像 - 残损区域划定</span>
          </template>
          <div class="image-container" ref="imageContainer">
            <div class="placeholder-image">
              <div class="placeholder-content">
                <el-icon size="80"><picture /></el-icon>
                <p>古籍扫描图像预览区域</p>
                <p style="font-size: 12px; color: #999;">点击图像可划定残损区域</p>
              </div>
            </div>
            <div
                v-for="(area, index) in damageAreas"
                :key="index"
                class="damage-area"
                :style="{ left: area.x + 'px', top: area.y + 'px', width: area.width + 'px', height: area.height + 'px' }"
                @click="removeDamageArea(index)"
            >
              <span class="damage-label">{{ index + 1 }}</span>
            </div>
          </div>
          <div class="damage-tools" style="margin-top: 15px;">
            <el-button type="primary" size="small" @click="startDrawing">
              开始划定区域
            </el-button>
            <el-button type="danger" size="small" @click="clearDamageAreas">
              清除所有区域
            </el-button>
            <el-button type="success" size="small" @click="analyzeDamage">
              AI分析残损
            </el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>修复工作台</span>
          </template>
          <el-tabs v-model="activeTab">
            <el-tab-pane label="文字提取" name="text">
              <div class="text-content">
                <el-input
                    v-model="extractedText"
                    type="textarea"
                    :rows="8"
                    placeholder="提取的古文字内容"
                />
                <div class="action-buttons">
                  <el-button type="primary" @click="extractText">重新提取</el-button>
                  <el-button @click="saveText">保存文本</el-button>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="断句校准" name="punctuation">
              <div class="text-content">
                <el-input
                    v-model="punctuatedText"
                    type="textarea"
                    :rows="8"
                    placeholder="添加标点后的文本"
                />
                <div class="action-buttons">
                  <el-button type="primary" @click="autoPunctuate">自动断句</el-button>
                  <el-button @click="savePunctuation">保存断句</el-button>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="异体字转换" name="variant">
              <div class="variant-content">
                <el-input
                    v-model="originalVariantText"
                    type="textarea"
                    :rows="4"
                    placeholder="原始文本（含异体字）"
                />
                <div style="margin: 10px 0; text-align: center;">
                  <el-icon size="24"><arrow-down /></el-icon>
                </div>
                <el-input
                    v-model="convertedVariantText"
                    type="textarea"
                    :rows="4"
                    placeholder="转换后的标准文本"
                />
                <div class="action-buttons">
                  <el-button type="primary" @click="convertVariants">自动转换</el-button>
                  <el-button @click="saveVariantConversion">保存转换</el-button>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="AI修复建议" name="ai">
              <div class="ai-suggestions">
                <el-alert
                    v-for="(suggestion, index) in aiSuggestions"
                    :key="index"
                    :title="suggestion.title"
                    :type="suggestion.type"
                    :description="suggestion.content"
                    show-icon
                    closable
                    style="margin-bottom: 10px;"
                />
                <div class="action-buttons">
                  <el-button type="primary" @click="getAiSuggestions">获取AI建议</el-button>
                  <el-button type="success" @click="applyAiSuggestions">应用建议</el-button>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Picture, ArrowDown } from '@element-plus/icons-vue'
import { imageApi, textApi } from '@/api'

const route = useRoute()

const activeTab = ref('text')
const pageId = ref(route.params.pageId)

const damageAreas = ref([
  { x: 100, y: 150, width: 60, height: 40 },
  { x: 250, y: 280, width: 50, height: 45 }
])

const extractedText = ref('子曰学而时习之不亦说乎有朋自远方来不亦乐乎人不知而不愠不亦君子乎')
const punctuatedText = ref('')
const originalVariantText = ref('')
const convertedVariantText = ref('')

const aiSuggestions = ref([
  { title: '笔画补全建议', type: 'warning', content: '检测到第3个字符有笔画缺失，建议参照《康熙字典》标准字形进行补全。' },
  { title: '异体字转换', type: 'info', content: '发现异体字"说"，建议转换为标准字"悦"。' },
  { title: '残损修复', type: 'error', content: '页面左上角有明显残损，建议使用AI图像修复功能进行处理。' }
])

const isDrawing = ref(false)

const startDrawing = () => {
  isDrawing.value = !isDrawing.value
}

const removeDamageArea = (index) => {
  damageAreas.value.splice(index, 1)
}

const clearDamageAreas = () => {
  damageAreas.value = []
}

const analyzeDamage = async () => {
  try {
    await imageApi.analyzeDamage('/path/to/image')
  } catch (error) {
    console.error('分析失败', error)
  }
}

const extractText = async () => {
  try {
    const result = await imageApi.extractText('/path/to/image')
    extractedText.value = result
  } catch (error) {
    console.error('提取失败', error)
  }
}

const saveText = () => {
  console.log('保存文本:', extractedText.value)
}

const autoPunctuate = async () => {
  try {
    const result = await textApi.punctuate(extractedText.value)
    punctuatedText.value = result
  } catch (error) {
    console.error('断句失败', error)
  }
}

const savePunctuation = () => {
  console.log('保存断句:', punctuatedText.value)
}

const convertVariants = async () => {
  originalVariantText.value = extractedText.value
  try {
    const result = await textApi.convertVariant(extractedText.value)
    convertedVariantText.value = result.convertedText || '子日学而时习之不亦乐乎有朋自远方来不亦乐乎人不知而不愠不亦君子乎'
  } catch (error) {
    console.error('转换失败', error)
  }
}

const saveVariantConversion = () => {
  console.log('保存转换:', convertedVariantText.value)
}

const getAiSuggestions = async () => {
  console.log('获取AI建议')
}

const applyAiSuggestions = () => {
  console.log('应用AI建议')
}

onMounted(() => {
  originalVariantText.value = extractedText.value
})
</script>

<style scoped>
.restoration-page {
  min-height: 600px;
}

.image-container {
  width: 100%;
  height: 400px;
  background: #f8f9fa;
  border: 2px dashed #dcdfe6;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.placeholder-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.placeholder-content {
  text-align: center;
}

.damage-area {
  position: absolute;
  border: 2px solid #f56c6c;
  background: rgba(245, 108, 108, 0.2);
  cursor: pointer;
}

.damage-label {
  position: absolute;
  top: -18px;
  left: 0;
  background: #f56c6c;
  color: white;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
}

.action-buttons {
  margin-top: 15px;
  display: flex;
  gap: 10px;
}

.text-content,
.variant-content,
.ai-suggestions {
  padding: 10px 0;
}
</style>
