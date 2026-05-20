<template>
  <div class="card">
    <h2>📁 Upload Reference Genome</h2>
    
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
        accept=".fasta,.fa,.fna" 
        style="display: none"
        @change="handleFileSelect"
      >
      
      <div v-if="!uploadedFile">
        <p style="font-size: 48px; margin-bottom: 16px;">📄</p>
        <p style="color: #4a5568;">Click or drag FASTA file here</p>
        <p style="color: #718096; font-size: 12px; margin-top: 8px;">Supports .fasta, .fa, .fna</p>
      </div>
      
      <div v-else>
        <p style="font-size: 48px; margin-bottom: 16px; color: #48bb78;">✅</p>
        <p style="color: #2f855a; font-weight: 500;">{{ uploadedFile.filename }}</p>
        <p style="color: #718096; font-size: 12px; margin-top: 8px;">
          {{ formatSize(uploadedFile.size) }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'FileUpload',
  props: {
    uploadedFile: Object
  },
  data() {
    return {
      isDragOver: false
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
        const response = await axios.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        this.$emit('file-uploaded', response.data)
      } catch (error) {
        alert('Upload failed: ' + error.message)
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
