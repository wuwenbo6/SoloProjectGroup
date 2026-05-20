<template>
  <div class="h-64">
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
  Legend
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
})

const chartData = computed(() => {
  const labels = props.data.slice(0, 20).map(opp => 
    new Date(opp.timestamp).toLocaleTimeString()
  ).reverse()
  
  const values = props.data.slice(0, 20).map(opp => opp.profitPercentage).reverse()
  
  return {
    labels,
    datasets: [
      {
        label: '利润率 (%)',
        data: values,
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        fill: true,
        tension: 0.4
      }
    ]
  }
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: '#e2e8f0'
      }
    }
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8' },
      grid: { color: '#334155' }
    },
    y: {
      ticks: { color: '#94a3b8' },
      grid: { color: '#334155' },
      title: {
        display: true,
        text: '利润率 (%)',
        color: '#e2e8f0'
      }
    }
  }
}
</script>
