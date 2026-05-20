<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <h2 class="text-2xl font-bold">系统配置</h2>

    <div class="bg-dark-light rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-4">自定义套利三角</h3>
      <p class="text-gray-400 mb-4">
        添加或修改监控的交易对三角组合。每个三角包含3个交易对，用于计算循环套利机会。
      </p>
      
      <div class="space-y-4">
        <div 
          v-for="(triangle, index) in customTriangles" 
          :key="index"
          class="flex items-center space-x-4 p-4 bg-dark/50 rounded-lg"
        >
          <input 
            v-model="triangle[0]" 
            class="flex-1 bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white"
            placeholder="交易对1 (如 BTCUSDT)"
          />
          <span class="text-gray-500">→</span>
          <input 
            v-model="triangle[1]" 
            class="flex-1 bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white"
            placeholder="交易对2 (如 ETHBTC)"
          />
          <span class="text-gray-500">→</span>
          <input 
            v-model="triangle[2]" 
            class="flex-1 bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white"
            placeholder="交易对3 (如 ETHUSDT)"
          />
          <button 
            @click="removeTriangle(index)"
            class="px-3 py-2 text-danger hover:bg-danger/20 rounded-lg transition-colors"
          >
            删除
          </button>
        </div>
      </div>

      <button 
        @click="addTriangle"
        class="mt-4 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
      >
        + 添加新三角
      </button>

      <button 
        @click="saveTriangles"
        class="mt-4 ml-4 px-6 py-2 bg-success text-white rounded-lg hover:bg-success/80 transition-colors"
      >
        保存配置
      </button>
    </div>

    <div class="bg-dark-light rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-4">通知设置</h3>
      <div class="flex items-center justify-between p-4 bg-dark/50 rounded-lg">
        <div>
          <p class="font-medium">浏览器桌面通知</p>
          <p class="text-sm text-gray-400">发现套利机会时发送桌面通知</p>
        </div>
        <button 
          @click="toggleNotifications"
          class="px-4 py-2 rounded-lg transition-colors"
          :class="notificationEnabled ? 'bg-success text-white' : 'bg-gray-700 text-gray-300'"
        >
          {{ notificationEnabled ? '已启用' : '未启用' }}
        </button>
      </div>
    </div>

    <div class="bg-dark-light rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-4">关于系统</h3>
      <div class="space-y-2 text-gray-300">
        <p><strong>版本:</strong> 1.0.0</p>
        <p><strong>监控交易所:</strong> Binance, Coinbase, Kraken</p>
        <p><strong>数据更新:</strong> 实时 WebSocket</p>
        <p><strong>存储:</strong> Redis (缓存), PostgreSQL (历史)</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const customTriangles = ref([
  ['BTCUSDT', 'ETHBTC', 'ETHUSDT'],
  ['BTCUSDT', 'LTCBTC', 'LTCUSDT'],
  ['ETHUSDT', 'BTCETH', 'BTCUSDT']
])

const notificationEnabled = ref(false)

onMounted(async () => {
  try {
    const response = await fetch('/api/triangles')
    customTriangles.value = await response.json()
  } catch (e) {
    console.error('Failed to fetch triangles:', e)
  }
  
  if ('Notification' in window) {
    notificationEnabled.value = Notification.permission === 'granted'
  }
})

const addTriangle = () => {
  customTriangles.value.push(['', '', ''])
}

const removeTriangle = (index) => {
  customTriangles.value.splice(index, 1)
}

const saveTriangles = async () => {
  try {
    const validTriangles = customTriangles.value.filter(t => t.every(p => p.trim()))
    await fetch('/api/triangles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triangles: validTriangles })
    })
    alert('配置保存成功!')
  } catch (e) {
    alert('保存失败: ' + e.message)
  }
}

const toggleNotifications = () => {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      alert('通知已启用，如需禁用请在浏览器设置中更改')
    } else {
      Notification.requestPermission().then(permission => {
        notificationEnabled.value = permission === 'granted'
        if (permission === 'granted') {
          new Notification('🔔 通知已启用!', {
            body: '发现套利机会时您会收到通知'
          })
        }
      })
    }
  }
}
</script>
