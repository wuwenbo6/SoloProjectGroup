<template>
  <div class="app-container" :class="{ dark: darkMode }">
    <header class="app-header">
      <div class="header-content">
        <div class="header-title">
          <h1>字体排版调试工具</h1>
          <p>上传字体，实时预览，调试字间距</p>
        </div>
        <div class="header-actions">
          <button class="theme-toggle" @click="darkMode = !darkMode">
            {{ darkMode ? '☀️' : '🌙' }}
          </button>
          <div class="network-status" :class="{ online: isOnline }">
            <span class="status-dot"></span>
            <span>{{ isOnline ? '在线' : '离线' }}</span>
          </div>
          <button class="user-center-btn" @click="showUserCenter = true">
            👤 个人中心
          </button>
        </div>
      </div>
    </header>

    <div class="copyright-warning" v-if="currentCopyrightWarning">
      <div class="warning-content">
        <span class="warning-icon">⚠️</span>
        <div class="warning-text">
          <strong>版权提示</strong>
          <pre>{{ currentCopyrightWarning }}</pre>
        </div>
        <button class="close-btn" @click="currentCopyrightWarning = null">✕</button>
      </div>
    </div>

    <div class="main-content">
      <aside class="sidebar">
        <div class="upload-section">
          <h3>上传字体</h3>
          <div class="upload-area" @click="triggerUpload" @dragover.prevent @drop.prevent="handleDrop">
            <input ref="fileInput" type="file" accept=".ttf,.otf,.woff,.woff2" @change="handleFileChange" hidden />
            <div class="upload-icon">📁</div>
            <p>点击或拖拽上传字体文件</p>
            <p class="upload-hint">支持 TTF、OTF、WOFF、WOFF2 格式</p>
          </div>
          <div v-if="uploading" class="uploading">上传中...</div>
        </div>

        <div class="view-toggle">
          <button :class="{ active: !compareMode }" @click="compareMode = false">单字体预览</button>
          <button :class="{ active: compareMode }" @click="compareMode = true">字体对比</button>
        </div>

        <div class="fonts-list" v-if="fonts.length > 0">
          <h3>已上传字体</h3>
          <div class="font-item" v-for="font in fonts" :key="font.id" @click="selectFont(font)" :class="{ active: selectedFont?.id === font.id, 'compare-active': compareMode && (selectedFont?.id === font.id || selectedFont2?.id === font.id) }">
            <div class="font-name">{{ font.name }}</div>
            <div class="font-info">{{ font.familyName }} - {{ font.styleName }}</div>
            <div class="font-copyright" v-if="font.copyright" :class="font.copyright.riskLevel">
              <span v-if="font.copyright.riskLevel === 'high'">🔴 高风险</span>
              <span v-else-if="font.copyright.riskLevel === 'medium'">🟡 中风险</span>
              <span v-else>🟢 低风险</span>
            </div>
            <div class="font-size-info" v-if="font.optimized">
              <span class="original-size">原: {{ formatSize(font.fileSize) }}</span>
              <span v-if="font.optimized.sizes?.woff2" class="optimized-size">→ WOFF2: {{ formatSize(font.optimized.sizes.woff2) }}</span>
            </div>
            <div class="font-actions" v-if="compareMode">
              <button class="select-btn" @click.stop="selectForCompare(1, font)">字体1</button>
              <button class="select-btn" @click.stop="selectForCompare(2, font)">字体2</button>
            </div>
            <div class="font-actions" v-else>
              <button class="download-btn" @click.stop="downloadFont(font, 'woff2')" v-if="font.optimized?.woff2">WOFF2</button>
              <button class="download-btn" @click.stop="downloadFont(font, 'otf')" v-if="font.optimized?.otf">OTF</button>
              <button class="download-btn" @click.stop="downloadFont(font, 'original')">原文件</button>
              <button class="delete-btn" @click.stop="deleteFont(font.id)">删除</button>
            </div>
          </div>
        </div>

        <div class="configs-list" v-if="configs.length > 0">
          <h3>已保存配置</h3>
          <div class="config-item" v-for="config in configs" :key="config.id" @click="loadConfig(config)">
            <div class="config-name">{{ config.name }}</div>
            <div class="config-actions">
              <button class="share-btn" @click.stop="shareConfig(config.id!)">分享</button>
              <button class="export-btn" @click.stop="exportConfig(config.id!)">导出</button>
              <button class="delete-btn" @click.stop="deleteConfig(config.id!)">删除</button>
            </div>
          </div>
        </div>
      </aside>

      <main class="preview-area">
        <div v-if="!compareMode && !selectedFont" class="empty-state">
          <div class="empty-icon">✨</div>
          <h2>请选择或上传字体开始预览</h2>
          <p>上传自定义字体文件，体验实时排版预览</p>
        </div>

        <div v-if="compareMode && (!selectedFont || !selectedFont2)" class="empty-state">
          <div class="empty-icon">⚡</div>
          <h2>字体对比模式</h2>
          <p>请在左侧列表中选择两个字体进行对比</p>
          <p v-if="selectedFont" class="hint">✓ 已选择字体1: {{ selectedFont.name }}</p>
          <p v-if="selectedFont2" class="hint">✓ 已选择字体2: {{ selectedFont2.name }}</p>
        </div>

        <div v-if="compareMode && selectedFont && selectedFont2" class="compare-container">
          <div class="compare-view">
            <div class="compare-font">
              <div class="compare-header">
                <h3>字体 1: {{ selectedFont.name }}</h3>
                <span>{{ selectedFont.familyName }}</span>
              </div>
              <div class="preview-content" :style="getPreviewStyle(1)">
                <div class="preview-text">
                  <template v-for="(char, index) in displayText" :key="index">
                    <br v-if="char === '\n'" />
                    <span v-else :style="getCharStyle(index, 1)">
                      {{ char }}
                    </span>
                  </template>
                </div>
              </div>
            </div>
            <div class="compare-font">
              <div class="compare-header">
                <h3>字体 2: {{ selectedFont2.name }}</h3>
                <span>{{ selectedFont2.familyName }}</span>
              </div>
              <div class="preview-content" :style="getPreviewStyle(2)">
                <div class="preview-text">
                  <template v-for="(char, index) in displayText" :key="index">
                    <br v-if="char === '\n'" />
                    <span v-else :style="getCharStyle(index, 2)">
                      {{ char }}
                    </span>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="!compareMode && selectedFont" class="preview-container">
          <div class="preview-header">
            <h2>{{ selectedFont.name }}</h2>
            <div class="font-meta">
              <span>字重: {{ selectedFont.unitsPerEm }}</span>
              <span>字形数: {{ selectedFont.numGlyphs }}</span>
            </div>
          </div>

          <div class="color-controls">
            <div class="control-group">
              <label>背景颜色</label>
              <input type="color" v-model="previewBgColor" />
            </div>
            <div class="control-group">
              <label>文字颜色</label>
              <input type="color" v-model="previewTextColor" />
            </div>
          </div>

          <div class="preview-content" :style="previewStyle">
            <div ref="previewTextRef" class="preview-text">
              <template v-for="(char, index) in displayText" :key="index">
                <br v-if="char === '\n'" />
                <span v-else :style="getCharStyle(index)">
                  {{ char }}
                </span>
              </template>
            </div>
          </div>

          <div class="control-panel">
            <div class="control-group">
              <label>预览文本</label>
              <textarea v-model="config.text" rows="3" placeholder="输入预览文本..." />
            </div>

            <div class="control-row">
              <div class="control-group">
                <label>字号: {{ config.fontSize }}px</label>
                <input type="range" v-model.number="config.fontSize" min="12" max="200" />
              </div>

              <div class="control-group">
                <label>字间距: {{ config.letterSpacing }}em</label>
                <input type="range" v-model.number="config.letterSpacing" min="-0.5" max="2" step="0.01" />
              </div>
            </div>

            <div class="control-row">
              <div class="control-group">
                <label>行高: {{ config.lineHeight }}</label>
                <input type="range" v-model.number="config.lineHeight" min="1" max="3" step="0.1" />
              </div>

              <div class="control-group">
                <label>对齐方式</label>
                <select v-model="config.textAlign">
                  <option value="left">左对齐</option>
                  <option value="center">居中</option>
                  <option value="right">右对齐</option>
                  <option value="justify">两端对齐</option>
                </select>
              </div>
            </div>
          </div>

          <div class="kerning-panel">
            <h3>字距调试</h3>
            <div class="kerning-input">
              <div class="char-selectors">
                <select v-model="selectedLeftChar">
                  <option value="">选择左字符</option>
                  <option v-for="glyph in availableGlyphs" :key="glyph.unicode" :value="glyph.char">
                    {{ glyph.char }} - {{ glyph.name }}
                  </option>
                </select>
                <span class="arrow">→</span>
                <select v-model="selectedRightChar">
                  <option value="">选择右字符</option>
                  <option v-for="glyph in availableGlyphs" :key="glyph.unicode" :value="glyph.char">
                    {{ glyph.char }} - {{ glyph.name }}
                  </option>
                </select>
              </div>
              <div class="kerning-control" v-if="selectedLeftChar && selectedRightChar">
                <label>字距值: {{ currentKerning }}em</label>
                <input type="range" v-model.number="currentKerning" min="-1" max="2" step="0.01" />
                <button class="reset-btn" @click="resetKerning">重置</button>
              </div>
            </div>
            <div class="kerning-preview" :style="previewStyle">
              <span :style="getKerningPreviewStyle()">{{ selectedLeftChar || 'A' }}{{ selectedRightChar || 'V' }}</span>
            </div>
            <div class="custom-kernings-list">
              <div class="kernings-header">
                <h4>自定义字距 ({{ Object.keys(config.customKernings).length }})</h4>
                <div class="kernings-actions">
                  <input ref="kerningImportInput" type="file" accept=".json" @change="importKernings" hidden />
                  <button class="import-btn" @click="triggerKerningImport">📥 导入</button>
                  <button class="export-btn" @click="exportKernings">📤 导出</button>
                  <button class="clear-btn" @click="clearAllKernings" v-if="Object.keys(config.customKernings).length > 0">清空</button>
                </div>
              </div>
              <div class="kerning-item" v-for="(value, key) in config.customKernings" :key="key">
                <span class="kerning-pair">{{ key }}</span>
                <input type="number" v-model.number="config.customKernings[key]" step="0.01" class="kerning-input-inline" @change="kerningUpdateTrigger++" />
                <span class="kerning-unit">em</span>
                <button class="remove-btn" @click="removeKerning(key)">×</button>
              </div>
              <div class="empty-kernings" v-if="Object.keys(config.customKernings).length === 0">
                <p>暂无自定义字距，请在上方添加</p>
              </div>
            </div>
          </div>

          <div class="subset-panel">
            <h4>✂️ 字符集筛选（生成精简版）</h4>
            <div class="subset-controls">
              <div class="preset-chars">
                <button @click="subsetChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'">大写字母</button>
                <button @click="subsetChars = 'abcdefghijklmnopqrstuvwxyz'">小写字母</button>
                <button @click="subsetChars = '0123456789'">数字</button>
                <button @click="subsetChars = '，。！？、；：""''（）【】'">常用标点</button>
              </div>
              <textarea v-model="subsetChars" placeholder="输入需要保留的字符，去重后生成..." rows="3" />
              <div class="subset-info">
                <span>已选择: {{ new Set(subsetChars).size }} 个字符</span>
              </div>
              <div class="subset-actions">
                <button class="subset-btn" @click="generateSubset('ttf')" :disabled="!subsetChars.trim()">生成 TTF</button>
                <button class="subset-btn" @click="generateSubset('woff2')" :disabled="!subsetChars.trim()">生成 WOFF2</button>
              </div>
            </div>
            <div v-if="subsetLoading" class="subset-loading">正在生成精简版字体...</div>
            <div v-if="subsetResult" class="subset-result">
              <span>✓ 成功生成，包含 {{ subsetResult.glyphCount }} 个字形</span>
              <button class="download-subset" @click="downloadSubset()">下载</button>
            </div>
          </div>

          <div class="export-panel">
            <h4>🖼️ 导出预览图片</h4>
            <div class="export-controls">
              <div class="export-format">
                <label>格式:</label>
                <select v-model="exportFormat">
                  <option value="png">PNG</option>
                  <option value="svg">SVG</option>
                </select>
              </div>
              <div class="export-size">
                <label>缩放:</label>
                <select v-model="exportScale">
                  <option :value="1">1x</option>
                  <option :value="2">2x</option>
                  <option :value="3">3x</option>
                </select>
              </div>
              <button class="export-img-btn" @click="exportPreviewImage">导出图片</button>
            </div>
            <canvas ref="exportCanvas" class="export-canvas" style="display: none"></canvas>
          </div>

          <div class="save-panel">
            <input type="text" v-model="config.name" placeholder="配置名称..." />
            <button class="save-btn" @click="saveConfig">保存配置</button>
            <button class="export-btn" @click="exportCurrentConfig">导出 JSON</button>
          </div>
        </div>
      </main>
    </div>

    <div class="user-center-modal" v-if="showUserCenter" @click.self="showUserCenter = false">
      <div class="user-center-content">
        <div class="modal-header">
          <h2>👤 个人中心</h2>
          <button class="close-btn" @click="showUserCenter = false">✕</button>
        </div>
        <div class="user-stats">
          <div class="stat-item">
            <span class="stat-icon">📁</span>
            <span class="stat-value">{{ fonts.length }}</span>
            <span class="stat-label">字体文件</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">⚙️</span>
            <span class="stat-value">{{ configs.length }}</span>
            <span class="stat-label">排版配置</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🔗</span>
            <span class="stat-value">{{ shareLinks.length }}</span>
            <span class="stat-label">分享链接</span>
          </div>
        </div>
        <div class="share-links-section" v-if="shareLinks.length > 0">
          <h3>我的分享链接</h3>
          <div class="share-link-item" v-for="link in shareLinks" :key="link.id">
            <div class="share-info">
              <span class="share-code">{{ link.shareCode }}</span>
              <span class="share-views">{{ link.views }} 次查看</span>
            </div>
            <div class="share-actions">
              <button class="copy-btn" @click="copyShareLink(link.shareCode)">复制链接</button>
              <button class="delete-btn" @click="deleteShareLink(link.id)">删除</button>
            </div>
          </div>
        </div>
        <div class="offline-notice" v-if="!isOnline">
          <p>⚠️ 离线模式下，部分功能可能受限</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue';
import { fontApi, configApi, userApi } from './api';
import { FontCache } from './utils/fontCache';
import type { FontMetadata, TypographyConfig, ShareLink } from './types';

const fileInput = ref<HTMLInputElement>();
const kerningImportInput = ref<HTMLInputElement>();
const previewTextRef = ref<HTMLDivElement>();
const exportCanvas = ref<HTMLCanvasElement>();

const fonts = ref<FontMetadata[]>([]);
const configs = ref<TypographyConfig[]>([]);
const shareLinks = ref<ShareLink[]>([]);
const selectedFont = ref<FontMetadata>();
const selectedFont2 = ref<FontMetadata>();
const compareMode = ref(false);
const uploading = ref(false);
const isOnline = ref(navigator.onLine);
const showUserCenter = ref(false);
const darkMode = ref(false);
const currentCopyrightWarning = ref<string | null>(null);

const previewBgColor = ref('#f5f7fa');
const previewTextColor = ref('#000000');

const selectedLeftChar = ref('');
const selectedRightChar = ref('');

const subsetChars = ref('');
const subsetLoading = ref(false);
const subsetResult = ref<{ buffer: ArrayBuffer; mimeType: string; glyphCount: number } | null>(null);

const exportFormat = ref<'png' | 'svg'>('png');
const exportScale = ref(1);

let fontParserWorker: Worker | null = null;
const fontFileData = new Map<string, ArrayBuffer>();

const config = ref<TypographyConfig>({
  name: '',
  fontId: '',
  text: 'Hello World! 你好世界！\nThe quick brown fox jumps over the lazy dog.',
  fontSize: 48,
  letterSpacing: 0,
  lineHeight: 1.5,
  textAlign: 'left',
  customKernings: {},
});

const displayText = computed(() => config.value.text.split(''));

const availableGlyphs = computed(() => {
  if (!selectedFont.value) return [];
  return selectedFont.value.glyphs.filter(glyph => {
    const code = glyph.unicode;
    return (code >= 32 && code <= 126) || (code >= 19968 && code <= 40869);
  }).slice(0, 100);
});

const kerningUpdateTrigger = ref(0);

const currentKerning = computed({
  get: () => {
    const key = `${selectedLeftChar.value}${selectedRightChar.value}`;
    return config.value.customKernings[key] || 0;
  },
  set: (val) => {
    const key = `${selectedLeftChar.value}${selectedRightChar.value}`;
    config.value.customKernings[key] = val;
    kerningUpdateTrigger.value++;
  },
});

const previewStyle = computed(() => {
  kerningUpdateTrigger.value;
  if (!selectedFont.value) return {};
  return {
    fontFamily: `'CustomFont-${selectedFont.value.id}', sans-serif`,
    fontSize: `${config.value.fontSize}px`,
    letterSpacing: `${config.value.letterSpacing}em`,
    lineHeight: config.value.lineHeight,
    textAlign: config.value.textAlign,
    backgroundColor: previewBgColor.value,
    color: previewTextColor.value,
  };
});

function getPreviewStyle(fontNum: number) {
  kerningUpdateTrigger.value;
  const font = fontNum === 1 ? selectedFont.value : selectedFont2.value;
  if (!font) return {};
  return {
    fontFamily: `'CustomFont-${font.id}', sans-serif`,
    fontSize: `${config.value.fontSize}px`,
    letterSpacing: `${config.value.letterSpacing}em`,
    lineHeight: config.value.lineHeight,
    textAlign: config.value.textAlign,
    backgroundColor: previewBgColor.value,
    color: previewTextColor.value,
  };
}

function getCharStyle(index: number, fontNum?: number) {
  kerningUpdateTrigger.value;
  const text = config.value.text;
  if (index >= text.length - 1) return {};
  
  const leftChar = text[index];
  const rightChar = text[index + 1];
  const key = `${leftChar}${rightChar}`;
  const kerning = config.value.customKernings[key];
  
  if (kerning !== undefined) {
    return {
      marginRight: `${kerning}em`,
    };
  }
  return {};
}

function getKerningPreviewStyle() {
  kerningUpdateTrigger.value;
  const key = `${selectedLeftChar.value}${selectedRightChar.value}`;
  const kerning = config.value.customKernings[key] || 0;
  return {
    letterSpacing: `${kerning}em`,
    color: previewTextColor.value,
  };
}

function triggerUpload() {
  fileInput.value?.click();
}

function handleDrop(e: DragEvent) {
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    processFile(files[0]);
  }
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    processFile(target.files[0]);
  }
}

async function processFile(file: File) {
  uploading.value = true;
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    const response = await fontApi.uploadFont(file);
    if (response.success) {
      fonts.value.push(response.data);
      fontFileData.set(response.data.id, arrayBuffer);
      selectFont(response.data);
      loadFontFace(response.data);
      
      await FontCache.saveFont(response.data, arrayBuffer);
      
      if (response.copyrightWarning) {
        currentCopyrightWarning.value = response.copyrightWarning;
      }
    }
  } catch (error) {
    alert('字体上传失败: ' + (error as Error).message);
  } finally {
    uploading.value = false;
  }
}

function loadFontFace(font: FontMetadata) {
  let fontUrl = `/uploads/${font.fileName}`;
  
  if (font.optimized?.woff2) {
    fontUrl = `/uploads/${font.optimized.woff2}`;
  }
  
  const fontFace = new FontFace(
    `CustomFont-${font.id}`,
    `url(${fontUrl})`
  );
  fontFace.load().then((loadedFace) => {
    document.fonts.add(loadedFace);
  }).catch((error) => {
    console.warn(`Failed to load optimized font, fallback to original:`, error);
    const fallbackFace = new FontFace(
      `CustomFont-${font.id}`,
      `url(/uploads/${font.fileName})`
    );
    fallbackFace.load().then((loadedFace) => {
      document.fonts.add(loadedFace);
    });
  });
}

function selectFont(font: FontMetadata) {
  selectedFont.value = font;
  config.value.fontId = font.id;
  loadFontFace(font);
}

function selectForCompare(num: number, font: FontMetadata) {
  if (num === 1) {
    selectedFont.value = font;
  } else {
    selectedFont2.value = font;
  }
  loadFontFace(font);
}

async function deleteFont(id: string) {
  if (confirm('确定删除此字体？')) {
    await fontApi.deleteFont(id);
    fonts.value = fonts.value.filter(f => f.id !== id);
    if (selectedFont.value?.id === id) {
      selectedFont.value = undefined;
    }
    if (selectedFont2.value?.id === id) {
      selectedFont2.value = undefined;
    }
    await FontCache.deleteFont(id);
  }
}

function resetKerning() {
  const key = `${selectedLeftChar.value}${selectedRightChar.value}`;
  delete config.value.customKernings[key];
  kerningUpdateTrigger.value++;
}

function removeKerning(key: string) {
  delete config.value.customKernings[key];
  kerningUpdateTrigger.value++;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function downloadFont(font: FontMetadata, format: string) {
  const link = document.createElement('a');
  link.href = `/api/fonts/${font.id}/download/${format}`;
  link.download = `${font.name}.${format === 'original' ? font.originalFormat : format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function clearAllKernings() {
  if (confirm('确定要清空所有自定义字距吗？')) {
    config.value.customKernings = {};
    kerningUpdateTrigger.value++;
  }
}

function triggerKerningImport() {
  kerningImportInput.value?.click();
}

function importKernings(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data && typeof data === 'object') {
        const validKernings: { [key: string]: number } = {};
        Object.entries(data).forEach(([key, value]) => {
          if (typeof key === 'string' && key.length === 2 && typeof value === 'number') {
            validKernings[key] = value;
          }
        });
        config.value.customKernings = validKernings;
        kerningUpdateTrigger.value++;
        alert(`成功导入 ${Object.keys(validKernings).length} 个字距设置！`);
      }
    } catch (error) {
      alert('导入失败：文件格式错误');
    }
  };
  reader.readAsText(file);
  (event.target as HTMLInputElement).value = '';
}

function exportKernings() {
  const kernCount = Object.keys(config.value.customKernings).length;
  if (kernCount === 0) {
    alert('没有字距设置可导出');
    return;
  }
  const dataStr = JSON.stringify(config.value.customKernings, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kerning-config-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const presets = {
  title: {
    text: 'Hello World\n你好世界',
    fontSize: 72,
    letterSpacing: 0.02,
    lineHeight: 1.2,
    textAlign: 'center',
  },
  body: {
    text: '这是一段正文示例文本。The quick brown fox jumps over the lazy dog. 排版是将文字按照视觉美学原则进行组织与安排的过程，优秀的排版能够提升阅读体验与信息传达的效率。',
    fontSize: 18,
    letterSpacing: 0,
    lineHeight: 1.8,
    textAlign: 'left',
  },
  code: {
    text: 'function hello() {\n  console.log("Hello World!");\n  return true;\n}',
    fontSize: 16,
    letterSpacing: 0,
    lineHeight: 1.5,
    textAlign: 'left',
  },
  poster: {
    text: '创意无限\nCREATE\nYOUR\nSTYLE',
    fontSize: 96,
    letterSpacing: 0.1,
    lineHeight: 1.1,
    textAlign: 'center',
  },
};

type PresetType = keyof typeof presets;

function applyPreset(type: PresetType) {
  const preset = presets[type];
  config.value.text = preset.text;
  config.value.fontSize = preset.fontSize;
  config.value.letterSpacing = preset.letterSpacing;
  config.value.lineHeight = preset.lineHeight;
  config.value.textAlign = preset.textAlign as TypographyConfig['textAlign'];
}

async function generateSubset(format: 'ttf' | 'woff2') {
  if (!selectedFont.value || !subsetChars.value.trim()) return;
  
  subsetLoading.value = true;
  subsetResult.value = null;
  
  try {
    if (fontParserWorker) {
      fontParserWorker.postMessage({
        type: 'subset',
        fileData: fontFileData.get(selectedFont.value.id),
        characters: [...new Set(subsetChars.value)].join(''),
        format,
      });
    }
  } catch (error) {
    alert('生成失败: ' + (error as Error).message);
    subsetLoading.value = false;
  }
}

function downloadSubset() {
  if (!subsetResult.value || !selectedFont.value) return;
  
  const blob = new Blob([subsetResult.value.buffer], { type: subsetResult.value.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${selectedFont.value.name}-subset.ttf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportPreviewImage() {
  if (!previewTextRef.value || !selectedFont.value) return;
  
  const canvas = exportCanvas.value!;
  const ctx = canvas.getContext('2d')!;
  const scale = exportScale.value;
  const padding = 40 * scale;
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = previewTextRef.value.innerHTML;
  tempDiv.style.cssText = `
    font-family: 'CustomFont-${selectedFont.value.id}', sans-serif;
    font-size: ${config.value.fontSize * scale}px;
    letter-spacing: ${config.value.letterSpacing}em;
    line-height: ${config.value.lineHeight};
    text-align: ${config.value.textAlign};
    position: absolute;
    left: -9999px;
    white-space: pre-wrap;
  `;
  document.body.appendChild(tempDiv);
  
  const rect = tempDiv.getBoundingClientRect();
  canvas.width = rect.width + padding * 2;
  canvas.height = rect.height + padding * 2;
  
  ctx.fillStyle = previewBgColor.value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = previewTextColor.value;
  ctx.font = `${config.value.fontSize * scale}px 'CustomFont-${selectedFont.value.id}', sans-serif`;
  ctx.textBaseline = 'top';
  
  const lines = config.value.text.split('\n');
  const lineHeight = config.value.fontSize * config.value.lineHeight * scale;
  let y = padding;
  
  lines.forEach((line) => {
    let x = padding;
    if (config.value.textAlign === 'center') {
      const metrics = ctx.measureText(line);
      x = (canvas.width - metrics.width) / 2;
    } else if (config.value.textAlign === 'right') {
      const metrics = ctx.measureText(line);
      x = canvas.width - padding - metrics.width;
    }
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      let kerning = 0;
      
      if (nextChar) {
        const key = char + nextChar;
        kerning = (config.value.customKernings[key] || 0) * config.value.fontSize * scale;
      }
      
      ctx.fillText(char, x, y);
      x += ctx.measureText(char).width + kerning + config.value.letterSpacing * config.value.fontSize * scale;
    }
    y += lineHeight;
  });
  
  document.body.removeChild(tempDiv);
  
  if (exportFormat.value === 'png') {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${selectedFont.value.name}-preview.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } else {
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="
            font-family: 'CustomFont-${selectedFont.value.id}', sans-serif;
            font-size: ${config.value.fontSize * scale}px;
            letter-spacing: ${config.value.letterSpacing}em;
            line-height: ${config.value.lineHeight};
            text-align: ${config.value.textAlign};
            padding: ${padding}px;
            background: ${previewBgColor.value};
            color: ${previewTextColor.value};
          ">${config.value.text.replace(/\n/g, '<br/>')}</div>
        </foreignObject>
      </svg>
    `;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFont.value.name}-preview.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}

async function saveConfig() {
  if (!config.value.name) {
    alert('请输入配置名称');
    return;
  }
  try {
    const response = await configApi.saveConfig(config.value);
    if (response.success) {
      config.value = response.data;
      loadConfigs();
      alert('配置保存成功！');
    }
  } catch (error) {
    alert('保存失败: ' + (error as Error).message);
  }
}

function loadConfig(cfg: TypographyConfig) {
  config.value = { ...cfg, customKernings: { ...cfg.customKernings } };
  kerningUpdateTrigger.value++;
  const font = fonts.value.find(f => f.id === cfg.fontId);
  if (font) {
    selectFont(font);
  }
}

async function deleteConfig(id: string) {
  if (confirm('确定删除此配置？')) {
    await configApi.deleteConfig(id);
    loadConfigs();
  }
}

async function exportConfig(id: string) {
  await configApi.exportConfig(id);
}

function exportCurrentConfig() {
  const dataStr = JSON.stringify(config.value, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${config.value.name || 'typography'}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function shareConfig(configId: string) {
  try {
    const response = await configApi.shareConfig(configId);
    if (response.success) {
      shareLinks.value.push(response.data);
      copyShareLink(response.data.shareCode);
    }
  } catch (error) {
    alert('创建分享链接失败');
  }
}

function copyShareLink(shareCode: string) {
  const link = `${window.location.origin}/share/${shareCode}`;
  navigator.clipboard.writeText(link).then(() => {
    alert('分享链接已复制到剪贴板！');
  });
}

async function deleteShareLink(shareId: string) {
  if (confirm('确定删除此分享链接？')) {
    await userApi.deleteShareLink(shareId);
    shareLinks.value = shareLinks.value.filter(s => s.id !== shareId);
  }
}

async function loadFonts() {
  try {
    if (isOnline.value) {
      const response = await fontApi.getAllFonts();
      if (response.success) {
        fonts.value = response.data;
        response.data.forEach(loadFontFace);
        return;
      }
    }
  } catch {
    console.log('Network unavailable, using cached fonts');
  }
  
  const cachedFonts = await FontCache.getAllFonts();
  fonts.value = cachedFonts;
  cachedFonts.forEach(font => {
    loadFontFaceFromCache(font);
  });
}

async function loadConfigs() {
  try {
    if (isOnline.value) {
      const response = await configApi.getAllConfigs();
      if (response.success) {
        configs.value = response.data;
        return;
      }
    }
  } catch {
    console.log('Network unavailable, using cached configs');
  }
  
  const cachedConfigs = await FontCache.getAllConfigs();
  configs.value = cachedConfigs;
}

function loadFontFaceFromCache(font: FontMetadata) {
  FontCache.getFont(font.id).then(cached => {
    if (cached) {
      const blob = new Blob([cached.data], { type: 'font/opentype' });
      const url = URL.createObjectURL(blob);
      const fontFace = new FontFace(`CustomFont-${font.id}`, `url(${url})`);
      fontFace.load().then((loadedFace) => {
        document.fonts.add(loadedFace);
        fontFileData.set(font.id, cached.data);
      });
    }
  });
}

function initWorker() {
  if (typeof Worker !== 'undefined') {
    fontParserWorker = new Worker(
      new URL('./worker/fontParser.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    fontParserWorker.onmessage = (event) => {
      if (event.data.success) {
        if (event.data.type === 'subset') {
          subsetResult.value = event.data.data;
        }
        subsetLoading.value = false;
      } else {
        alert('处理失败: ' + event.data.error);
        subsetLoading.value = false;
      }
    };
  }
}

onMounted(() => {
  initWorker();
  loadFonts();
  loadConfigs();
  
  FontCache.onNetworkChange((online) => {
    isOnline.value = online;
    if (online) {
      loadFonts();
      loadConfigs();
    }
  });
});

onUnmounted(() => {
  fontParserWorker?.terminate();
});
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.app-container.dark {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.app-header {
  text-align: center;
  color: white;
  margin-bottom: 30px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1600px;
  margin: 0 auto;
}

.header-title {
  flex: 1;
  text-align: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.theme-toggle, .user-center-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 0.9rem;
}

.theme-toggle:hover, .user-center-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.app-header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.app-header p {
  opacity: 0.9;
  font-size: 1.1rem;
}

.network-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 0.9rem;
}

.network-status.online .status-dot {
  background: #4ade80;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f87171;
}

.copyright-warning {
  max-width: 1600px;
  margin: 0 auto 20px;
  background: #fff3cd;
  border-radius: 12px;
  padding: 15px 20px;
  border: 2px solid #ffc107;
}

.dark .copyright-warning {
  background: #856404;
  border-color: #ffc107;
  color: white;
}

.warning-content {
  display: flex;
  align-items: flex-start;
  gap: 15px;
}

.warning-icon {
  font-size: 1.5rem;
}

.warning-text pre {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.9rem;
  margin-top: 5px;
  line-height: 1.5;
}

.copyright-warning .close-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  opacity: 0.7;
}

.main-content {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

.sidebar {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  max-height: calc(100vh - 150px);
  overflow-y: auto;
}

.dark .sidebar {
  background: #1a1a2e;
  color: white;
}

.upload-section h3,
.fonts-list h3,
.configs-list h3 {
  color: #333;
  margin-bottom: 15px;
  font-size: 1.1rem;
}

.dark .upload-section h3,
.dark .fonts-list h3,
.dark .configs-list h3 {
  color: #e0e0e0;
}

.upload-area {
  border: 2px dashed #ddd;
  border-radius: 12px;
  padding: 30px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #f8f9fa;
}

.dark .upload-area {
  background: #16213e;
  border-color: #333;
}

.upload-area:hover {
  border-color: #667eea;
  background: #f0f4ff;
}

.dark .upload-area:hover {
  background: #1a1a2e;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 10px;
}

.upload-area p {
  color: #666;
  margin: 5px 0;
}

.dark .upload-area p {
  color: #aaa;
}

.upload-hint {
  font-size: 0.85rem;
  opacity: 0.7;
}

.uploading {
  text-align: center;
  padding: 10px;
  color: #667eea;
  font-weight: 500;
}

.view-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 15px;
}

.view-toggle button {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
}

.dark .view-toggle button {
  background: #16213e;
  border-color: #333;
  color: white;
}

.view-toggle button.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.font-item {
  padding: 12px;
  border-radius: 8px;
  background: #f8f9fa;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.dark .font-item {
  background: #16213e;
}

.font-item:hover {
  background: #e9ecef;
}

.dark .font-item:hover {
  background: #1a1a2e;
}

.font-item.active {
  background: #667eea;
  color: white;
}

.font-item.compare-active {
  border: 2px solid #667eea;
}

.font-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.font-info {
  font-size: 0.85rem;
  opacity: 0.8;
  margin-bottom: 4px;
}

.font-copyright {
  font-size: 0.8rem;
  margin-bottom: 4px;
}

.font-copyright.high {
  color: #dc2626;
}

.font-copyright.medium {
  color: #f59e0b;
}

.font-copyright.low {
  color: #10b981;
}

.font-size-info {
  display: flex;
  gap: 8px;
  font-size: 0.75rem;
  color: #666;
}

.dark .font-size-info {
  color: #999;
}

.optimized-size {
  color: #10b981;
  font-weight: 500;
}

.font-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.select-btn,
.download-btn,
.share-btn,
.delete-btn,
.reset-btn {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.dark .select-btn,
.dark .download-btn,
.dark .share-btn,
.dark .reset-btn {
  background: #16213e;
  border-color: #333;
  color: white;
}

.select-btn:hover,
.download-btn:hover,
.share-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.delete-btn {
  background: #ff4757;
  color: white;
  border-color: #ff4757;
}

.delete-btn:hover {
  background: #ff3838;
}

.reset-btn {
  background: #6c757d;
  color: white;
  border-color: #6c757d;
}

.reset-btn:hover {
  background: #5a6268;
}

.config-item {
  padding: 12px;
  border-radius: 8px;
  background: #f8f9fa;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.dark .config-item {
  background: #16213e;
}

.config-item:hover {
  background: #e9ecef;
}

.config-name {
  font-weight: 600;
  margin-bottom: 8px;
}

.config-actions {
  display: flex;
  gap: 8px;
}

.preview-area {
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  min-height: 600px;
}

.dark .preview-area {
  background: #1a1a2e;
  color: white;
}

.empty-state {
  text-align: center;
  padding: 100px 20px;
  color: #666;
}

.dark .empty-state {
  color: #aaa;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.empty-state h2 {
  margin-bottom: 10px;
  color: #333;
}

.dark .empty-state h2 {
  color: white;
}

.empty-state .hint {
  color: #667eea;
  font-weight: 500;
  margin-top: 8px;
}

.preview-header {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.dark .preview-header {
  border-bottom-color: #333;
}

.preview-header h2 {
  color: #333;
  margin-bottom: 10px;
}

.dark .preview-header h2 {
  color: white;
}

.font-meta {
  display: flex;
  gap: 20px;
  color: #666;
  font-size: 0.9rem;
}

.dark .font-meta {
  color: #999;
}

.color-controls {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.color-controls .control-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-controls label {
  font-size: 0.9rem;
  color: #666;
}

.dark .color-controls label {
  color: #aaa;
}

.color-controls input[type="color"] {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.preview-content {
  background: #f5f7fa;
  border-radius: 12px;
  padding: 40px;
  min-height: 200px;
  margin-bottom: 30px;
  overflow-x: auto;
}

.preview-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.control-panel {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.dark .control-panel {
  background: #16213e;
}

.control-group {
  margin-bottom: 15px;
}

.control-group label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 500;
}

.dark .control-group label {
  color: #ccc;
}

.control-group textarea,
.control-group select,
.control-group input[type="text"] {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.dark .control-group textarea,
.dark .control-group select,
.dark .control-group input[type="text"] {
  background: #1a1a2e;
  border-color: #333;
  color: white;
}

.control-group textarea:focus,
.control-group select:focus,
.control-group input[type="text"]:focus {
  outline: none;
  border-color: #667eea;
}

.control-group input[type="range"] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
  -webkit-appearance: none;
}

.dark .control-group input[type="range"] {
  background: #333;
}

.control-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #667eea;
  cursor: pointer;
}

.control-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.kerning-panel {
  background: #fff5f5;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.dark .kerning-panel {
  background: #2d1f1f;
}

.kerning-panel h3 {
  color: #ff4757;
  margin-bottom: 15px;
}

.char-selectors {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.char-selectors select {
  flex: 1;
  padding: 10px;
  border: 1px solid #ffcdd2;
  border-radius: 8px;
  background: white;
}

.dark .char-selectors select {
  background: #1a1a2e;
  border-color: #333;
  color: white;
}

.arrow {
  color: #ff4757;
  font-size: 1.2rem;
}

.kerning-control {
  display: flex;
  align-items: center;
  gap: 15px;
}

.kerning-preview {
  text-align: center;
  padding: 30px;
  background: white;
  border-radius: 8px;
  margin: 15px 0;
}

.dark .kerning-preview {
  background: #1a1a2e;
}

.kerning-preview span {
  font-size: 4rem;
}

.custom-kernings-list h4 {
  color: #666;
  margin-bottom: 10px;
  font-size: 0.95rem;
}

.dark .custom-kernings-list h4 {
  color: #ccc;
}

.kernings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.kernings-actions {
  display: flex;
  gap: 8px;
}

.import-btn,
.clear-btn {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.dark .import-btn,
.dark .clear-btn {
  background: #1a1a2e;
  border-color: #333;
  color: white;
}

.import-btn:hover {
  background: #e3f2fd;
  border-color: #2196f3;
}

.clear-btn:hover {
  background: #ffebee;
  border-color: #f44336;
  color: #f44336;
}

.kerning-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  margin-bottom: 8px;
}

.dark .kerning-item {
  background: #1a1a2e;
}

.kerning-pair {
  font-weight: 600;
  font-size: 1.2rem;
  min-width: 40px;
}

.kerning-input-inline {
  width: 70px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.85rem;
}

.dark .kerning-input-inline {
  background: #16213e;
  border-color: #333;
  color: white;
}

.kerning-unit {
  color: #666;
  font-size: 0.85rem;
}

.dark .kerning-unit {
  color: #999;
}

.remove-btn {
  padding: 2px 8px;
  font-size: 1rem;
  border: none;
  background: #ff4757;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.empty-kernings {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 0.9rem;
}

.subset-panel {
  background: #f0fdf4;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.dark .subset-panel {
  background: #1a2e1a;
}

.subset-panel h4 {
  color: #16a34a;
  margin-bottom: 15px;
  font-size: 1rem;
}

.preset-chars {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.preset-chars button {
  padding: 6px 12px;
  border: 1px solid #86efac;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.dark .preset-chars button {
  background: #1a1a2e;
  border-color: #16a34a;
  color: white;
}

.preset-chars button:hover {
  background: #16a34a;
  color: white;
  border-color: #16a34a;
}

.subset-controls textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #86efac;
  border-radius: 8px;
  font-size: 0.9rem;
  resize: vertical;
  min-height: 60px;
  margin-bottom: 10px;
}

.dark .subset-controls textarea {
  background: #1a1a2e;
  border-color: #16a34a;
  color: white;
}

.subset-info {
  color: #16a34a;
  font-size: 0.85rem;
  margin-bottom: 12px;
}

.subset-actions {
  display: flex;
  gap: 10px;
}

.subset-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: #16a34a;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.subset-btn:hover:not(:disabled) {
  background: #15803d;
}

.subset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.subset-loading {
  text-align: center;
  padding: 15px;
  color: #16a34a;
  font-size: 0.9rem;
}

.subset-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: white;
  border-radius: 8px;
  margin-top: 12px;
}

.dark .subset-result {
  background: #1a1a2e;
}

.download-subset {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: #16a34a;
  color: white;
  cursor: pointer;
  font-size: 0.85rem;
}

.export-panel {
  background: #fef3c7;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.dark .export-panel {
  background: #2e2a1a;
}

.export-panel h4 {
  color: #d97706;
  margin-bottom: 15px;
  font-size: 1rem;
}

.export-controls {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
}

.export-format,
.export-size {
  display: flex;
  align-items: center;
  gap: 8px;
}

.export-format label,
.export-size label {
  color: #92400e;
  font-size: 0.9rem;
}

.dark .export-format label,
.dark .export-size label {
  color: #fbbf24;
}

.export-format select,
.export-size select {
  padding: 8px 12px;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  background: white;
  color: #92400e;
  font-size: 0.9rem;
}

.dark .export-format select,
.dark .export-size select {
  background: #1a1a2e;
  border-color: #78350f;
  color: #fbbf24;
}

.export-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  background: #d97706;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.2s;
}

.export-btn:hover {
  background: #b45309;
}

.dark .export-btn {
  background: #f59e0b;
  color: #1a1a2e;
}

.dark .export-btn:hover {
  background: #d97706;
}

.color-controls {
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
  padding: 15px;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 15px;
}

.dark .color-controls {
  background: #1a1a2e;
}

.color-controls .control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-controls label {
  font-size: 0.9rem;
  color: #64748b;
  white-space: nowrap;
}

.dark .color-controls label {
  color: #94a3b8;
}

.color-controls input[type="color"] {
  width: 40px;
  height: 32px;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
}

.dark .color-controls input[type="color"] {
  border-color: #334155;
}

.copyright-warning {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  margin-bottom: 15px;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dark .copyright-warning {
  background: #2e2a1a;
  border-color: #78350f;
}

.copyright-warning .warning-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.copyright-warning .warning-text {
  flex: 1;
}

.copyright-warning .warning-text strong {
  display: block;
  color: #d97706;
  margin-bottom: 5px;
  font-size: 0.95rem;
}

.dark .copyright-warning .warning-text strong {
  color: #fbbf24;
}

.copyright-warning .warning-text pre {
  margin: 0;
  font-family: inherit;
  font-size: 0.85rem;
  color: #92400e;
  white-space: pre-wrap;
  line-height: 1.5;
}

.dark .copyright-warning .warning-text pre {
  color: #fcd34d;
}

.copyright-warning .close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #92400e;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.copyright-warning .close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.dark .copyright-warning .close-btn {
  color: #fcd34d;
}

.dark .copyright-warning .close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.user-center-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.user-center-modal .modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  overflow-y: auto;
  animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dark .user-center-modal .modal-content {
  background: #0f172a;
}

.user-center-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 25px;
  border-bottom: 1px solid #e2e8f0;
}

.dark .user-center-modal .modal-header {
  border-bottom-color: #334155;
}

.user-center-modal .modal-header h3 {
  margin: 0;
  font-size: 1.3rem;
  color: #1e293b;
}

.dark .user-center-modal .modal-header h3 {
  color: #f1f5f9;
}

.user-center-modal .modal-header .close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s;
}

.user-center-modal .modal-header .close-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.dark .user-center-modal .modal-header .close-btn:hover {
  background: #1e293b;
  color: #f1f5f9;
}

.user-center-modal .modal-body {
  padding: 25px;
}

.user-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.user-stats .stat-item {
  background: #f8fafc;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  transition: transform 0.2s;
}

.user-stats .stat-item:hover {
  transform: translateY(-2px);
}

.dark .user-stats .stat-item {
  background: #1e293b;
}

.user-stats .stat-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 8px;
}

.user-stats .stat-value {
  display: block;
  font-size: 1.8rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.dark .user-stats .stat-value {
  color: #f1f5f9;
}

.user-stats .stat-label {
  font-size: 0.85rem;
  color: #64748b;
}

.dark .user-stats .stat-label {
  color: #94a3b8;
}

.user-tabs {
  display: flex;
  gap: 5px;
  margin-bottom: 20px;
  background: #f1f5f9;
  padding: 5px;
  border-radius: 10px;
}

.dark .user-tabs {
  background: #1e293b;
}

.user-tabs .tab-btn {
  flex: 1;
  padding: 10px 15px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.user-tabs .tab-btn:hover {
  color: #1e293b;
}

.user-tabs .tab-btn.active {
  background: white;
  color: #1e293b;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.dark .user-tabs .tab-btn:hover {
  color: #f1f5f9;
}

.dark .user-tabs .tab-btn.active {
  background: #0f172a;
  color: #f1f5f9;
}

.user-content-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-content-list .content-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8fafc;
  border-radius: 10px;
  transition: all 0.2s;
}

.user-content-list .content-item:hover {
  background: #f1f5f9;
}

.dark .user-content-list .content-item {
  background: #1e293b;
}

.dark .user-content-list .content-item:hover {
  background: #334155;
}

.user-content-list .content-info {
  flex: 1;
}

.user-content-list .content-info .content-name {
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.dark .user-content-list .content-info .content-name {
  color: #f1f5f9;
}

.user-content-list .content-info .content-meta {
  font-size: 0.8rem;
  color: #64748b;
}

.dark .user-content-list .content-info .content-meta {
  color: #94a3b8;
}

.user-content-list .content-actions {
  display: flex;
  gap: 8px;
}

.user-content-list .content-actions button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.user-content-list .content-actions .load-btn {
  background: #dbeafe;
  color: #1d4ed8;
}

.user-content-list .content-actions .load-btn:hover {
  background: #bfdbfe;
}

.user-content-list .content-actions .share-btn {
  background: #dcfce7;
  color: #15803d;
}

.user-content-list .content-actions .share-btn:hover {
  background: #bbf7d0;
}

.user-content-list .content-actions .delete-btn {
  background: #fee2e2;
  color: #dc2626;
}

.user-content-list .content-actions .delete-btn:hover {
  background: #fecaca;
}

.dark .user-content-list .content-actions .load-btn {
  background: #1e3a5f;
  color: #93c5fd;
}

.dark .user-content-list .content-actions .load-btn:hover {
  background: #1e40af;
}

.dark .user-content-list .content-actions .share-btn {
  background: #14532d;
  color: #86efac;
}

.dark .user-content-list .content-actions .share-btn:hover {
  background: #166534;
}

.dark .user-content-list .content-actions .delete-btn {
  background: #450a0a;
  color: #fca5a5;
}

.dark .user-content-list .content-actions .delete-btn:hover {
  background: #7f1d1d;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
}

.empty-state .empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 0.95rem;
}

.dark .empty-state {
  color: #94a3b8;
}

.share-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.share-modal .share-content {
  background: white;
  border-radius: 12px;
  padding: 25px;
  width: 90%;
  max-width: 450px;
  animation: scaleIn 0.3s ease;
}

.dark .share-modal .share-content {
  background: #0f172a;
}

.share-modal h4 {
  margin: 0 0 15px 0;
  color: #1e293b;
  font-size: 1.1rem;
}

.dark .share-modal h4 {
  color: #f1f5f9;
}

.share-modal .share-link {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.share-modal .share-link input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.9rem;
  background: #f8fafc;
}

.dark .share-modal .share-link input {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

.share-modal .share-link button {
  padding: 10px 15px;
  border: none;
  border-radius: 6px;
  background: #1d4ed8;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.share-modal .share-link button:hover {
  background: #1e40af;
}

.share-modal .share-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.share-modal .share-actions button {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #64748b;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.share-modal .share-actions button:hover {
  border-color: #1d4ed8;
  color: #1d4ed8;
}

.dark .share-modal .share-actions button {
  background: transparent;
  border-color: #334155;
  color: #94a3b8;
}

.dark .share-modal .share-actions button:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.theme-toggle {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  font-size: 1.3rem;
  z-index: 100;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-toggle:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.dark .theme-toggle {
  background: #1e293b;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.user-center-btn {
  position: fixed;
  top: 20px;
  right: 74px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  font-size: 1.3rem;
  z-index: 100;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-center-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.dark .user-center-btn {
  background: #1e293b;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
</style>