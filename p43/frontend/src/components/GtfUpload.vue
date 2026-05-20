<template>
  <div class="card">
    <h2>📁 Upload Gene Annotation (GTF)</h2>
    <p style="color: #666; margin-bottom: 16px;">
      Upload GTF file to enable functional risk prioritization of off-target sites
    </p>
    
    <div 
      class="upload-area"
      :class="{ dragover: isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave="isDragOver = false"
      @drop.prevent="handleDrop"
      @click="$refs.fileInput.click()"
    >
      <input 
        ref="fileInput" 
        type="file" 
        accept=".gtf,.gtf.gz,.gff" 
        style="display: none"
        @change="handleFileSelect"
      >
      
      <div v-if="!uploadedFile">
        <p style="font-size: 48px; margin-bottom: 16px;">🧬</p>
        <p style="color: #4a5568;">Click or drag GTF/GFF file here</p>
        <p style="color: #718096; font-size: 12px; margin-top: 8px;">
          Supports .gtf, .gtf.gz, .gff formats
        </p>
      </div>
      
      <div v-else>
        <p style="font-size: 48px; margin-bottom: 16px; color: #48bb78;">✅</p>
        <p style="color: #2f855a; font-weight: 500;">{{ uploadedFile.filename }}</p>
        <p style="color: #718096; font-size: 12px; margin-top: 8px;">
          {{ formatSize(uploadedFile.size) }}
        </p>
      </div>
    </div>
    
    <div v-if="uploadedFile && jobId" style="margin-top: 20px;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <label style="font-weight: 500;">Top N sites to prioritize:</label>
        <select v-model.number="topN" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <option :value="50">50</option>
          <option :value="100" selected>100</option>
          <option :value="200">200</option>
          <option :value="500">500</option>
        </select>
      </div>
      
      <button 
        class="btn btn-primary" 
        @click="startPrioritization"
        :disabled="loading"
        style="width: 100%;"
      >
        {{ loading ? '⏳ Running Prioritization...' : '🎯 Start Risk Prioritization' }}
      </button>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'GtfUpload',
  props: {
    jobId: String
  },
  data() {
    return {
      isDragOver: false,
      uploadedFile: null,
      loading: false,
      topN: 100
    }
  },
  methods: {
    handleDrop(e) {
      this.isDragOver = false
      const files = e.dataTransfer.files
      if (files.length > 0) {
        this.uploadFile(files[0])
      }
    },
    handleFileSelect(e) {
      const files = e.target.files
      if (files.length > 0) {
        this.uploadFile(files[0])
      }
    },
    async uploadFile(file) {
      const formData = new FormData()
      formData.append('file', file)
      
      try {
        const response = await axios.post('/api/upload/gtf', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        this.uploadedFile = response.data
        this.$emit('gtf-uploaded', response.data)
      } catch (error) {
        alert('Upload failed: ' + error.message)
      }
    },
    async startPrioritization() {
      this.loading = true
      
      try {
        const response = await axios.post('/api/prioritize', {
          job_id: this.jobId,
          gtf_filename: this.uploadedFile.stored_filename,
          top_n: this.topN
        })
        
        this.$emit('prioritization-started', response.data.priority_job_id)
      } catch (error) {
        alert('Failed to start prioritization: ' + error.message)
      } finally {
        this.loading = false
      }
    },
    formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }
  }
}
</script>
