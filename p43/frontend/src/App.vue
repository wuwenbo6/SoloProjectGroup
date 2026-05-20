<template>
  <div class="container">
    <h1>🧬 CRISPR Off-Target Predictor</h1>
    
    <FileUpload @file-uploaded="handleFileUploaded" :uploaded-file="uploadedFile" />
    
    <GrnaInput 
      v-if="uploadedFile" 
      @start-analysis="startAnalysis" 
      :disabled="isAnalyzing" 
    />
    
    <AnalysisStatus 
      v-if="jobId" 
      :job-id="jobId" 
      @complete="handleAnalysisComplete" 
    />
    
    <div v-if="showResults" style="margin-top: 20px;">
      <div class="tab-container" style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          :class="['tab-btn', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
          style="padding: 10px 20px; border: none; background: transparent; cursor: pointer; font-size: 14px; border-bottom: 2px solid transparent;"
        >
          {{ tab.icon }} {{ tab.label }}
        </button>
      </div>
      
      <GenomeBrowser 
        v-if="activeTab === 'browser'" 
        :job-id="jobId" 
      />
      
      <ResultsTable 
        v-if="activeTab === 'all'" 
        :job-id="jobId" 
      />
      
      <GtfUpload 
        v-if="activeTab === 'priority'" 
        :job-id="jobId" 
        @prioritization-started="handlePrioritizationStarted"
      />
      
      <HighRiskSites 
        v-if="activeTab === 'priority' && priorityJobId" 
        :priority-job-id="priorityJobId"
        @results-ready="handlePriorityResultsReady"
      />
    </div>
  </div>
</template>

<script>
import FileUpload from './components/FileUpload.vue'
import GrnaInput from './components/GrnaInput.vue'
import AnalysisStatus from './components/AnalysisStatus.vue'
import GenomeBrowser from './components/GenomeBrowser.vue'
import ResultsTable from './components/ResultsTable.vue'
import GtfUpload from './components/GtfUpload.vue'
import HighRiskSites from './components/HighRiskSites.vue'
import axios from 'axios'

export default {
  name: 'App',
  components: {
    FileUpload,
    GrnaInput,
    AnalysisStatus,
    GenomeBrowser,
    ResultsTable,
    GtfUpload,
    HighRiskSites
  },
  data() {
    return {
      uploadedFile: null,
      jobId: null,
      isAnalyzing: false,
      showResults: false,
      activeTab: 'all',
      priorityJobId: null,
      priorityResults: null,
      tabs: [
        { id: 'all', label: 'All Results', icon: '📋' },
        { id: 'browser', label: 'Genome Browser', icon: '🧬' },
        { id: 'priority', label: 'Risk Prioritization', icon: '⚠️' }
      ]
    }
  },
  methods: {
    handleFileUploaded(file) {
      this.uploadedFile = file
      this.showResults = false
      this.jobId = null
      this.priorityJobId = null
      this.priorityResults = null
    },
    async startAnalysis({ grna, mode }) {
      this.isAnalyzing = true
      this.showResults = false
      
      try {
        const response = await axios.post('/api/analyze', {
          grna: grna,
          fasta_filename: this.uploadedFile.stored_filename,
          use_bwa: false,
          mode: mode
        })
        
        this.jobId = response.data.job_id
      } catch (error) {
        alert('Error starting analysis: ' + error.message)
        this.isAnalyzing = false
      }
    },
    handleAnalysisComplete() {
      this.showResults = true
      this.isAnalyzing = false
    },
    handlePrioritizationStarted(priorityJobId) {
      this.priorityJobId = priorityJobId
    },
    handlePriorityResultsReady(results) {
      this.priorityResults = results
    }
  }
}
</script>

<style scoped>
.tab-btn.active {
  border-bottom-color: #667eea !important;
  color: #667eea;
  font-weight: 500;
}

.tab-btn:hover:not(.active) {
  background: #f7fafc;
}
</style>
