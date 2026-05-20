<template>
  <div class="space-y-6">
    <div class="bg-dark-light rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-4">回测配置</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">回测名称</label>
          <input type="text" v-model="backtestForm.name" 
                 class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white"
                 placeholder="输入回测名称">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">交易所</label>
          <select v-model="backtestForm.exchange" class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
            <option value="binance">Binance</option>
            <option value="coinbase">Coinbase</option>
            <option value="kraken">Kraken</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">初始资金 (USDT)</label>
          <input type="number" v-model.number="backtestForm.initialCapital" 
                 class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">回测天数</label>
          <input type="number" v-model.number="backtestForm.days" 
                 class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">手续费率 (%)</label>
          <input type="number" step="0.001" v-model.number="backtestForm.feeRate" 
                 class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">滑点 (%)</label>
          <input type="number" step="0.001" v-model.number="backtestForm.slippage" 
                 class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">套利阈值 (%)</label>
          <input type="number" step="0.001" v-model.number="backtestForm.triggerThreshold" 
                 class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
        </div>
        <div class="flex items-end">
          <button @click="runBacktest" 
            :disabled="backtestRunning"
            class="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-50">
            {{ backtestRunning ? '回测中...' : '开始回测' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="currentResult" class="bg-dark-light rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-4">回测结果 - {{ currentResult.name }}</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="p-4 bg-dark rounded-lg">
          <p class="text-gray-400 text-sm">总收益率</p>
          <p class="text-2xl font-bold" :class="currentResult.totalReturn >= 0 ? 'text-success' : 'text-danger'">
            {{ currentResult.totalReturn?.toFixed(2) }}%
          </p>
        </div>
        <div class="p-4 bg-dark rounded-lg">
          <p class="text-gray-400 text-sm">最终资金</p>
          <p class="text-2xl font-bold text-primary">
            ${{ currentResult.finalCapital?.toFixed(2) }}
          </p>
        </div>
        <div class="p-4 bg-dark rounded-lg">
          <p class="text-gray-400 text-sm">胜率</p>
          <p class="text-2xl font-bold text-warning">
            {{ (currentResult.winRate * 100)?.toFixed(2) }}%
          </p>
        </div>
        <div class="p-4 bg-dark rounded-lg">
          <p class="text-gray-400 text-sm">最大回撤</p>
          <p class="text-2xl font-bold text-danger">
            -{{ currentResult.maxDrawdown?.toFixed(2) }}%
          </p>
        </div>
        <div class="p-4 bg-dark rounded-lg">
          <p class="text-gray-400 text-sm">夏普比率</p>
          <p class="text-2xl font-bold">
            {{ currentResult.sharpeRatio?.toFixed(2) }}
          </p>
        </div>
        <div class="p-4 bg-dark rounded-lg">
          <p class="text-gray-400 text-sm">盈利因子</p>
          <p class="text-2xl font-bold">
            {{ currentResult.profitFactor?.toFixed(2) }}
          </p>
        </div>
        <div class="p-4 bg-dark rounded-lg">
          <p class="text-gray-400 text-sm">总交易次数</p>
          <p class="text-2xl font-bold">
            {{ currentResult.totalTrades }}
          </p>
        </div>
        <div class="p-4 bg-dark rounded-lg">
          <p class="text-gray-400 text-sm">平均交易盈亏</p>
          <p class="text-2xl font-bold" :class="currentResult.avgTradePnl >= 0 ? 'text-success' : 'text-danger'">
            ${{ currentResult.avgTradePnl?.toFixed(2) }}
          </p>
        </div>
      </div>
      
      <div class="mt-6">
        <h4 class="font-semibold mb-3">净值曲线</h4>
        <div class="h-64 bg-dark rounded-lg p-4">
          <EquityChart :data="currentResult.equityCurve" />
        </div>
      </div>
    </div>

    <div class="bg-dark-light rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-4">历史回测</h3>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
          <tr class="border-b border-gray-700">
            <th class="text-left py-3 text-gray-400 text-sm font-medium">名称</th>
            <th class="text-left py-3 text-sm font-medium text-gray-400">交易所</th>
            <th class="text-left py-3 text-sm font-medium text-gray-400">开始时间</th>
            <th class="text-right py-3 text-sm font-medium text-gray-400">初始资金</th>
            <th class="text-right py-3 text-sm font-medium text-gray-400">收益率</th>
            <th class="text-right py-3 text-sm font-medium text-gray-400">胜率</th>
            <th class="text-right py-3 text-sm font-medium text-gray-400">最大回撤</th>
            <th class="text-right py-3 text-sm font-medium text-gray-400">夏普比率</th>
            <th class="text-center py-3 text-sm font-medium text-gray-400">状态</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="result in backtestResults" :key="result.id" 
              class="border-b border-gray-800 hover:bg-dark/50 cursor-pointer"
              @click="loadResult(result)">
            <td class="py-3 text-sm font-medium">{{ result.name }}</td>
            <td class="py-3 text-sm capitalize">{{ result.exchange }}</td>
            <td class="py-3 text-sm">{{ new Date(result.startTime).toLocaleDateString() }}</td>
            <td class="py-3 text-sm text-right">${{ result.initialCapital?.toFixed(2) }}</td>
            <td class="py-3 text-sm text-right" :class="result.totalReturn >= 0 ? 'text-success' : 'text-danger'">
              {{ result.totalReturn?.toFixed(2) }}%
            </td>
            <td class="py-3 text-sm text-right">{{ (result.winRate * 100?.toFixed(2) }}%</td>
            <td class="py-3 text-sm text-right text-danger">-{{ result.maxDrawdown?.toFixed(2) }}%</td>
            <td class="py-3 text-sm text-right">{{ result.sharpeRatio?.toFixed(2) }}</td>
            <td class="py-3 text-sm text-center">
              <span class="px-2 py-1 rounded text-xs" 
                :class="result.status === 'COMPLETED' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'">
                {{ result.status }}
              </span>
            </td>
          </tr>
          <tr v-if="backtestResults.length === 0">
            <td colspan="9" class="py-8 text-center text-gray-400">暂无回测记录</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import EquityChart from '../components/EquityChart.vue'

const backtestForm = ref({
  name: '三角套利回测',
  exchange: 'binance',
  initialCapital: 10000,
  feeRate: 0.001,
  slippage: 0.0005,
  triggerThreshold: 0.003,
  days: 7
})

const backtestRunning = ref(false)
const backtestResults = ref([])
const currentResult = ref(null)

const runBacktest = async () => {
  backtestRunning.value = true
  try {
    const eventSource = new EventSource('/api/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backtestForm.value)
    })
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'complete') {
        currentResult.value = data.result
        fetchBacktestResults()
        backtestRunning.value = false
        eventSource.close()
      }
    }
    
    eventSource.onerror = () => {
      backtestRunning.value = false
      eventSource.close()
    }
  } catch (e) {
    console.error('Backtest failed:', e)
    backtestRunning.value = false
  }
}

const fetchBacktestResults = async () => {
  try {
    const res = await fetch('/api/backtest/results?limit=20')
    backtestResults.value = await res.json()
  } catch (e) {
    console.error('Failed to fetch backtest results:', e)
  }
}

const loadResult = (result) => {
  currentResult.value = result
}

onMounted(() => {
  fetchBacktestResults()
})
</script>
