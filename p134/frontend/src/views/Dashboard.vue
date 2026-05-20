<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-dark-light rounded-xl p-4">
        <p class="text-gray-400 text-sm">连接交易所</p>
        <p class="text-2xl font-bold text-primary">{{ connectedExchanges }}/3</p>
      </div>
      <div class="bg-dark-light rounded-xl p-4">
        <p class="text-gray-400 text-sm">监控交易对</p>
        <p class="text-2xl font-bold text-success">{{ totalPrices }}</p>
      </div>
      <div class="bg-dark-light rounded-xl p-4">
        <p class="text-gray-400 text-sm">套利计算次数</p>
        <p class="text-2xl font-bold text-warning">{{ metrics.calculationCount || 0 }}</p>
      </div>
      <div class="bg-dark-light rounded-xl p-4">
        <p class="text-gray-400 text-sm">平均计算耗时</p>
        <p class="text-2xl font-bold text-success">{{ metrics.lastCalculationTime || 0 }}ms</p>
      </div>
    </div>

    <OpportunityAlert :opportunities="currentOpportunities" />
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <ExchangeCard 
        v-for="exchange in ['binance', 'coinbase', 'kraken']" 
        :key="exchange"
        :exchange="exchange"
        :prices="prices[exchange] || {}"
        :spreads="spreads[exchange] || []"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-dark-light rounded-xl p-6">
        <h3 class="text-lg font-semibold mb-4">实时价差监控</h3>
        <SpreadChart :data="chartData" />
      </div>
      <div class="bg-dark-light rounded-xl p-6">
        <h3 class="text-lg font-semibold mb-4">可用套利路径 ({{ availablePaths.length }})</h3>
        <TriangleList :triangles="availablePaths" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { io } from 'socket.io-client'
import OpportunityAlert from '../components/OpportunityAlert.vue'
import ExchangeCard from '../components/ExchangeCard.vue'
import SpreadChart from '../components/SpreadChart.vue'
import TriangleList from '../components/TriangleList.vue'

const socket = io('http://localhost:3000')

const prices = ref({})
const spreads = ref({})
const currentOpportunities = ref([])
const metrics = ref({})
const chartData = ref([])

const connectedExchanges = computed(() => {
  let count = 0
  for (const exchange of ['binance', 'coinbase', 'kraken']) {
    if (prices.value[exchange] && Object.keys(prices.value[exchange]).length > 0) {
      count++
    }
  }
  return count
})

const totalPrices = computed(() => {
  let total = 0
  for (const exchangePrices of Object.values(prices.value)) {
    total += Object.keys(exchangePrices || {}).length
  }
  return total
})

const availablePaths = computed(() => {
  const paths = []
  const basePaths = [
    ['BTCUSDT', 'ETHBTC', 'ETHUSDT'],
    ['BTCUSDT', 'LTCBTC', 'LTCUSDT'],
    ['ETHUSDT', 'ADABTC', 'ADAUSDT'],
    ['BTCUSDT', 'SOLBTC', 'SOLUSDT'],
    ['BTCUSDT', 'DOTBTC', 'DOTUSDT'],
  ]
  return basePaths
})

onMounted(async () => {
  socket.on('priceUpdate', (data) => {
    prices.value[data.exchange] = {
      ...prices.value[data.exchange],
      [data.symbol]: data.price
    }
    spreads.value[data.exchange] = data.spreads
  })

  socket.on('arbitrageOpportunity', (opportunities) => {
    currentOpportunities.value = opportunities
  })

  socket.on('arbitrageAlert', (opportunity) => {
    showNotification(opportunity)
    currentOpportunities.value = [opportunity, ...currentOpportunities.value].slice(0, 5)
  })

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      metrics.value = data.arbitrage
    } catch (e) {}
  }
  
  fetchStatus()
  const statusInterval = setInterval(fetchStatus, 5000)
  
  return () => clearInterval(statusInterval)
})

onUnmounted(() => {
  socket.disconnect()
})

const showNotification = (opportunity) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🔔 发现套利机会!', {
      body: `${opportunity.exchange?.toUpperCase()} - ${opportunity.path}\n利润率: ${opportunity.profitPercentage?.toFixed(3)}%`,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💰</text></svg>'
    })
  }
}
</script>
