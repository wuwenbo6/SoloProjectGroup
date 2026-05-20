<template>
  <div class="visualizer-container" ref="containerRef">
    <svg
      ref="svgRef"
      class="state-machine-svg"
      @mousedown="onSvgMouseDown"
      @mousemove="onSvgMouseMove"
      @mouseup="onSvgMouseUp"
      @mouseleave="onSvgMouseUp"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
        </marker>
      </defs>

      <g :transform="`translate(${svgCenter.x + panOffset.x}, ${svgCenter.y + panOffset.y}) scale(${zoom})`">
        <g v-for="transition in transitions" :key="`${transition.from}-${transition.to}`">
          <path
            :d="getTransitionPath(transition)"
            stroke="#888"
            stroke-width="2"
            fill="none"
            marker-end="url(#arrowhead)"
            class="transition-path"
          />
          <text
            :x="getLabelPosition(transition).x"
            :y="getLabelPosition(transition).y"
            fill="#ce9178"
            font-size="12"
            text-anchor="middle"
            class="transition-label"
          >
            {{ transition.event }}
          </text>
        </g>

        <g
          v-for="state in states"
          :key="state.name"
          :transform="`translate(${getStatePosition(state.name).x}, ${getStatePosition(state.name).y})`"
          class="state-node"
          @mousedown.stop="onStateMouseDown($event, state.name)"
          @click.stop="$emit('toggle-breakpoint', state.name, !breakpoints.includes(state.name))"
        >
        <circle
          r="45"
          :fill="getStateFill(state.name)"
          :stroke="getStateStroke(state.name)"
          stroke-width="3"
          class="state-circle"
        />
        <text
          y="5"
          fill="#fff"
          font-size="14"
          font-weight="bold"
          text-anchor="middle"
          class="state-label"
        >
          {{ state.name }}
        </text>
        <circle
          v-if="breakpoints.includes(state.name)"
          r="8"
          cx="35"
          cy="-35"
          fill="#f48771"
          stroke="#fff"
          stroke-width="2"
        />
        </g>
      </g>
    </svg>

    <div class="zoom-controls">
      <button @click="zoomIn" class="zoom-btn">+</button>
      <span class="zoom-level">{{ Math.round(zoom * 100) }}%</span>
      <button @click="zoomOut" class="zoom-btn">−</button>
      <button @click="resetZoom" class="zoom-btn reset-btn">⟲</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  states: {
    type: Array,
    default: () => []
  },
  transitions: {
    type: Array,
    default: () => []
  },
  currentState: {
    type: String,
    default: null
  },
  breakpoints: {
    type: Array,
    default: () => []
  }
})

defineEmits(['toggle-breakpoint'])

const containerRef = ref(null)
const svgRef = ref(null)
const zoom = ref(1)
const panOffset = reactive({ x: 0, y: 0 })
const isDragging = ref(false)
const draggedState = ref(null)
const dragStartPos = reactive({ x: 0, y: 0 })
const dragStartStatePos = reactive({ x: 0, y: 0 })
const isPanning = ref(false)
const panStartPos = reactive({ x: 0, y: 0 })
const svgCenter = reactive({ x: 350, y: 250 })

const customPositions = reactive({})

let pendingUpdate = null
let rafId = null

const updateSvgCenter = () => {
  const svg = svgRef.value
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  svgCenter.x = rect.width / 2
  svgCenter.y = rect.height / 2
}

onMounted(() => {
  updateSvgCenter()
  window.addEventListener('resize', updateSvgCenter)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateSvgCenter)
  if (pendingUpdate) {
    cancelAnimationFrame(pendingUpdate)
  }
})

const initializePositions = () => {
  const total = props.states.length
  const radius = 150

  props.states.forEach((state, index) => {
    if (!customPositions[state.name]) {
      const angle = (index / total) * 2 * Math.PI - Math.PI / 2
      customPositions[state.name] = {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle)
      }
    }
  })
}

watch(() => props.states.length, () => {
  nextTick(() => initializePositions())
}, { immediate: true })

const getStatePosition = (stateName) => {
  return customPositions[stateName] || { x: 0, y: 0 }
}

const getStateFill = (stateName) => {
  if (props.currentState === stateName) {
    return '#1e6f5c'
  }
  if (props.breakpoints.includes(stateName)) {
    return '#7a4a4a'
  }
  return '#2d2d30'
}

const getStateStroke = (stateName) => {
  if (props.currentState === stateName) {
    return '#4ec9b0'
  }
  if (props.breakpoints.includes(stateName)) {
    return '#f48771'
  }
  return '#0e639c'
}

const getTransitionPath = (transition) => {
  const from = getStatePosition(transition.from)
  const to = getStatePosition(transition.to)

  if (!from || !to) return ''

  if (transition.from === transition.to) {
    const cx = from.x + 55
    const cy = from.y
    return `M ${from.x + 45} ${from.y} 
            C ${cx} ${cy - 40}, ${cx} ${cy + 40}, ${from.x + 45} ${from.y}`
  }

  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const normX = dx / dist
  const normY = dy / dist

  const startX = from.x + normX * 45
  const startY = from.y + normY * 45
  const endX = to.x - normX * 50
  const endY = to.y - normY * 50

  const midX = (startX + endX) / 2
  const midY = (startY + endY) / 2
  const perpX = -normY
  const perpY = normX
  const curvature = 30

  return `M ${startX} ${startY} 
          Q ${midX + perpX * curvature} ${midY + perpY * curvature}, 
            ${endX} ${endY}`
}

const getLabelPosition = (transition) => {
  const from = getStatePosition(transition.from)
  const to = getStatePosition(transition.to)

  if (!from || !to) return { x: 0, y: 0 }

  if (transition.from === transition.to) {
    return {
      x: from.x + 75,
      y: from.y - 5
    }
  }

  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const normX = dx / dist
  const normY = dy / dist

  const startX = from.x + normX * 45
  const startY = from.y + normY * 45
  const endX = to.x - normX * 50
  const endY = to.y - normY * 50

  const midX = (startX + endX) / 2
  const midY = (startY + endY) / 2
  const perpX = -normY
  const perpY = normX
  const offset = 40

  return {
    x: midX + perpX * offset,
    y: midY + perpY * offset - 8
  }
}

const screenToSvg = (screenX, screenY) => {
  const svg = svgRef.value
  if (!svg) return { x: screenX, y: screenY }

  const rect = svg.getBoundingClientRect()

  return {
    x: (screenX - rect.left - svgCenter.x - panOffset.x) / zoom.value,
    y: (screenY - rect.top - svgCenter.y - panOffset.y) / zoom.value
  }
}

const onStateMouseDown = (event, stateName) => {
  if (event.button !== 0) return

  isDragging.value = true
  draggedState.value = stateName
  const svgPos = screenToSvg(event.clientX, event.clientY)
  dragStartPos.x = svgPos.x
  dragStartPos.y = svgPos.y

  const pos = getStatePosition(stateName)
  dragStartStatePos.x = pos.x
  dragStartStatePos.y = pos.y
}

const onSvgMouseDown = (event) => {
  if (event.button !== 0) return
  if (event.target.closest('.state-node')) return

  isPanning.value = true
  panStartPos.x = event.clientX
  panStartPos.y = event.clientY
}

const scheduleUpdate = (updateFn) => {
  if (pendingUpdate) {
    cancelAnimationFrame(pendingUpdate)
  }
  pendingUpdate = requestAnimationFrame(() => {
    updateFn()
    pendingUpdate = null
  })
}

const onSvgMouseMove = (event) => {
  if (isDragging.value && draggedState.value) {
    const svgPos = screenToSvg(event.clientX, event.clientY)
    const dx = svgPos.x - dragStartPos.x
    const dy = svgPos.y - dragStartPos.y

    scheduleUpdate(() => {
      customPositions[draggedState.value] = {
        x: dragStartStatePos.x + dx,
        y: dragStartStatePos.y + dy
      }
    })
  } else if (isPanning.value) {
    const dx = (event.clientX - panStartPos.x) / zoom.value
    const dy = (event.clientY - panStartPos.y) / zoom.value

    scheduleUpdate(() => {
      panOffset.x += dx
      panOffset.y += dy
    })

    panStartPos.x = event.clientX
    panStartPos.y = event.clientY
  }
}

const onSvgMouseUp = () => {
  isDragging.value = false
  draggedState.value = null
  isPanning.value = false
}

const zoomIn = () => {
  zoom.value = Math.min(zoom.value * 1.2, 3)
}

const zoomOut = () => {
  zoom.value = Math.max(zoom.value / 1.2, 0.3)
}

const resetZoom = () => {
  zoom.value = 1
  panOffset.x = 0
  panOffset.y = 0
}
</script>

<style scoped>
.visualizer-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1e1e1e;
  position: relative;
  overflow: hidden;
}

.state-machine-svg {
  width: 100%;
  height: 100%;
  cursor: grab;
}

.state-machine-svg:active {
  cursor: grabbing;
}

.state-node {
  cursor: move;
  user-select: none;
}

.state-circle {
  transition: fill 0.15s ease, stroke 0.15s ease;
}

.state-node:hover .state-circle {
  filter: brightness(1.2);
}

.transition-path,
.transition-label {
  transition: stroke 0.15s ease, fill 0.15s ease;
}

.zoom-controls {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: rgba(30, 30, 30, 0.9);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #333;
}

.zoom-btn {
  width: 32px;
  height: 32px;
  background: #252526;
  color: #fff;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.zoom-btn:hover {
  background: #2d2d30;
}

.zoom-btn:active {
  background: #1e1e1e;
}

.reset-btn {
  font-size: 14px;
}

.zoom-level {
  color: #ccc;
  font-size: 12px;
  font-weight: 500;
  min-width: 40px;
  text-align: center;
}
</style>
