<template>
  <div class="card">
    <h2>⏳ Analysis in Progress</h2>
    
    <div style="text-align: center; padding: 20px;">
      <div v-if="status === 'running'" style="font-size: 48px; margin-bottom: 16px;">
        🔄
      </div>
      <div v-else-if="status === 'completed'" style="font-size: 48px; margin-bottom: 16px;">
        ✅
      </div>
      <div v-else style="font-size: 48px; margin-bottom: 16px;">
        ❌
      </div>
      
      <p style="font-size: 18px; margin-bottom: 16px;">
        Status: {{ status }}
      </p>
      
      <div v-if="status === 'running'" class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      
      <p v-if="status === 'completed'" style="color: #48bb78; font-weight: 500;">
        Analysis complete! Found {{ totalResults?.toLocaleString() || 0 }} off-target sites
      </p>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'AnalysisStatus',
  props: {
    jobId: String
  },
  data() {
    return {
      status: 'running',
      progress: 0,
      totalResults: null,
      pollInterval: null
    }
  },
  mounted() {
    this.startPolling()
  },
  beforeUnmount() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
    }
  },
  methods: {
    startPolling() {
      this.pollInterval = setInterval(async () => {
        try {
          const response = await axios.get(`/api/status/${this.jobId}`)
          this.status = response.data.status
          
          if (this.status === 'running') {
            this.progress = Math.min(this.progress + 10, 90)
          } else if (this.status === 'completed') {
            this.progress = 100
            this.totalResults = response.data.total_count
            clearInterval(this.pollInterval)
            this.$emit('complete', { jobId: this.jobId, totalCount: this.totalResults })
          } else if (this.status === 'failed') {
            clearInterval(this.pollInterval)
            alert('Analysis failed')
          }
        } catch (error) {
          console.error('Polling error:', error)
        }
      }, 1000)
    }
  }
}
</script>
