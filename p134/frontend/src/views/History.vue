<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold">套利机会历史</h2>
      <select 
        v-model="selectedExchange" 
        class="bg-dark-light border border-gray-700 rounded-lg px-4 py-2 text-white"
      >
        <option value="">全部交易所</option>
        <option value="binance">Binance</option>
        <option value="coinbase">Coinbase</option>
        <option value="kraken">Kraken</option>
      </select>
    </div>

    <div class="bg-dark-light rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-4">利润率趋势</h3>
      <ProfitChart :data="opportunities" />
    </div>

    <div class="bg-dark-light rounded-xl overflow-hidden">
      <table class="w-full">
        <thead class="bg-dark">
          <tr>
            <th class="px-6 py-4 text-left text-sm font-semibold text-gray-300">时间</th>
            <th class="px-6 py-4 text-left text-sm font-semibold text-gray-300">交易所</th>
            <th class="px-6 py-4 text-left text-sm font-semibold text-gray-300">交易对三角</th>
            <th class="px-6 py-4 text-right text-sm font-semibold text-gray-300">利润率</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="opp in filteredOpportunities" 
            :key="opp.id"
            class="border-t border-gray-700 hover:bg-dark/50 transition-colors"
          >
            <td class="px-6 py-4 text-sm text-gray-300">
              {{ new Date(opp.timestamp).toLocaleString() }}
            </td>
            <td class="px-6 py-4">
              <span class="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm capitalize">
                {{ opp.exchange }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm">
              {{ opp.triangle?.join(' → ') }}
            </td>
            <td class="px-6 py-4 text-right">
              <span class="text-lg font-bold text-success">
                +{{ opp.profitPercentage?.toFixed(3) }}%
              </span>
            </td>
          </tr>
          <tr v-if="filteredOpportunities.length === 0">
            <td colspan="4" class="px-6 py-8 text-center text-gray-400">
              暂无历史数据
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import ProfitChart from '../components/ProfitChart.vue'

const opportunities = ref([])
const selectedExchange = ref('')

const filteredOpportunities = computed(() => {
  if (!selectedExchange.value) return opportunities.value
  return opportunities.value.filter(opp => opp.exchange === selectedExchange.value)
})

onMounted(async () => {
  try {
    const response = await fetch('/api/opportunities?limit=100')
    opportunities.value = await response.json()
  } catch (e) {
    console.error('Failed to fetch opportunities:', e)
  }
})
</script>
