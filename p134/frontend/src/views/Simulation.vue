<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div v-for="(amount, currency) in balance" :key="currency" 
           class="bg-dark-light rounded-xl p-4">
        <p class="text-gray-400 text-sm">{{ currency }}</p>
        <p class="text-2xl font-bold">{{ parseFloat(amount).toFixed(4) }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="bg-dark-light rounded-xl p-6">
        <h3 class="text-lg font-semibold mb-4">模拟下单</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">交易所</label>
            <select v-model="tradeForm.exchange" class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
              <option value="binance">Binance</option>
              <option value="coinbase">Coinbase</option>
              <option value="kraken">Kraken</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">交易对</label>
            <select v-model="tradeForm.symbol" class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
            <option v-for="s in symbols" :key="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">方向</label>
            <div class="flex gap-2">
              <button @click="tradeForm.side = 'BUY'" 
                class="flex-1 py-2 rounded-lg transition-colors"
                :class="tradeForm.side === 'BUY' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'">买入</button>
              <button @click="tradeForm.side = 'SELL'" 
                class="flex-1 py-2 rounded-lg transition-colors"
                :class="tradeForm.side === 'SELL' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'">卖出</button>
            </div>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">数量</label>
            <input type="number" v-model.number="tradeForm.quantity" 
                   class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
          </div>
          <button @click="executeTrade" 
            :disabled="trading"
            class="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-50">
            {{ trading ? '交易中...' : '执行交易' }}
          </button>
          <button @click="resetSimulation" 
            class="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            重置模拟账户
          </button>
        </div>
      </div>

      <div class="bg-dark-light rounded-xl p-6">
        <h3 class="text-lg font-semibold mb-4">当前持仓</h3>
        <div v-if="positions.length === 0" class="text-center text-gray-400 py-8">
          暂无持仓
        </div>
        <div v-else class="space-y-3">
          <div v-for="pos in positions" :key="pos.symbol" class="p-3 bg-dark rounded-lg">
            <div class="flex justify-between items-center">
              <span class="font-medium">{{ pos.symbol }}</span>
              <span class="text-sm text-gray-400">数量: {{ pos.quantity?.toFixed(4) }}</span>
            </div>
            <div class="flex justify-between text-sm mt-1">
              <span class="text-gray-400">均价: {{ pos.avgEntryPrice?.toFixed(2) }}</span>
              <span class="text-gray-400">已实现盈亏: {{ pos.realizedPnl?.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-dark-light rounded-xl p-6">
        <h3 class="text-lg font-semibold mb-4">绩效统计</h3>
        <div class="space-y-4">
          <div class="flex justify-between">
            <span class="text-gray-400">总交易次数</span>
            <span class="font-semibold">{{ performance.totalTrades || 0}}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">盈利交易</span>
            <span class="font-semibold text-success">{{ performance.profitableTrades || 0 }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">胜率</span>
            <span class="font-semibold">{{ ((performance.winRate || 0) * 100).toFixed(2) }}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">已实现盈亏</span>
            <span class="font-semibold" :class="performance.realizedPnl >= 0 ? 'text-success' : 'text-danger'">{{ (performance.realizedPnl || 0 .toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-dark-light rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-4">交易历史</h3>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
          <tr class="border-b border-gray-700">
            <th class="text-left py-3 text-gray-400 text-sm font-medium">时间</th>
            <th class="text-left py-3 text-sm font-medium text-gray-400">交易所</th>
            <th class="text-left py-3 text-sm font-medium text-gray-400">交易对</th>
            <th class="text-left py-3 text-sm font-medium text-gray-400">方向</th>
            <th class="text-right py-3 text-sm font-medium text-gray-400">数量</th>
            <th class="text-right py-3 text-sm font-medium text-gray-400">价格</th>
            <th class="text-right py-3 text-sm font-medium text-gray-400">手续费</th>
          </tr>
          </thead>
          <tbody>
            <tr v-for="trade in tradeHistory" :key="trade.id" class="border-b border-gray-800 hover:bg-dark/50">
            <td class="py-3 text-sm">{{ new Date(trade.createdAt).toLocaleString() }}</td>
            <td class="py-3 text-sm capitalize">{{ trade.exchange }}</td>
            <td class="py-3 text-sm">{{ trade.symbol }}</td>
            <td class="py-3 text-sm">
              <span class="px-2 py-1 rounded text-xs" 
                :class="trade.side === 'BUY' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'">
                {{ trade.side }}
              </span>
            </td>
            <td class="py-3 text-sm text-right">{{ trade.quantity?.toFixed(4) }}</td>
            <td class="py-3 text-sm text-right">{{ trade.price?.toFixed(2) }}</td>
            <td class="py-3 text-sm text-right">{{ trade.fee?.toFixed(4) }}</td>
          </tr>
          <tr v-if="tradeHistory.length === 0">
            <td colspan="7" class="py-8 text-center text-gray-400">暂无交易记录</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const balance = ref({})
const positions = ref([])
const tradeHistory = ref([])
const performance = ref({})
const trading = ref(false)
const symbols = ['BTCUSDT', 'ETHUSDT', 'LTCUSDT', 'XRPUSDT', 'ADAUSDT', 'SOLUSDT']

const tradeForm = ref({
  exchange: 'binance',
  symbol: 'BTCUSDT',
  side: 'BUY',
  quantity: 0.01
})

const fetchBalance = async () => {
  try {
    const res = await fetch('/api/trading/balance')
    balance.value = await res.json()
  } catch (e) {
    console.error('Failed to fetch balance:', e)
  }
}

const fetchPositions = async () => {
  try {
    const res = await fetch('/api/trading/positions')
    positions.value = await res.json()
  } catch (e) {
    console.error('Failed to fetch positions:', e)
  }
}

const fetchTradeHistory = async () => {
  try {
    const res = await fetch('/api/trading/history?limit=50')
    tradeHistory.value = await res.json()
  } catch (e) {
    console.error('Failed to fetch trade history:', e)
  }
}

const fetchPerformance = async () => {
  try {
    const res = await fetch('/api/status')
    const data = await res.json()
    performance.value = data.simulation || {}
  } catch (e) {
    console.error('Failed to fetch performance:', e)
  }
}

const executeTrade = async () => {
  trading.value = true
  try {
    const res = await fetch('/api/trading/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeForm.value)
    })
    const data = await res.json()
    if (data.success) {
      alert('交易成功!')
      fetchBalance()
      fetchPositions()
      fetchTradeHistory()
      fetchPerformance()
    } else {
      alert('交易失败: ' + data.error)
    }
  } catch (e) {
    alert('交易失败: ' + e.message)
  } finally {
    trading.value = false
  }
}

const resetSimulation = async () => {
  if (confirm('确定要重置模拟账户吗?')) {
    try {
      await fetch('/api/trading/reset', { method: 'POST' })
      fetchBalance()
      fetchPositions()
      fetchTradeHistory()
      fetchPerformance()
      alert('模拟账户已重置')
    } catch (e) {
      console.error('Failed to reset simulation:', e)
    }
  }
}

onMounted(() => {
  fetchBalance()
  fetchPositions()
  fetchTradeHistory()
  fetchPerformance()
  
  const interval = setInterval(() => {
    fetchBalance()
    fetchPositions()
    fetchPerformance()
  }, 5000)
  
  return () => clearInterval(interval)
})
</script>
