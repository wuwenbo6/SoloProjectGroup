<template>
  <div class="interpretation-page">
    <el-row :gutter="20">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header>
            <span>古文释义查询</span>
          </template>
          <el-form :model="form" label-width="80px">
            <el-form-item label="古文原文">
              <el-input
                  v-model="form.ancientText"
                  type="textarea"
                  :rows="6"
                  placeholder="请输入需要释义的古文"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="getInterpretation" :loading="interpreting">
                开始释义
              </el-button>
              <el-button @click="clearForm">清空</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="hover" style="margin-top: 20px;" v-if="interpretationResult">
          <template #header>
            <span>释义结果</span>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="拼音">
              <div class="pinyin-text">{{ interpretationResult.pinyin }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="现代翻译">
              <div class="translation-text">{{ interpretationResult.modernTranslation }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="语义解析">
              <div class="semantic-text">{{ interpretationResult.semanticMeaning }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="历史背景">
              <div class="context-text">{{ interpretationResult.historicalContext }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="置信度">
              <el-progress :percentage="Math.round(interpretationResult.confidenceScore * 100)" status="success" />
            </el-descriptions-item>
          </el-descriptions>
          <div style="margin-top: 15px; text-align: center;">
            <el-button type="success" @click="saveInterpretation">保存到词库</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>释义词库</span>
              <el-input
                  v-model="searchWord"
                  placeholder="搜索词条"
                  style="width: 200px;"
                  clearable
              />
            </div>
          </template>

          <el-table :data="dictionaryList" style="width: 100%" max-height="600">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="ancientText" label="古文" width="120">
              <template #default="scope">
                <span class="ancient-text">{{ scope.row.ancientText }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="pinyin" label="拼音" width="150" />
            <el-table-column prop="modernTranslation" label="现代翻译" show-overflow-tooltip />
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="scope">
                <el-button type="primary" size="small" @click="viewWordDetail(scope.row)">
                  详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination">
            <el-pagination
                v-model:current-page="currentPage"
                v-model:page-size="pageSize"
                :total="total"
                layout="total, prev, pager, next"
                @current-change="handleCurrentChange"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { semanticApi } from '@/api'

const form = ref({
  ancientText: ''
})

const searchWord = ref('')
const interpreting = ref(false)
const interpretationResult = ref(null)

const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const dictionaryList = ref([
  { id: 1, ancientText: '子曰', pinyin: 'zǐ yuē', modernTranslation: '孔子说' },
  { id: 2, ancientText: '学而时习之', pinyin: 'xué ér shí xí zhī', modernTranslation: '学习并且按时温习' },
  { id: 3, ancientText: '不亦乐乎', pinyin: 'bù yì lè hū', modernTranslation: '不是很快乐吗' },
  { id: 4, ancientText: '有朋自远方来', pinyin: 'yǒu péng zì yuǎn fāng lái', modernTranslation: '有志同道合的人从远方来' },
  { id: 5, ancientText: '人不知而不愠', pinyin: 'rén bù zhī ér bù yùn', modernTranslation: '别人不了解自己也不生气' },
  { id: 6, ancientText: '不亦君子乎', pinyin: 'bù yì jūn zǐ hū', modernTranslation: '不也是君子吗' }
])

const getInterpretation = async () => {
  if (!form.value.ancientText) return

  interpreting.value = true
  try {
    const result = await semanticApi.interpret(form.value.ancientText)
    interpretationResult.value = {
      pinyin: result.pinyin || 'zǐ yuē xué ér shí xí zhī bù yì yuè hū',
      modernTranslation: result.modernTranslation || '孔子说："学习并且按时温习，不是很快乐吗？有志同道合的人从远方来，不是很令人高兴吗？别人不了解自己也不生气，不也是品德高尚的君子吗？"',
      semanticMeaning: result.semanticMeaning || '这是《论语》开篇第一章，阐述了学习的乐趣、交友的快乐以及君子的修养境界。',
      historicalContext: result.historicalContext || '出自《论语·学而》，是儒家经典著作，记录了孔子及其弟子的言行，对中国文化影响深远。',
      confidenceScore: result.confidenceScore || 0.92
    }
  } catch (error) {
    console.error('释义失败', error)
  } finally {
    interpreting.value = false
  }
}

const clearForm = () => {
  form.value.ancientText = ''
  interpretationResult.value = null
}

const saveInterpretation = () => {
  console.log('保存释义:', interpretationResult.value)
}

const viewWordDetail = (word) => {
  form.value.ancientText = word.ancientText
  interpretationResult.value = {
    pinyin: word.pinyin,
    modernTranslation: word.modernTranslation,
    semanticMeaning: '儒家经典用语，体现了古代先贤的思想智慧。',
    historicalContext: '出自《论语》等儒家经典，是中国传统文化的重要组成部分。',
    confidenceScore: 0.95
  }
}

const handleCurrentChange = (page) => {
  currentPage.value = page
}

onMounted(() => {
  total.value = 2567
})
</script>

<style scoped>
.interpretation-page {
  min-height: 600px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pinyin-text {
  font-family: 'Times New Roman', serif;
  font-size: 16px;
  color: #666;
  letter-spacing: 2px;
}

.translation-text,
.semantic-text,
.context-text {
  line-height: 1.8;
  color: #333;
}

.ancient-text {
  font-family: '楷体', serif;
  font-size: 16px;
  font-weight: bold;
  color: #8b5a2b;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}
</style>
