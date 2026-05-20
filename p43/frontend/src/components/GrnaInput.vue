<template>
  <div class="card">
    <h2>🎯 Enter gRNA Sequence & Select Mode</h2>
    
    <div class="mode-selector" style="margin-bottom: 20px;">
      <div style="margin-bottom: 8px; font-weight: 500;">CRISPR Mode:</div>
      <div class="mode-buttons" style="display: flex; gap: 12px;">
        <button 
          class="mode-btn" 
          :class="{ active: mode === 'crisprn' }"
          @click="setMode('crisprn')"
          :disabled="disabled"
        >
          <span style="font-size: 20px;">⚔️</span>
          <div style="text-align: left;">
            <strong>CRISPRn (Cas9)</strong>
            <div style="font-size: 12px; opacity: 0.8;">Gene Editing - Requires NGG PAM</div>
          </div>
        </button>
        <button 
          class="mode-btn" 
          :class="{ active: mode === 'crispra' }"
          @click="setMode('crispra')"
          :disabled="disabled"
        >
          <span style="font-size: 20px;">🔗</span>
          <div style="text-align: left;">
            <strong>CRISPRa (dCas9)</strong>
            <div style="font-size: 12px; opacity: 0.8;">Gene Activation - No PAM Required</div>
          </div>
        </button>
      </div>
    </div>
    
    <input 
      type="text" 
      v-model="grna" 
      placeholder="Enter 20bp gRNA sequence (IUPAC codes supported: R, Y, S, W, K, M, B, D, H, V, N)"
      :disabled="disabled"
      @input="validateGrna"
    >
    
    <div v-if="grna" style="margin-bottom: 16px;">
      <span :style="{ color: isValid ? '#48bb78' : '#f56565' }">
        {{ grna.length }} / 20 bp
      </span>
      <span v-if="!isValid" style="color: #f56565; margin-left: 16px;">
        <span v-if="grna.length !== 20">gRNA must be exactly 20 characters</span>
        <span v-else>Invalid character detected. Use: A, T, G, C, or IUPAC codes (R, Y, S, W, K, M, B, D, H, V, N)</span>
      </span>
      <span v-if="hasIupac && isValid" style="color: #667eea; margin-left: 16px;">
        💡 IUPAC degenerate bases detected: {{ iupacBases }}
      </span>
    </div>
    
    <button 
      class="btn btn-primary" 
      @click="submit"
      :disabled="!isValid || disabled"
    >
      🔬 Start {{ mode === 'crisprn' ? 'Cutting' : 'Binding' }} Analysis
    </button>
  </div>
</template>

<script>
export default {
  name: 'GrnaInput',
  props: {
    disabled: Boolean
  },
  data() {
    return {
      grna: '',
      mode: 'crisprn'
    }
  },
  computed: {
    isValid() {
      return this.grna.length === 20 && /^[ATGCRYSWKMBDHVNatgcryswkmbdhvn]+$/.test(this.grna)
    },
    hasIupac() {
      return /[RYSWKMBDHVN]/.test(this.grna)
    },
    iupacBases() {
      const found = new Set()
      for (const char of this.grna) {
        if ('RYSWKMBDHVN'.includes(char)) {
          found.add(char)
        }
      }
      return Array.from(found).sort().join(', ')
    }
  },
  methods: {
    setMode(newMode) {
      this.mode = newMode
    },
    validateGrna() {
      this.grna = this.grna.toUpperCase().replace(/[^ATGCRYSWKMBDHVN]/g, '')
    },
    submit() {
      if (this.isValid) {
        this.$emit('start-analysis', { grna: this.grna, mode: this.mode })
      }
    }
  }
}
</script>

<style scoped>
.mode-btn {
  flex: 1;
  padding: 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s;
}

.mode-btn:hover:not(:disabled) {
  border-color: #667eea;
  background: #f7fafc;
}

.mode-btn.active {
  border-color: #667eea;
  background: #ebf4ff;
}

.mode-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
