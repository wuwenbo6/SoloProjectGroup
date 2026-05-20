<template>
  <div class="test-case-panel">
    <div class="panel-header">
      <h4>🧪 Test Case Generator</h4>
      <div class="stats">
        <span class="stat-badge">{{ stats.totalStates }} States</span>
        <span class="stat-badge">{{ stats.totalTransitions }} Transitions</span>
      </div>
    </div>

    <div class="button-group">
      <button @click="generateTests" class="generate-btn">
        Generate Test Cases
      </button>
      <button @click="copyToClipboard" class="copy-btn" :disabled="!testScripts">
        Copy to Clipboard
      </button>
    </div>

    <div v-if="testSuites" class="test-results">
      <div class="coverage-section">
        <h5>📊 Coverage</h5>
        <div class="coverage-bar">
          <div
            class="coverage-fill"
            :style="{ width: testSuites.suites.statistics.coveragePercent + '%' }"
          ></div>
          <span class="coverage-text">{{ testSuites.suites.statistics.coveragePercent }}%</span>
        </div>
      </div>

      <div class="test-suites-list">
        <h5>📋 Test Suites</h5>
        <div
          v-for="(script, index) in testSuites.scripts"
          :key="index"
          class="test-suite-item"
          @click="selectTestCase(index)"
          :class="{ active: selectedIndex === index }"
        >
          <div class="test-suite-name">
            {{ getTestCaseName(index) }}
          </div>
          <div class="test-suite-meta">
            {{ getTestCaseSteps(index) }} steps
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedScript" class="selected-script">
      <h5>📝 Test Script</h5>
      <pre class="script-content">{{ selectedScript }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { generateTestCases } from '../utils/testCaseGenerator'

const props = defineProps({
  dslContent: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['generate', 'select'])

const testSuites = ref(null)
const selectedIndex = ref(null)

const stats = computed(() => {
  if (testSuites.value) {
    return testSuites.value.suites.statistics
  }
  return { totalStates: 0, totalTransitions: 0, coveragePercent: 0 }
})

const selectedScript = computed(() => {
  if (selectedIndex.value !== null && testSuites.value) {
    return testSuites.value.scripts[selectedIndex.value]
  }
  return null
})

const generateTests = () => {
  if (!props.dslContent.trim()) {
    alert('Please enter some DSL content first!')
    return
  }

  try {
    testSuites.value = generateTestCases(props.dslContent)
    selectedIndex.value = 0
    emit('generate', testSuites.value)
  } catch (error) {
    console.error('Failed to generate test cases:', error)
    alert('Failed to generate test cases. Check console for details.')
  }
}

const getTestCaseName = (index) => {
  const names = ['Transition_Coverage', 'State_Coverage', 'Round_Trip', 'Path_1', 'Path_2', 'Path_3', 'Path_4', 'Path_5']
  return names[index] || `Test_Suite_${index + 1}`
}

const getTestCaseSteps = (index) => {
  const script = testSuites.value?.scripts[index]
  if (!script) return 0
  const match = script.match(/# Steps: (\d+)/)
  return match ? parseInt(match[1]) : 0
}

const selectTestCase = (index) => {
  selectedIndex.value = index
  emit('select', testSuites.value.scripts[index])
}

const copyToClipboard = async () => {
  if (!testSuites.value) return

  const content = selectedScript.value || testSuites.value.combinedScript
  try {
    await navigator.clipboard.writeText(content)
    alert('Test scripts copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}
</script>

<style scoped>
.test-case-panel {
  background: #1e1e1e;
  border-left: 1px solid #333;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h4 {
  margin: 0;
  color: #ccc;
  font-size: 14px;
}

.stats {
  display: flex;
  gap: 8px;
}

.stat-badge {
  background: #2d2d30;
  color: #888;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.button-group {
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #333;
}

.generate-btn,
.copy-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.generate-btn {
  background: #4caf50;
  color: white;
}

.generate-btn:hover {
  background: #43a047;
}

.copy-btn {
  background: #2196f3;
  color: white;
}

.copy-btn:hover:not(:disabled) {
  background: #1976d2;
}

.copy-btn:disabled {
  background: #555;
  cursor: not-allowed;
  opacity: 0.6;
}

.test-results {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.coverage-section {
  padding: 16px;
  border-bottom: 1px solid #333;
}

.coverage-section h5,
.test-suites-list h5 {
  margin: 0 0 12px 0;
  color: #ccc;
  font-size: 13px;
}

.coverage-bar {
  height: 24px;
  background: #2d2d30;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.coverage-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #8bc34a);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.coverage-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: bold;
  font-size: 12px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.test-suites-list {
  padding: 16px;
  flex: 1;
  overflow-y: auto;
}

.test-suite-item {
  background: #2d2d30;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.test-suite-item:hover {
  border-color: #555;
  background: #333;
}

.test-suite-item.active {
  border-color: #2196f3;
  background: #1e3a5f;
}

.test-suite-name {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
}

.test-suite-meta {
  color: #888;
  font-size: 11px;
}

.selected-script {
  border-top: 1px solid #333;
  padding: 16px;
  max-height: 40%;
  overflow-y: auto;
}

.selected-script h5 {
  margin: 0 0 12px 0;
  color: #ccc;
  font-size: 13px;
}

.script-content {
  background: #161616;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 12px;
  margin: 0;
  color: #d4d4d4;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
