<template>
  <div class="app-container">
    <div class="toolbar">
      <button @click="loadDSL">Load DSL</button>
      <button @click="sendEvent('TimerTick')">Timer Tick</button>
      <input v-model="eventName" class="event-input" placeholder="Event name" @keyup.enter="sendCustomEvent" />
      <button @click="sendCustomEvent">Send Event</button>
      <button @click="pauseExecution" :disabled="!connected || executionState?.isPaused">Pause</button>
      <button @click="resumeExecution" :disabled="!connected || !executionState?.isPaused">Resume</button>
      <button @click="stepExecution" :disabled="!connected">Step</button>
      <button @click="resetExecution" :disabled="!connected">Reset</button>
      <button @click="showTestPanel = !showTestPanel" class="test-panel-toggle" :class="{ active: showTestPanel }">
        🧪 Test Cases
      </button>
      <span class="status-indicator" :class="connected ? 'status-running' : 'status-paused'">
        {{ connected ? 'Connected' : 'Disconnected' }}
      </span>
    </div>

    <div class="main-content">
      <div class="editor-panel">
        <div class="panel-title">FSM DSL Editor</div>
        <div class="editor-wrapper" ref="editorRef"></div>
      </div>

      <div class="visualizer-panel">
        <div class="panel-title">State Machine Visualization</div>
        <div class="visualizer-wrapper">
          <StateMachineVisualizer
            :states="parsedStates"
            :transitions="parsedTransitions"
            :currentState="executionState?.currentState"
            :breakpoints="executionState?.breakpoints || []"
            @toggle-breakpoint="toggleBreakpoint"
          />
        </div>
      </div>

      <TestCasePanel
        v-if="showTestPanel"
        class="test-panel"
        :dslContent="currentEditorContent"
        @generate="onTestCasesGenerated"
        @select="onTestCaseSelected"
      />
    </div>

    <div class="debug-panel">
      <div class="panel-title">Debug Panel</div>
      <div class="debug-content">
        <div class="debug-section">
          <h4>Current State</h4>
          <div class="current-state">{{ executionState?.currentState || '-' }}</div>
          <div style="color: #888; font-size: 12px; margin-top: 4px;">
            Previous: {{ executionState?.previousState || '-' }}
          </div>
          <div style="color: #888; font-size: 12px;">
            Last Event: {{ executionState?.lastEvent || '-' }}
          </div>
          <div v-if="executionState?.error" class="error-message">
            ⚠️ {{ executionState.error }}
          </div>
          <div v-if="executionState?.cycleDetected && executionState.cycleDetected.length > 0" class="cycle-warning">
            🔄 Cycle detected: {{ executionState.cycleDetected.join(' → ') }}
          </div>
        </div>

        <div class="debug-section">
          <h4>Execution Stack</h4>
          <ul class="stack-list">
            <li v-for="(state, index) in executionState?.stack || []" :key="index">
              {{ index + 1 }}. {{ state }}
            </li>
          </ul>
        </div>

        <div class="debug-section">
          <h4>Breakpoints</h4>
          <ul class="breakpoint-list">
            <li v-for="state in parsedStates" :key="state.name">
              <input
                type="checkbox"
                :checked="executionState?.breakpoints?.includes(state.name)"
                @change="toggleBreakpoint(state.name, $event.target.checked)"
              />
              <span :style="{ color: getStateColor(state.name) }">{{ state.name }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import * as monaco from 'monaco-editor'
import StateMachineVisualizer from './components/StateMachineVisualizer.vue'
import TestCasePanel from './components/TestCasePanel.vue'

const editorRef = ref(null)
const editor = ref(null)
const ws = ref(null)
const connected = ref(false)
const executionState = ref(null)
const eventName = ref('')
const showTestPanel = ref(false)

const currentEditorContent = computed(() => {
  return editor.value?.getValue() || ''
})

const sampleDSL = `machine TrafficLight {
    initial: Red
    
    state Red {
        on Enter: turnOnRedLight
        on Exit: turnOffRedLight
        on TimerTick -> Yellow
    }
    
    state Yellow {
        on Enter: turnOnYellowLight
        on Exit: turnOffYellowLight
        on TimerTick -> Green
    }
    
    state Green {
        on Enter: turnOnGreenLight
        on Exit: turnOffGreenLight
        on TimerTick -> Red
        on EmergencyStop -> Red
    }
}

action turnOnRedLight {
    print("红灯亮起")
}

action turnOffRedLight {
    print("红灯熄灭")
}

action turnOnYellowLight {
    print("黄灯亮起")
}

action turnOffYellowLight {
    print("黄灯熄灭")
}

action turnOnGreenLight {
    print("绿灯亮起")
}

action turnOffGreenLight {
    print("绿灯熄灭")
}`

const parsedStates = ref([])
const parsedTransitions = ref([])

const parseDSLForVisualization = (content) => {
  const states = []
  const transitions = []

  const stateRegex = /state\s+(\w+)\s*\{([^}]*)\}/g
  let match
  while ((match = stateRegex.exec(content)) !== null) {
    const stateName = match[1]
    const stateBody = match[2]

    states.push({ name: stateName })

    const transitionRegex = /on\s+(\w+)\s*->\s*(\w+)/g
    let transMatch
    while ((transMatch = transitionRegex.exec(stateBody)) !== null) {
      transitions.push({
        from: stateName,
        to: transMatch[2],
        event: transMatch[1]
      })
    }
  }

  parsedStates.value = states
  parsedTransitions.value = transitions
}

const getStateColor = (stateName) => {
  if (executionState.value?.currentState === stateName) {
    return '#4ec9b0'
  }
  if (executionState.value?.breakpoints?.includes(stateName)) {
    return '#f48771'
  }
  return '#9cdcfe'
}

onMounted(() => {
  monaco.languages.register({ id: 'fsm' })

  monaco.languages.setMonarchTokensProvider('fsm', {
    keywords: ['machine', 'state', 'action', 'initial', 'on', 'Enter', 'Exit', 'print'],
    tokenizer: {
      root: [
        [/[a-z_$][\w$]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
        [/"[^"]*"/, 'string'],
        [/->/, 'operator'],
        [/[:{}(),]/, 'delimiter'],
        [/#.*/, 'comment']
      ]
    }
  })

  monaco.editor.defineTheme('fsm-theme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
      { token: 'identifier', foreground: '9cdcfe' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'operator', foreground: 'd4d4d4' },
      { token: 'delimiter', foreground: 'd4d4d4' },
      { token: 'comment', foreground: '6a9955' }
    ],
    colors: {}
  })

  editor.value = monaco.editor.create(editorRef.value, {
    value: sampleDSL,
    language: 'fsm',
    theme: 'fsm-theme',
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    automaticLayout: true
  })

  parseDSLForVisualization(sampleDSL)

  editor.value.onDidChangeModelContent(() => {
    const content = editor.value.getValue()
    parseDSLForVisualization(content)
  })

  connectWebSocket()
})

onUnmounted(() => {
  if (editor.value) {
    editor.value.dispose()
  }
  if (ws.value) {
    ws.value.close()
  }
})

const connectWebSocket = () => {
  ws.value = new WebSocket('ws://localhost:8080/ws')

  ws.value.onopen = () => {
    connected.value = true
    console.log('WebSocket connected')
  }

  ws.value.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.type === 'state') {
      executionState.value = message.payload
    }
  }

  ws.value.onclose = () => {
    connected.value = false
    console.log('WebSocket disconnected')
    setTimeout(connectWebSocket, 3000)
  }

  ws.value.onerror = (error) => {
    console.error('WebSocket error:', error)
  }
}

const sendWSMessage = (type, payload) => {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    ws.value.send(JSON.stringify({ type, payload }))
  }
}

const loadDSL = async () => {
  const content = editor.value.getValue()
  try {
    await fetch('http://localhost:8080/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
    console.log('DSL loaded successfully')
  } catch (error) {
    console.error('Failed to load DSL:', error)
  }
}

const sendEvent = (event) => {
  sendWSMessage('event', event)
}

const sendCustomEvent = () => {
  if (eventName.value.trim()) {
    sendEvent(eventName.value.trim())
    eventName.value = ''
  }
}

const pauseExecution = () => {
  sendWSMessage('pause', null)
}

const resumeExecution = () => {
  sendWSMessage('resume', null)
}

const stepExecution = () => {
  sendWSMessage('step', null)
}

const resetExecution = () => {
  sendWSMessage('reset', null)
}

const toggleBreakpoint = (state, enabled) => {
  sendWSMessage('breakpoint', { state, enabled })
}

const onTestCasesGenerated = (testSuites) => {
  console.log('Test cases generated:', testSuites)
}

const onTestCaseSelected = (script) => {
  console.log('Selected test script:', script)
}
</script>
