<template>
  <div class="min-h-screen bg-dark">
    <nav class="bg-dark-light border-b border-gray-700 px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h1 class="text-2xl font-bold text-primary">
            🔄 三角套利监控系统
          </h1>
        </div>
        <div class="flex items-center space-x-6">
          <router-link 
            to="/" 
            class="text-gray-300 hover:text-white transition-colors"
            :class="{ 'text-primary font-semibold': $route.name === 'Dashboard' }"
          >
            仪表盘
          </router-link>
          <router-link 
            to="/simulation" 
            class="text-gray-300 hover:text-white transition-colors"
            :class="{ 'text-primary font-semibold': $route.name === 'Simulation' }"
          >
            模拟交易
          </router-link>
          <router-link 
            to="/backtest" 
            class="text-gray-300 hover:text-white transition-colors"
            :class="{ 'text-primary font-semibold': $route.name === 'Backtest' }"
          >
            策略回测
          </router-link>
          <router-link 
            to="/predictions" 
            class="text-gray-300 hover:text-white transition-colors"
            :class="{ 'text-primary font-semibold': $route.name === 'Predictions' }"
          >
            价格预测
          </router-link>
          <router-link 
            to="/history" 
            class="text-gray-300 hover:text-white transition-colors"
            :class="{ 'text-primary font-semibold': $route.name === 'History' }"
          >
            历史记录
          </router-link>
          <router-link 
            to="/settings" 
            class="text-gray-300 hover:text-white transition-colors"
            :class="{ 'text-primary font-semibold': $route.name === 'Settings' }"
          >
            配置
          </router-link>
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-success animate-pulse"></span>
            <span class="text-sm text-gray-400">实时连接</span>
          </div>
        </div>
      </div>
    </nav>
    <main class="p-6">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000')

onMounted(() => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
})

onUnmounted(() => {
  socket.disconnect()
})
</script>
