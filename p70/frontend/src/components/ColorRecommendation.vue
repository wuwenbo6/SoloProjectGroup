<template>
  <div class="color-recommendation">
    <el-card shadow="hover" class="mb-4">
      <template #header>
        <div class="card-header">
          <span>🎨 脸谱色彩搭配推荐</span>
          <el-tag type="success" size="small">AI推荐</el-tag>
        </div>
      </template>
      <div class="category-selector mb-4">
        <span class="label">选择角色类型:</span>
        <el-radio-group v-model="selectedCategory" @change="generateRecommendations">
          <el-radio-button label="jing">净角</el-radio-button>
          <el-radio-button label="dan">旦角</el-radio-button>
          <el-radio-button label="sheng">生角</el-radio-button>
          <el-radio-button label="chou">丑角</el-radio-button>
          <el-radio-button label="mo">末角</el-radio-button>
        </el-radio-group>
      </div>
      <div v-if="baseColors && baseColors.length > 0" class="base-colors mb-4">
        <span class="label">已提取色彩:</span>
        <div class="color-chips">
          <div
            v-for="(color, index) in baseColors.slice(0, 6)"
            :key="index"
            class="color-chip"
            :style="{ backgroundColor: color.hex || color }"
            @click="selectBaseColor(color.hex || color)"
            :class="{ active: selectedBaseColor === (color.hex || color) }"
          >
            <span class="color-hex">{{ color.hex || color }}</span>
          </div>
        </div>
      </div>
    </el-card>
    <el-card v-if="recommendations" shadow="hover" class="mb-4">
      <template #header>
        <span>💡 智能配色方案</span>
      </template>
      <el-tabs v-if="recommendations.recommendations" type="border-card">
        <el-tab-pane
          v-for="(rec, index) in recommendations.recommendations"
          :key="index"
          :label="rec.name"
        >
          <div class="color-scheme">
            <div class="colors-preview">
              <div
                v-for="(color, cIndex) in rec.colors"
                :key="cIndex"
                class="preview-item"
                :style="{ backgroundColor: color }"
                @click="copyColor(color)"
              >
                <span class="color-value">{{ color }}</span>
              </div>
            </div>
            <div class="scheme-info">
              <el-tag type="warning" size="small">
                适配度: {{ (rec.suitability * 100).toFixed(0) }}%
              </el-tag>
              <p class="mt-2 text-gray-600">{{ rec.description }}</p>
            </div>
            <div v-if="getUsageGuidance(rec.name)" class="usage-guide mt-4">
              <h4>📝 脸谱绘制指南</h4>
              <ul class="guide-list">
                <li v-for="(value, key) in getUsageGuidance(rec.name)" :key="key">
                  <strong>{{ formatFieldName(key) }}:</strong> {{ value }}
                </li>
              </ul>
            </div>
            <el-button type="primary" size="small" class="mt-4" @click="applyScheme(rec)">
              应用此配色
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
      <div v-else class="preset-palettes">
        <div
          v-for="(palette, index) in recommendations.palettes"
          :key="index"
          class="palette-item"
        >
          <h4>{{ palette.name }}</h4>
          <div class="palette-colors">
            <div
              v-for="(color, cIndex) in palette.colors"
              :key="cIndex"
              class="palette-color"
              :style="{ backgroundColor: color }"
              @click="copyColor(color)"
            >
              {{ color }}
            </div>
          </div>
          <el-button type="text" size="small" @click="applyPalette(palette)">
            应用
          </el-button>
        </div>
      </div>
    </el-card>
    <el-card v-if="colorAnalysis" shadow="hover">
      <template #header>
        <span>🔍 色彩分析</span>
      </template>
      <div class="color-analysis">
        <div class="analysis-item">
          <span class="label">冷暖色调:</span>
          <el-tag :type="colorAnalysis.warmCold === 'warm' ? 'danger' : 'info'">
            {{ colorAnalysis.warmCold === 'warm' ? '暖色调' : colorAnalysis.warmCold === 'cold' ? '冷色调' : '中性色调' }}
          </el-tag>
        </div>
        <div class="analysis-item">
          <span class="label">色彩强度:</span>
          <el-tag type="warning">
            {{ colorAnalysis.intensity === 'high' ? '高饱和度' : colorAnalysis.intensity === 'medium' ? '中等饱和度' : '低饱和度' }}
          </el-tag>
        </div>
        <div class="analysis-item">
          <span class="label">性格象征:</span>
          <div class="personality-tags">
            <el-tag v-for="(trait, index) in colorAnalysis.personality" :key="index" size="small" class="mr-1">
              {{ trait }}
            </el-tag>
          </div>
        </div>
        <div v-if="colorAnalysis.suggestedCategories && colorAnalysis.suggestedCategories.length > 0" class="analysis-item">
          <span class="label">推荐角色:</span>
          <div class="category-suggestions">
            <div v-for="(suggestion, index) in colorAnalysis.suggestedCategories" :key="index" class="suggestion-item">
              <el-tag :type="suggestion.confidence > 0.8 ? 'success' : 'warning'" size="small">
                {{ getCategoryName(suggestion.category) }}
              </el-tag>
              <span class="confidence">{{ (suggestion.confidence * 100).toFixed(0) }}% - {{ suggestion.reason }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
const props = defineProps({
  colors: {
    type: Array,
    default: () => []
  },
  patternCategory: {
    type: String,
    default: 'jing'
  }
});
const emit = defineEmits(['apply-colors', 'apply-palette']);
const selectedCategory = ref('jing');
const selectedBaseColor = ref(null);
const recommendations = ref(null);
const colorAnalysis = ref(null);
const baseColors = ref([]);
onMounted(() => {
  selectedCategory.value = props.patternCategory;
  baseColors.value = props.colors;
  generateRecommendations();
});
watch(() => props.colors, (newColors) => {
  baseColors.value = newColors;
  generateRecommendations();
}, { deep: true });
watch(() => props.patternCategory, (newCat) => {
  selectedCategory.value = newCat;
  generateRecommendations();
});
const generateRecommendations = async () => {
  try {
    const response = await axios.post('/api/patterns/colors/recommend', {
      colors: baseColors.value,
      category: selectedCategory.value
    });
    recommendations.value = response.data;
    colorAnalysis.value = response.data.colorAnalysis;
  } catch (error) {
    console.error('获取色彩推荐失败:', error);
  }
};
const selectBaseColor = (color) => {
  selectedBaseColor.value = color;
  baseColors.value = [color];
  generateRecommendations();
};
const copyColor = (color) => {
  navigator.clipboard.writeText(color);
  ElMessage.success(`已复制颜色: ${color}`);
};
const getUsageGuidance = (schemeName) => {
  if (!recommendations.value?.usageGuidance) return null;
  const guidance = recommendations.value.usageGuidance.find(g => g.name === schemeName);
  return guidance?.guidance;
};
const formatFieldName = (field) => {
  const names = {
    faceBase: '面部底色',
    outline: '轮廓线条',
    eyebrow: '眉部造型',
    eyes: '眼部处理',
    mouth: '嘴部画法',
    decorative: '装饰纹样'
  };
  return names[field] || field;
};
const getCategoryName = (category) => {
  const names = {
    jing: '净角',
    dan: '旦角',
    sheng: '生角',
    chou: '丑角',
    mo: '末角'
  };
  return names[category] || category;
};
const applyScheme = (scheme) => {
  emit('apply-colors', scheme.colors);
  ElMessage.success('已应用配色方案');
};
const applyPalette = (palette) => {
  emit('apply-palette', palette.colors);
  ElMessage.success('已应用预设调色板');
};
</script>
<style scoped>
.color-recommendation {
  max-width: 100%;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.category-selector .label,
.base-colors .label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}
.color-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.color-chip {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 2px solid transparent;
}
.color-chip:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.color-chip.active {
  border-color: #409eff;
}
.color-hex {
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  color: #333;
  margin-bottom: 4px;
}
.colors-preview {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.preview-item {
  flex: 1;
  height: 80px;
  border-radius: 8px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
}
.preview-item:hover {
  transform: scale(1.02);
}
.color-value {
  background: rgba(255, 255, 255, 0.95);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  margin-bottom: 8px;
}
.scheme-info {
  margin-bottom: 16px;
}
.usage-guide h4 {
  margin-bottom: 8px;
  color: #606266;
}
.guide-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.guide-list li {
  padding: 4px 0;
  font-size: 13px;
  color: #606266;
}
.preset-palettes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.palette-item {
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}
.palette-item h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
}
.palette-colors {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}
.palette-color {
  flex: 1;
  height: 40px;
  border-radius: 4px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  font-size: 9px;
  color: transparent;
  cursor: pointer;
  transition: color 0.2s;
}
.palette-color:hover {
  color: #333;
  background: rgba(255, 255, 255, 0.8);
}
.color-analysis {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.analysis-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.analysis-item .label {
  min-width: 80px;
  font-weight: 500;
}
.personality-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.category-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.confidence {
  font-size: 12px;
  color: #909399;
}
@media (max-width: 768px) {
  .colors-preview {
    flex-wrap: wrap;
  }
  .preview-item {
    min-width: 60px;
  }
  .preset-palettes {
    grid-template-columns: 1fr;
  }
  .color-chip {
    width: 50px;
    height: 50px;
  }
}
</style>
