<template>
  <div class="card">
    <h2>⚠️ High Risk Off-Target Sites</h2>
    
    <div v-if="loading" style="text-align: center; padding: 40px;">
      <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
      <p>Analyzing functional risk and prioritizing sites...</p>
    </div>
    
    <div v-else-if="results" class="results-container">
      <div class="summary-stats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
        <div class="stat-card" style="padding: 16px; background: #fff5f5; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #c53030;">{{ results.risk_distribution.CRITICAL }}</div>
          <div style="font-size: 12px; color: #666;">CRITICAL</div>
        </div>
        <div class="stat-card" style="padding: 16px; background: #fffaf0; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #c05621;">{{ results.risk_distribution.HIGH }}</div>
          <div style="font-size: 12px; color: #666;">HIGH</div>
        </div>
        <div class="stat-card" style="padding: 16px; background: #f7fafc; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #2b6cb0;">{{ results.risk_distribution.MEDIUM }}</div>
          <div style="font-size: 12px; color: #666;">MEDIUM</div>
        </div>
        <div class="stat-card" style="padding: 16px; background: #f0fff4; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #2f855a;">{{ results.risk_distribution.LOW }}</div>
          <div style="font-size: 12px; color: #666;">LOW</div>
        </div>
      </div>
      
      <div class="feature-stats" style="margin-bottom: 24px; padding: 16px; background: #f7fafc; border-radius: 8px;">
        <h4 style="margin-bottom: 12px;">📊 Feature Distribution</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px;">
          <span v-if="results.feature_distribution.CDS > 0">
            <span style="color: #c53030; font-weight: bold;">{{ results.feature_distribution.CDS }}</span> in CDS
          </span>
          <span v-if="results.feature_distribution.UTR5 > 0">
            <span style="color: #c05621; font-weight: bold;">{{ results.feature_distribution.UTR5 }}</span> in 5'UTR
          </span>
          <span v-if="results.feature_distribution.UTR3 > 0">
            <span style="color: #d69e2e; font-weight: bold;">{{ results.feature_distribution.UTR3 }}</span> in 3'UTR
          </span>
          <span v-if="results.feature_distribution.exon > 0">
            <span style="color: #2b6cb0; font-weight: bold;">{{ results.feature_distribution.exon }}</span> in Exon
          </span>
          <span v-if="results.feature_distribution.intron > 0">
            <span style="color: #4a5568; font-weight: bold;">{{ results.feature_distribution.intron }}</span> in Intron
          </span>
          <span v-if="results.feature_distribution.intergenic > 0">
            <span style="color: #718096; font-weight: bold;">{{ results.feature_distribution.intergenic }}</span> Intergenic
          </span>
        </div>
      </div>
      
      <div class="sites-table" style="overflow-x: auto;">
        <table style="width: 100%; font-size: 13px;">
          <thead>
            <tr style="background: #edf2f7;">
              <th style="padding: 10px; text-align: left;">Rank</th>
              <th style="padding: 10px; text-align: left;">Risk Level</th>
              <th style="padding: 10px; text-align: left;">Location</th>
              <th style="padding: 10px; text-align: left;">Sequence</th>
              <th style="padding: 10px; text-align: left;">Mismatches</th>
              <th style="padding: 10px; text-align: left;">Feature</th>
              <th style="padding: 10px; text-align: left;">Gene(s)</th>
              <th style="padding: 10px; text-align: left;">Priority Score</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="(site, index) in results.prioritized_sites" 
              :key="index"
              :style="{ 
                background: getRiskBgColor(site.risk_category),
                borderBottom: '1px solid #e2e8f0'
              }"
            >
              <td style="padding: 10px; font-weight: bold;">{{ index + 1 }}</td>
              <td style="padding: 10px;">
                <span 
                  :style="{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: getRiskTextColor(site.risk_category),
                    background: getRiskBadgeColor(site.risk_category)
                  }"
                >
                  {{ site.risk_category }}
                </span>
              </td>
              <td style="padding: 10px; font-family: monospace;">
                {{ site.chromosome }}:{{ site.position }}
                <span style="font-size: 11px; color: #718096;">({{ site.strand }})</span>
              </td>
              <td style="padding: 10px; font-family: monospace; letter-spacing: 1px;">
                {{ site.sequence }}
              </td>
              <td style="padding: 10px; text-align: center;">
                {{ site.mismatch_count }}
              </td>
              <td style="padding: 10px;">
                <span style="color: #4a5568;">
                  {{ site.functional_risk.max_feature_type }}
                </span>
              </td>
              <td style="padding: 10px; max-width: 150px;">
                <div v-if="site.functional_risk.gene_count > 0" style="font-size: 12px;">
                  <span 
                    v-for="gene in site.functional_risk.overlapping_genes.slice(0, 2)" 
                    :key="gene.gene_id"
                    style="display: block;"
                  >
                    {{ gene.gene_name }}
                  </span>
                  <span v-if="site.functional_risk.gene_count > 2" style="color: #718096;">
                    +{{ site.functional_risk.gene_count - 2 }} more
                  </span>
                </div>
                <span v-else style="color: #a0aec0; font-size: 12px;">Intergenic</span>
              </td>
              <td style="padding: 10px; text-align: right; font-weight: bold;">
                {{ site.priority_score }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'HighRiskSites',
  props: {
    priorityJobId: String
  },
  data() {
    return {
      loading: false,
      results: null,
      pollInterval: null
    }
  },
  mounted() {
    if (this.priorityJobId) {
      this.startPolling()
    }
  },
  beforeUnmount() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
    }
  },
  watch: {
    priorityJobId(newId) {
      if (newId) {
        this.startPolling()
      }
    }
  },
  methods: {
    startPolling() {
      this.loading = true
      this.results = null
      
      this.pollInterval = setInterval(async () => {
        try {
          const response = await axios.get(`/api/prioritize/status/${this.priorityJobId}`)
          
          if (response.data.status === 'completed') {
            clearInterval(this.pollInterval)
            this.fetchResults()
          } else if (response.data.status === 'failed') {
            clearInterval(this.pollInterval)
            this.loading = false
            alert('Prioritization failed: ' + response.data.error)
          }
        } catch (error) {
          console.error('Polling error:', error)
        }
      }, 1000)
    },
    async fetchResults() {
      try {
        const response = await axios.get(`/api/prioritize/results/${this.priorityJobId}`)
        this.results = response.data
        this.$emit('results-ready', response.data)
      } catch (error) {
        console.error('Failed to fetch results:', error)
      } finally {
        this.loading = false
      }
    },
    getRiskBgColor(category) {
      const colors = {
        'CRITICAL': '#fff5f5',
        'HIGH': '#fffaf0',
        'MEDIUM': '#f7fafc',
        'LOW': '#f0fff4'
      }
      return colors[category] || '#ffffff'
    },
    getRiskBadgeColor(category) {
      const colors = {
        'CRITICAL': '#feb2b2',
        'HIGH': '#fbd38d',
        'MEDIUM': '#bee3f8',
        'LOW': '#c6f6d5'
      }
      return colors[category] || '#e2e8f0'
    },
    getRiskTextColor(category) {
      const colors = {
        'CRITICAL': '#9b2c2c',
        'HIGH': '#9c4221',
        'MEDIUM': '#2a4365',
        'LOW': '#22543d'
      }
      return colors[category] || '#1a202c'
    }
  }
}
</script>
