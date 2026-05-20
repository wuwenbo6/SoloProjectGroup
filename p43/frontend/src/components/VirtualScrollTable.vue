<template>
  <div>
    <div class="table-header" style="position: sticky; top: 0; z-index: 10;">
      <table style="table-layout: fixed; width: 100%;">
        <thead>
          <tr>
            <th style="width: 60px;">#</th>
            <th style="width: 100px;">Type</th>
            <th style="width: 120px;">Chromosome</th>
            <th style="width: 100px;">Position</th>
            <th style="width: 80px;">Strand</th>
            <th style="width: 250px;">Sequence</th>
            <th style="width: 100px;">Mismatches</th>
            <th v-if="metadata?.mode === 'crispra'" style="width: 120px;">Seed Mism.</th>
            <th v-if="metadata?.mode === 'crispra'" style="width: 130px;">Binding Score</th>
            <th v-if="metadata?.mode !== 'crispra'" style="width: 100px;">CFD Score</th>
            <th v-if="metadata?.mode !== 'crispra'" style="width: 100px;">MIT Score</th>
            <th v-if="metadata?.mode !== 'crispra'" style="width: 100px;">Aggregate</th>
            <th v-if="metadata?.mode === 'crisprn'" style="width: 80px;">PAM</th>
          </tr>
        </thead>
      </table>
    </div>

    <div 
      ref="scrollContainer"
      class="scroll-container"
      @scroll="handleScroll"
      style="height: 500px; overflow-y: auto; position: relative;"
    >
      <div 
        class="padding-element"
        :style="{ height: totalHeight + 'px', position: 'relative' }"
      >
        <div
          v-for="item in visibleItems"
          :key="item.index"
          class="table-row"
          :style="{
            position: 'absolute',
            top: item.offset + 'px',
            width: '100%'
          }"
        >
          <table style="table-layout: fixed; width: 100%;">
            <tbody>
              <tr>
                <td style="width: 60px;">{{ index + 1 }}</td>
                <td style="width: 100px;">
                  <span 
                    class="badge"
                    :class="item.data.is_ontarget ? 'badge-ontarget' : 'badge-offtarget'"
                  >
                    {{ item.data.is_ontarget ? 'On-Target' : 'Off-Target' }}
                  </span>
                </td>
                <td style="width: 120px;">{{ item.data.chromosome }}</td>
                <td style="width: 100px;">{{ item.data.position }}</td>
                <td style="width: 80px;">{{ item.data.strand }}</td>
                <td style="width: 250px;" class="mismatch-bases">
                  <span 
                    v-for="(base, i) in item.data.sequence"
                    :key="i"
                    :class="{ mismatch: isMismatch(i, item.data) }"
                  >
                    {{ base }}
                  </span>
                </td>
                <td style="width: 100px;">{{ item.data.mismatch_count }}</td>
                <td v-if="metadata?.mode === 'crispra'" style="width: 120px;">
                  <span :style="{ color: item.data.seed_perfect ? '#48bb78' : '#f56565' }">
                    {{ item.data.seed_mismatches }}
                  </span>
                </td>
                <td v-if="metadata?.mode === 'crispra'" style="width: 130px;">
                  <strong>{{ item.data.binding_score }}%</strong>
                </td>
                <td v-if="metadata?.mode !== 'crispra'" style="width: 100px;">{{ item.data.cfd_score }}%</td>
                <td v-if="metadata?.mode !== 'crispra'" style="width: 100px;">{{ item.data.mit_score }}%</td>
                <td v-if="metadata?.mode !== 'crispra'" style="width: 100px;"><strong>{{ item.data.aggregate_score }}%</strong></td>
                <td v-if="metadata?.mode === 'crisprn'" style="width: 80px;">
                  <code>{{ item.data.pam || 'N/A' }}</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner">
          <div style="font-size: 24px;">⏳</div>
          <div>Loading more data...</div>
        </div>
      </div>
    </div>

    <div class="pagination-info" style="padding: 16px 0; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span>
          Showing {{ startIndex + 1 }} - {{ Math.min(startIndex + visibleCount, totalCount) }} of {{ totalCount }} results
        </span>
        <span v-if="metadata?.mode === 'crispra'" style="margin-left: 16px; font-size: 12px; opacity: 0.8;">
          💡 CRISPRa Mode: Scores based on dCas9 binding affinity
        </span>
        <span v-else style="margin-left: 16px; font-size: 12px; opacity: 0.8;">
          💡 CRISPRn Mode: Scores based on Cas9 cutting efficiency
        </span>
      </div>
      <div class="page-buttons" style="display: flex; gap: 8px;">
        <button 
          class="btn"
          :disabled="currentPage === 0"
          @click="goToPage(currentPage - 1)"
        >
          Previous
        </button>
        <button 
          class="btn"
          :disabled="currentPage >= totalPages - 1"
          @click="goToPage(currentPage + 1)"
        >
          Next
        </button>
        <button 
          class="btn"
          :disabled="!canLoadMore"
          @click="loadMore"
        >
          Load More
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

const ROW_HEIGHT = 48
const PAGE_SIZE = 100
const BUFFER_ROWS = 20

export default {
  name: 'VirtualScrollTable',
  props: {
    jobId: String,
    grna: String
  },
  data() {
    return {
      totalCount: 0,
      totalPages: 0,
      currentPage: 0,
      loadedPages: new Set(),
      items: [],
      loading: false,
      scrollTop: 0,
      containerHeight: 500,
      metadata: null
    }
  },
  computed: {
    totalHeight() {
      return this.totalCount * ROW_HEIGHT
    },
    visibleCount() {
      return Math.ceil(this.containerHeight / ROW_HEIGHT) + BUFFER_ROWS * 2
    },
    startIndex() {
      return Math.max(0, Math.floor(this.scrollTop / ROW_HEIGHT) - BUFFER_ROWS)
    },
    endIndex() {
      return Math.min(this.startIndex + this.visibleCount, this.totalCount)
    },
    visibleItems() {
      const result = []
      for (let i = this.startIndex; i < this.endIndex; i++) {
        if (this.items[i]) {
          result.push({
            index: i,
            offset: i * ROW_HEIGHT,
            data: this.items[i]
          })
        }
      }
      return result
    },
    canLoadMore() {
      return this.loadedPages.size < this.totalPages && !this.loading
    }
  },
  mounted() {
    this.loadMetadata()
  },
  methods: {
    async loadMetadata() {
      this.loading = true
      try {
        const response = await axios.get(`/api/results/${this.jobId}/metadata`)
        this.metadata = response.data
        this.totalCount = response.data.total_count
        this.totalPages = Math.ceil(this.totalCount / PAGE_SIZE)
        this.items = new Array(this.totalCount)
        this.loadPage(0)
      } catch (error) {
        console.error('Failed to load metadata:', error)
      } finally {
        this.loading = false
      }
    },
    async loadPage(page) {
      if (this.loadedPages.has(page)) return
      
      this.loadedPages.add(page)
      this.loading = true
      
      try {
        const response = await axios.get(`/api/results/${this.jobId}/page`, {
        params: { page: page, page_size: PAGE_SIZE }
      })
      
      const startIdx = page * PAGE_SIZE
      for (let i = 0; i < response.data.offtargets.length; i++) {
        this.items[startIdx + i] = response.data.offtargets[i]
      }
      
      this.$emit('page-loaded', {
        page: page,
        count: response.data.offtargets.length
      })
      } catch (error) {
        console.error('Failed to load page:', error)
        this.loadedPages.delete(page)
      } finally {
        this.loading = false
      }
    },
    handleScroll(e) {
      this.scrollTop = e.target.scrollTop
      this.checkLoadMore()
    },
    checkLoadMore() {
      const scrollBottom = this.scrollTop + this.containerHeight
      const loadedHeight = this.endIndex * ROW_HEIGHT
      
      if (scrollBottom >= loadedHeight - ROW_HEIGHT * 50) {
        const nextPage = Math.floor(this.endIndex / PAGE_SIZE)
        if (nextPage < this.totalPages && !this.loadedPages.has(nextPage)) {
          this.loadPage(nextPage)
        }
      }
    },
    async goToPage(page) {
      if (page < 0 || page >= this.totalPages) return
      
      if (!this.loadedPages.has(page)) {
        await this.loadPage(page)
      }
      
      this.currentPage = page
      this.$refs.scrollContainer.scrollTop = page * PAGE_SIZE * ROW_HEIGHT
    },
    async loadMore() {
      const nextPage = this.loadedPages.size
      if (nextPage < this.totalPages) {
        await this.loadPage(nextPage)
      }
    },
    isMismatch(pos, site) {
      return site.mismatch_positions.includes(pos)
    }
  }
}
</script>

<style scoped>
.table-header {
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.table-header th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: #4a5568;
}

.scroll-container {
  background: white;
}

.table-row {
  border-bottom: 1px solid #e2e8f0;
  background: white;
}

.table-row:hover {
  background: #f7fafc;
}

.table-row td {
  padding: 12px;
  font-size: 13px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.loading-spinner {
  text-align: center;
  color: #4a5568;
}

.pagination-info {
  background: #f7fafc;
  border-top: 1px solid #e2e8f0;
  padding: 12px 16px;
  font-size: 13px;
  color: #4a5568;
}

.btn {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  background: #edf2f7;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mismatch-bases {
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
  font-size: 12px;
}

.mismatch {
  color: #e53e3e;
  font-weight: bold;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.badge-ontarget {
  background: #c6f6d5;
  color: #22543d;
}

.badge-offtarget {
  background: #fed7d7;
  color: #742a2a;
}
</style>
