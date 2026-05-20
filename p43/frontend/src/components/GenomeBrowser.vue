<template>
  <div class="card">
    <h2>🧬 Genome Browser</h2>
    
    <div v-if="metadata" class="browser-stats" style="margin-bottom: 16px; padding: 12px; background: #f7fafc; border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 20px;">{{ metadata.mode === 'crispra' ? '🔗' : '⚔️' }}</span>
        <strong>{{ metadata.mode === 'crispra' ? 'CRISPRa Binding Sites' : 'CRISPRn Cutting Sites' }}</strong>
      </div>
      <span>Showing top {{ Math.min(displayLimit, metadata.total_count) }} highest-scoring sites</span>
      <div style="margin-top: 8px; display: flex; gap: 12px; align-items: center;">
        <label>
          Display limit:
          <select v-model="displayLimit" @change="loadTopResults" style="margin-left: 8px; padding: 4px 8px;">
            <option :value="100">100 sites</option>
            <option :value="200">200 sites</option>
            <option :value="500">500 sites</option>
            <option :value="1000">1000 sites</option>
          </select>
        </label>
        <span v-if="metadata.mode === 'crispra'" style="font-size: 12px; opacity: 0.8;">
          💡 Score based on dCas9 binding affinity
        </span>
        <span v-else style="font-size: 12px; opacity: 0.8;">
          💡 Score based on Cas9 cutting efficiency
        </span>
      </div>
    </div>
    
    <div class="genome-browser">
      <div v-for="(sites, chrom) in byChromosome" :key="chrom">
        <h4 style="margin: 10px 0;">{{ chrom }} ({{ sites.length }} sites)</h4>
        <div class="track" :style="{ width: trackWidth + 'px' }">
          <div
            v-for="site in sites"
            :key="site.position + site.strand"
            class="feature"
            :class="site.is_ontarget ? 'feature-ontarget' : 'feature-offtarget'"
            :style="{
              left: getPosition(site.position) + 'px',
              width: '6px'
            }"
            :title="getTooltip(site)"
          >
          </div>
        </div>
      </div>
    </div>
    
    <div style="margin-top: 20px;">
      <h3>📊 Alignment Visualization (Mermaid)</h3>
      <div ref="mermaidChart" class="mermaid"></div>
    </div>
    
    <div style="margin-top: 20px; display: flex; gap: 20px;">
      <div style="display: flex; align-items: center;">
        <span style="display: inline-block; width: 20px; height: 20px; background: #48bb78; border-radius: 4px; margin-right: 8px;"></span>
        On-Target
      </div>
      <div style="display: flex; align-items: center;">
        <span style="display: inline-block; width: 20px; height: 20px; background: #f56565; border-radius: 4px; margin-right: 8px;"></span>
        Off-Target
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import mermaid from 'mermaid'

export default {
  name: 'GenomeBrowser',
  props: {
    results: Object,
    jobId: String
  },
  data() {
    return {
      displayLimit: 500,
      maxPosition: 0,
      trackWidth: 800,
      topSites: [],
      metadata: null
    }
  },
  computed: {
    byChromosome() {
      const groups = {}
      for (const site of this.topSites) {
        if (!groups[site.chromosome]) {
          groups[site.chromosome] = []
        }
        groups[site.chromosome].push(site)
      }
      for (const chrom of Object.keys(groups)) {
        groups[chrom].sort((a, b) => a.position - b.position)
      }
      return groups
    }
  },
  mounted() {
    if (this.jobId) {
      this.loadTopResults()
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
    async loadTopResults() {
      try {
        const response = await axios.get(`/api/results/${this.jobId}/top`, {
          params: { limit: this.displayLimit }
        })
        
        this.topSites = response.data.offtargets
        this.calculateScale()
        this.$nextTick(() => {
          this.renderMermaid()
        })
      } catch (error) {
        console.error('Failed to load top results:', error)
      }
    },
    calculateScale() {
      let maxPos = 0
      for (const site of this.topSites) {
        if (site.position > maxPos) {
          maxPos = site.position
        }
      }
      this.maxPosition = maxPos + 100
    },
    getPosition(pos) {
      return (pos / this.maxPosition) * this.trackWidth
    },
    getTooltip(site) {
      return `${site.chromosome}:${site.position} (${site.strand})\n${site.sequence}\n${site.mismatch_count} mismatches\nScore: ${site.aggregate_score}%`
    },
    renderMermaid() {
      mermaid.initialize({ startOnLoad: false, theme: 'default' })
      
      const sitesForMermaid = this.topSites.slice(0, 50)
      
      let graphDef = 'graph TD\n'
      graphDef += '    G[gRNA: ' + (this.metadata?.grna?.substring(0, 8) || '') + '...] --> O[On-Target Sites]\n'
      graphDef += '    G --> F[Off-Target Sites]\n'
      
      const ontargets = sitesForMermaid.filter(s => s.is_ontarget)
      const offtargets = sitesForMermaid.filter(s => !s.is_ontarget)
      
      ontargets.slice(0, 3).forEach((site, i) => {
        graphDef += `    O --> O${i}[${site.chromosome}:${site.position}\\nScore: ${site.aggregate_score}%]\n`
      })
      
      if (ontargets.length > 3) {
        graphDef += `    O --> OM[+${ontargets.length - 3} more...]\n`
      }
      
      const mmGroups = {}
      offtargets.slice(0, 20).forEach(site => {
        const mm = site.mismatch_count
        if (!mmGroups[mm]) mmGroups[mm] = []
        mmGroups[mm].push(site)
      })
      
      for (const mm of Object.keys(mmGroups).sort().slice(0, 5)) {
        graphDef += `    F --> M${mm}[${mm} Mismatch (${mmGroups[mm].length})]\n`
        mmGroups[mm].slice(0, 2).forEach((site, i) => {
          graphDef += `    M${mm} --> S${mm}_${i}[${site.chromosome}:${site.position}\\nScore: ${site.aggregate_score}%]\n`
        })
      }
      
      this.$refs.mermaidChart.innerHTML = graphDef
      mermaid.run({ nodes: [this.$refs.mermaidChart] })
    }
  }
}
</script>

<style scoped>
.genome-browser {
  background: #f7fafc;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
  overflow-x: auto;
}

.track {
  position: relative;
  height: 24px;
  margin: 10px 0;
  background: white;
  border-radius: 4px;
}

.feature {
  position: absolute;
  height: 16px;
  top: 4px;
  border-radius: 2px;
  cursor: pointer;
  transition: transform 0.1s;
}

.feature:hover {
  transform: scaleY(1.5);
  z-index: 10;
}

.feature-ontarget {
  background: #48bb78;
}

.feature-offtarget {
  background: #f56565;
}

.browser-stats {
  padding: 12px;
  background: #f7fafc;
  border-radius: 8px;
  font-size: 14px;
}

.mermaid {
  overflow-x: auto;
}
</style>
