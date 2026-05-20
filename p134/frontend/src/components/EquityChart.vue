<template>
  <div class="h-full">
    <Line :data="chartData" :options="options" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
})

const chartData = computed(() => {
  const labels = props.data.slice(0, 100).map(d => 
    new Date(d.timestamp || Date.now()).toLocaleTimeString()
  )
  const values = props.data.slice(0, 100).map(d => d.equity || d.value || 0)
  
  return {
    labels,
    datasets: [
      {
        label: '净值',
        data: values,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      }
    ]
  }
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    }
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8', maxTicksLimit: 8 },
      grid: { color: '#334155' }
    },
    y: {
      ticks: { color: '#94a3b8' },
      grid: { color: '#334155' },
    }
  }
}
</script>
