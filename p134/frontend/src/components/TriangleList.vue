<template>
  <div class="space-y-3">
    <div 
      v-for="(triangle, index) in triangles" 
      :key="index"
      class="p-4 bg-dark/50 rounded-lg border border-gray-700"
    >
      <div class="flex items-center space-x-2">
        <span class="text-primary">🔺</span>
        <span class="font-medium">{{ triangle[0] }}</span>
        <span class="text-gray-500">→</span>
        <span class="font-medium">{{ triangle[1] }}</span>
        <span class="text-gray-500">→</span>
        <span class="font-medium">{{ triangle[2] }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  triangles: {
    type: Array,
    default: () => []
  }
})
</script>
