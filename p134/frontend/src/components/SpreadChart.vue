<template>
  <div class="h-64">
    <Bar :data="chartData" :options="options" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
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

const chartData = computed(() => ({
  labels: ['BTCUSDT', 'ETHUSDT', 'ETHBTC', 'LTCBTC', 'XRPBTC'],
  datasets: [
    {
      label: 'Binance',
      data: [0.012, 0.015, 0.008, 0.021, 0.018],
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
    },
    {
      label: 'Coinbase',
      data: [0.018, 0.022, 0.012, 0.028, 0.025],
      backgroundColor: 'rgba(34, 197, 94, 0.8)',
    },
    {
      label: 'Kraken',
      data: [0.015, 0.018, 0.010, 0.025, 0.022],
      backgroundColor: 'rgba(245, 158, 11, 0.8)',
    }
  ]
}))

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
        text: '价差 (%)',
        color: '#e2e8f0'
      }
    }
  }
}
</script>
