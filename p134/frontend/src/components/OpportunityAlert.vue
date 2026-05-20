<template>
  <div v-if="opportunities.length > 0" class="space-y-4">
    <div 
      v-for="(opp, index) in opportunities" 
      :key="index"
      class="opportunity-card bg-success/20 border border-success rounded-xl p-6"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <span class="text-4xl">💰</span>
          <div>
            <h3 class="text-xl font-bold text-success">发现套利机会!</h3>
            <p class="text-gray-300">{{ opp.exchange?.toUpperCase() }} - {{ opp.path }}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-3xl font-bold text-success">+{{ opp.profitPercentage?.toFixed(3) }}%</p>
          <p class="text-sm text-gray-400">预期利润率</p>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-3 gap-4">
        <div 
          v-for="(price, symbol) in opp.prices" 
          :key="symbol"
          class="bg-dark/50 rounded-lg p-3"
        >
          <p class="text-sm text-gray-400">{{ symbol }}</p>
          <p class="font-semibold">买: {{ price.bid?.toFixed(2) }}</p>
          <p class="font-semibold">卖: {{ price.ask?.toFixed(2) }}</p>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="bg-dark-light rounded-xl p-6 text-center">
    <span class="text-4xl mb-2 block">🔍</span>
    <p class="text-gray-400">正在监控市场，等待套利机会...</p>
  </div>
</template>

<script setup>
defineProps({
  opportunities: {
    type: Array,
    default: () => []
  }
})
</script>
