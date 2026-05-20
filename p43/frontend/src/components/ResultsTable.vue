<template>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2>📋 Results</h2>
      <button class="btn btn-success" @click="exportBed">
        📥 Export BED
      </button>
    </div>
    
    <div v-if="metadata" class="stats-bar" style="margin-bottom: 16px; padding: 16px; background: #f7fafc; border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <span style="font-size: 24px;">{{ metadata.mode === 'crispra' ? '🔗' : '⚔️' }}</span>
        <div>
          <strong>{{ metadata.mode === 'crispra' ? 'CRISPRa (dCas9) - Binding Analysis' : 'CRISPRn (Cas9) - Cutting Analysis' }}</strong>
          <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
            {{ metadata.mode === 'crispra' ? 'No PAM required - Evaluates DNA binding affinity' : 'Requires NGG PAM - Evaluates cutting efficiency' }}
          </div>
        </div>
      </div>
      <div style="margin-top: 8px;">
        <strong>gRNA:</strong> {{ metadata.grna }}
      </div>
      <div style="margin-top: 12px; display: flex; gap: 24px; font-size: 14px; flex-wrap: wrap;">
        <span>📊 Total sites: {{ metadata.total_count.toLocaleString() }}</span>
        <span>✅ On-target: {{ metadata.ontarget_count.toLocaleString() }}</span>
        <span>❌ Off-target: {{ metadata.offtarget_count.toLocaleString() }}</span>
        <span>📑 Pages: {{ Math.ceil(metadata.total_count / 100) }}</span>
        <span v-if="metadata.mode === 'crispra'">🧬 Seed region: Positions 10-19</span>
      </div>
    </div>
    
    <VirtualScrollTable 
      v-if="jobId"
      :job-id="jobId"
      :grna="metadata?.grna"
      @page-loaded="handlePageLoaded"
    />
  </div>
</template>

<script>
import axios from 'axios'
import VirtualScrollTable from './VirtualScrollTable.vue'

export default {
  name: 'ResultsTable',
  components: {
    VirtualScrollTable
  },
  props: {
    results: Object,
    jobId: String
  },
  data() {
    return {
      metadata: null
    }
  },
  mounted() {
    if (this.jobId) {
      this.loadMetadata()
    }
  },
  methods: {
    async loadMetadata() {
      try {
        const response = await axios.get(`/api/results/${this.jobId}/metadata`)
        this.metadata = response.data
      } catch (error) {
        console.error('Failed to load metadata:', error)
      }
    },
    handlePageLoaded(pageInfo) {
      console.log('Page loaded:', pageInfo)
    },
    async exportBed() {
      try {
        const response = await axios.get(`/api/export/bed/${this.jobId}`, {
          responseType: 'blob'
        })
        
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `offtargets_${this.jobId.substring(0, 8)}.bed`)
        document.body.appendChild(link)
        link.click()
        link.remove()
      } catch (error) {
        alert('Export failed: ' + error.message)
      }
    }
  }
}
</script>
