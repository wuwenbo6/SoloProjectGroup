<template>
  <div class="knowledge-page">
    <h2 class="page-title">病虫害知识库</h2>
    
    <el-row :gutter="20">
      <el-col :span="8" v-for="pest in pestList" :key="pest.id">
        <el-card class="pest-card" shadow="hover">
          <template #header>
            <div class="pest-header">
              <el-avatar :size="40" :style="{ backgroundColor: getPestColor(pest.pest_type) }">
                {{ pest.name_zh.charAt(0) }}
              </el-avatar>
              <div class="pest-title">
                <h3>{{ pest.name_zh }}</h3>
                <el-tag size="small">{{ pest.pest_type }}</el-tag>
              </div>
            </div>
          </template>
          
          <div class="pest-section">
            <div class="section-label">
              <el-icon><Reading /></el-icon>
              危害描述
            </div>
            <p class="section-content">{{ pest.damage }}</p>
          </div>
          
          <div class="pest-section">
            <div class="section-label">
              <el-icon><Tools /></el-icon>
              防治方法
            </div>
            <p class="section-content">{{ pest.control }}</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Reading, Tools } from '@element-plus/icons-vue'
import axios from 'axios'

const pestList = ref([])

const getPestColor = (type) => {
  const colors = {
    aphid: '#f56c6c',
    whitefly: '#e6a23c',
    thrips: '#67c23a',
    spider_mite: '#409eff',
    bollworm: '#909399',
    healthy: '#67c23a',
    unknown: '#909399'
  }
  return colors[type] || '#909399'
}

const loadKnowledge = async () => {
  try {
    const res = await axios.get('/api/v1/pest-knowledge')
    pestList.value = res.data
  } catch (e) {
    console.error('Failed to load knowledge:', e)
    pestList.value = [
      { id: 1, pest_type: 'aphid', name_zh: '蚜虫', description: '蚜虫又称蜜虫、腻虫等，属于同翅目蚜科，是植食性昆虫。', damage: '以成虫和若虫刺吸植物汁液，造成叶片皱缩、卷曲、变黄，同时传播病毒病。', control: '生物防治：释放瓢虫、草蛉等天敌；化学防治：使用吡虫啉、啶虫脒等杀虫剂。' },
      { id: 2, pest_type: 'whitefly', name_zh: '粉虱', description: '粉虱属于同翅目粉虱科，是一类体型微小的植食性昆虫。', damage: '刺吸植物汁液，导致叶片失绿、变黄、萎蔫，分泌蜜露诱发煤污病。', control: '物理防治：黄色粘虫板诱杀；生物防治：释放丽蚜小蜂；化学防治：噻虫嗪、溴氰虫酰胺。' },
      { id: 3, pest_type: 'thrips', name_zh: '蓟马', description: '蓟马属于缨翅目，体型微小，锉吸式口器。', damage: '锉吸植物叶片、花、果实汁液，造成银灰色斑点、叶片卷曲、果实畸形。', control: '物理防治：蓝色粘虫板；生物防治：释放捕食螨；化学防治：乙基多杀菌素。' },
      { id: 4, pest_type: 'spider_mite', name_zh: '红蜘蛛', description: '红蜘蛛属于叶螨科，是一类重要的农业害螨。', damage: '在叶片背面刺吸汁液，造成叶片失绿、出现白色斑点，严重时叶片干枯脱落。', control: '农业防治：清除杂草；生物防治：释放捕食螨；化学防治：阿维菌素、螺螨酯。' },
      { id: 5, pest_type: 'bollworm', name_zh: '棉铃虫', description: '棉铃虫属于鳞翅目夜蛾科，是世界性农业害虫。', damage: '幼虫蛀食蕾、花、果，也取食嫩叶，造成大量落蕾、落花、落果。', control: '物理防治：黑光灯诱杀成虫；生物防治：释放赤眼蜂；化学防治：氯虫苯甲酰胺。' },
      { id: 6, pest_type: 'healthy', name_zh: '健康', description: '作物生长状态良好，未发现病虫害。', damage: '无', control: '继续保持良好的田间管理。' }
    ]
  }
}

onMounted(() => {
  loadKnowledge()
})
</script>

<style scoped>
.knowledge-page {
  height: 100%;
}

.page-title {
  margin-bottom: 20px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.pest-card {
  margin-bottom: 20px;
  height: 100%;
}

.pest-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pest-title {
  flex: 1;
}

.pest-title h3 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.pest-section {
  margin-bottom: 15px;
}

.pest-section:last-child {
  margin-bottom: 0;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
  color: #409eff;
  margin-bottom: 8px;
}

.section-content {
  margin: 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}
</style>
