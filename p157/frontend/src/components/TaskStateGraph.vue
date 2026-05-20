<template>
  <div class="task-state-graph">
    <el-card class="graph-card">
      <template #header>
        <div class="card-header">
          <span>任务状态图</span>
          <span class="cycle-info">Cycles: {{ cycles }} | Ticks: {{ tickCount }}</span>
        </div>
      </template>
      <svg ref="svgRef" :width="svgWidth" :height="svgHeight"></svg>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import { useSimulatorStore } from '@/stores/simulator'

const simulatorStore = useSimulatorStore()
const svgRef = ref(null)
const svgWidth = ref(800)
const svgHeight = ref(500)

const stateColors = {
  ready: '#4CAF50',
  running: '#2196F3',
  blocked: '#FF9800',
  suspended: '#9E9E9E',
  deleted: '#F44336'
}

const stateLabels = {
  ready: '就绪',
  running: '运行',
  blocked: '阻塞',
  suspended: '挂起',
  deleted: '删除'
}

const cycles = ref(0)
const tickCount = ref(0)

function drawGraph() {
  if (!svgRef.value) return
  
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()
  
  const tasks = simulatorStore.tasks
  
  const width = svgWidth.value
  const height = svgHeight.value
  const centerX = width / 2
  const centerY = height / 2
  
  const statePositions = {
    running: { x: centerX, y: centerY - 80 },
    ready: { x: centerX - 180, y: centerY + 80 },
    blocked: { x: centerX, y: centerY + 140 },
    suspended: { x: centerX + 180, y: centerY + 80 }
  }
  
  Object.entries(statePositions).forEach(([state, pos]) => {
    svg.append('circle')
      .attr('cx', pos.x)
      .attr('cy', pos.y)
      .attr('r', 35)
      .attr('fill', stateColors[state])
      .attr('fill-opacity', 0.2)
      .attr('stroke', stateColors[state])
      .attr('stroke-width', 2)
    
    svg.append('text')
      .attr('x', pos.x)
      .attr('y', pos.y + 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#333')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text(stateLabels[state])
  })
  
  const drawTransition = (from, to, label) => {
    const fromPos = statePositions[from]
    const toPos = statePositions[to]
    
    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    const startX = fromPos.x + (dx / dist) * 35
    const startY = fromPos.y + (dy / dist) * 35
    const endX = toPos.x - (dx / dist) * 40
    const endY = toPos.y - (dy / dist) * 40
    
    svg.append('line')
      .attr('x1', startX)
      .attr('y1', startY)
      .attr('x2', endX)
      .attr('y2', endY)
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#arrowhead)')
    
    if (label) {
      svg.append('text')
        .attr('x', (startX + endX) / 2)
        .attr('y', (startY + endY) / 2 - 5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .attr('font-size', '10px')
        .text(label)
    }
  }
  
  drawTransition('ready', 'running', '调度')
  drawTransition('running', 'ready', '抢占')
  drawTransition('running', 'blocked', '等待')
  drawTransition('blocked', 'ready', '事件')
  drawTransition('running', 'suspended', '挂起')
  drawTransition('suspended', 'ready', '恢复')
  
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('markerWidth', 10)
    .attr('markerHeight', 7)
    .attr('refX', 9)
    .attr('refY', 3.5)
    .attr('orient', 'auto')
    .append('polygon')
    .attr('points', '0 0, 10 3.5, 0 7')
    .attr('fill', '#666')
  
  tasks.forEach((task, i) => {
    const statePos = statePositions[task.state] || { x: 50, y: 50 }
    const offset = tasks.filter((t, idx) => t.state === task.state && idx < i).length
    const angle = (offset * 45 - 90) * (Math.PI / 180)
    const radius = 60 + Math.floor(offset / 8) * 30
    const idx = offset % 8
    
    const x = statePos.x + Math.cos(angle + idx * Math.PI / 4) * radius
    const y = statePos.y + Math.sin(angle + idx * Math.PI / 4) * radius
    
    const g = svg.append('g')
      .attr('class', 'task-node')
      .attr('transform', `translate(${x}, ${y})`)
    
    g.append('circle')
      .attr('r', 18)
      .attr('fill', stateColors[task.state])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
    
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#fff')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text(task.name.substring(0, 3))
    
    g.append('text')
      .attr('y', 32)
      .attr('text-anchor', 'middle')
      .attr('fill', '#666')
      .attr('font-size', '9px')
      .text(`P${task.priority}`)
    
    g.append('title')
      .text(`${task.name}\n优先级: ${task.priority}\n状态: ${stateLabels[task.state]}`)
  })
  
  const legendX = 20
  const legendY = height - 80
  Object.entries(stateLabels).forEach(([state, label], i) => {
    const y = legendY + i * 20
    svg.append('rect')
      .attr('x', legendX)
      .attr('y', y - 8)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', stateColors[state])
    
    svg.append('text')
      .attr('x', legendX + 20)
      .attr('y', y + 2)
      .attr('fill', '#333')
      .attr('font-size', '11px')
      .text(label)
  })
}

onMounted(() => {
  nextTick(() => {
    drawGraph()
  })
})

watch(
  () => [simulatorStore.tasks, simulatorStore.cycles, simulatorStore.tickCount],
  () => {
    cycles.value = simulatorStore.cycles
    tickCount.value = simulatorStore.tickCount
    drawGraph()
  },
  { deep: true }
)
</script>

<style scoped>
.task-state-graph {
  width: 100%;
}

.graph-card {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cycle-info {
  font-size: 12px;
  color: #666;
}
</style>
