<template>
  <div class="bg-dark-light rounded-xl p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold capitalize">{{ exchange }}</h3>
      <span class="w-2 h-2 rounded-full bg-success"></span>
    </div>
    <div class="space-y-3">
      <div 
        v-for="spread in spreads.slice(0, 5)" 
        :key="spread.symbol"
        class="flex items-center justify-between p-3 bg-dark/50 rounded-lg"
      >
        <span class="font-medium">{{ spread.symbol }}</span>
        <div class="text-right">
          <p class="text-sm">{{ spread.bid?.toFixed(2) }} / {{ spread.ask?.toFixed(2) }}</p>
          <p class="text-xs" :class="parseFloat(spread.spread) > 0.1 ? 'text-warning' : 'text-gray-400'">
            价差: {{ spread.spread }}%
          </p>
        </div>
      </div>
      <div v-if="spreads.length === 0" class="text-center text-gray-400 py-4">
        等待数据...
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  exchange: {
    type: String,
    required: true
  },
  prices: {
    type: Object,
    default: () => ({})
  },
  spreads: {
    type: Array,
    default: () => []
  }
})
</script>
