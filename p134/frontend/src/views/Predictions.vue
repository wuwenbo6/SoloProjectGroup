<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-dark-light rounded-xl p-6">
        <h3 class="text-lg font-semibold mb-4">模型训练</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">交易所</label>
            <select v-model="trainForm.exchange" class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
              <option value="binance">Binance</option>
              <option value="coinbase">Coinbase</option>
              <option value="kraken">Kraken</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">交易对</label>
            <select v-model="trainForm.symbol" class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
              <option v-for="s in symbols" :key="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">预测周期 (分钟)</label>
            <input type="number" v-model.number="trainForm.horizon" 
                   class="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white">
          </div>
          <button @click="trainModel" 
            :disabled="training"
            class="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-50">
            {{ training ? '训练中...' : '开始训练' }}
          </button>
        </div>
      </div>

      <div class="bg-dark-light rounded-xl p-6 md:col-span-2">
        <h3 class="text-lg font-semibold mb-4">预测结果</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div v-for="(pred, symbol) in predictions" :key="symbol" class="p-3 bg-dark rounded-lg">
            <p class="text-sm font-medium">{{ symbol }}</p>
            <p class="text-lg font-bold" :class="pred.predictedReturn >= 0 ? 'text-success' : 'text-danger'">
              {{ pred.predictedReturn?.toFixed(3) }}%
            </p>
            <p class="text-sm text-gray-400">
              目标: ${{ pred.predictedPrice?.toFixed(2) }}
            </p>
            <div class="mt-2">
              <div class="text-xs text-gray-400">R²: {{ (pred.rSquared || 0).toFixed(3) }}</div>
              <div class="w-full bg-gray-700 rounded-full h-1 mt-1">
                <div class="h-1 rounded-full bg-blue-600" :style="{ width: `${Math.min(100, (pred.rSquared || 0) * 100)}%` }"></div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="Object.keys(predictions).length === 0" class="text-center text-gray-400 py-8">
          暂无预测数据，请先训练模型
        </div>
      </div>
    </div>

    <div class="bg-dark-light rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-4">已训练模型</h3>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-700">
              <th class="text-left py-3 text-gray-400 text-sm font-medium">交易对</th>
              <th class="text-left py-3 text-sm font-medium text-gray-400">交易所</th>
              <th class="text-right py-3 text-sm font-medium text-gray-400">R²</th>
              <th class="text-right py-3 text-sm font-medium text-gray-400">RMSE</th>
              <th class="text-right py-3 text-sm font-medium text-gray-400">样本数</th>
              <th class="text-right py-3 text-sm font-medium text-gray-400">预测周期</th>
              <th class="text-left py-3 text-sm font-medium text-gray-400">最后训练时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="model in models" :key="model.id" class="border-b border-gray-800 hover:bg-dark/50">
              <td class="py-3 text-sm font-medium">{{ model.symbol }}</td>
              <td class="py-3 text-sm capitalize">{{ model.exchange }}</td>
              <td class="py-3 text-sm text-right">{{ (model.rSquared || 0).toFixed(4) }}</td>
              <td class="py-3 text-sm text-right">{{ (model.rmse || 0).toFixed(6) }}</td>
              <td class="py-3 text-sm text-right">{{ model.sampleCount }}</td>
              <td class="py-3 text-sm text-right">{{ model.predictionHorizon }}分钟</td>
              <td class="py-3 text-sm">{{ new Date(model.lastTrainTime).toLocaleString() }}</td>
            </tr>
            <tr v-if="models.length === 0">
              <td colspan="7" class="py-8 text-center text-gray-400">暂无训练模型</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const symbols = ['BTCUSDT', 'ETHUSDT', 'LTCUSDT', 'XRPUSDT', 'ADAUSDT', 'SOLUSDT']

const trainForm = ref({
  exchange: 'binance',
  symbol: 'BTCUSDT',
  horizon: 60
})

const training = ref(false)
const predictions = ref({})
const models = ref([])

const trainModel = async () => {
  training.value = true
  try {
    const res = await fetch('/api/predictions/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trainForm.value)
    })
    const data = await res.json()
    if (data.success) {
      alert('训练完成!')
      fetchModels()
      fetchPredictions()
    } else {
      alert('训练失败: ' + data.error)
    }
  } catch (e) {
    alert('训练失败: ' + e.message)
  } finally {
    training.value = false
  }
}

const fetchPredictions = async () => {
  try {
    const res = await fetch(`/api/predictions/${trainForm.value.exchange}?symbols=${symbols.join(',')}`)
    predictions.value = await res.json()
  } catch (e) {
    console.error('Failed to fetch predictions:', e)
  }
}

const fetchModels = async () => {
  try {
    const res = await fetch('/api/predictions/models')
    models.value = await res.json()
  } catch (e) {
    console.error('Failed to fetch models:', e)
  }
}

onMounted(() => {
  fetchModels()
  fetchPredictions()
  
  const interval = setInterval(fetchPredictions, 30000)
  return () => clearInterval(interval)
})
</script>
