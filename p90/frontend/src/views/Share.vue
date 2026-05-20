<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { patternApi, interactionApi } from '../api'
import { searchSimilarPatterns, getSimilarityColorClass } from '../utils/imageSimilarity'

const route = useRoute()
const router = useRouter()
const pattern = ref(null)
const comments = ref([])
const newComment = ref('')
const isLiked = ref(false)
const likeCount = ref(0)
const shareCount = ref(0)
const submittingComment = ref(false)
const similarPatterns = ref([])
const loadingSimilar = ref(false)

const hasSimilarPatterns = computed(() => similarPatterns.value.length > 0)

const loadPattern = async () => {
  try {
    const patternId = route.params.id
    const data = await patternApi.get(patternId)
    pattern.value = data
    likeCount.value = data.likeCount || 0
    shareCount.value = data.shareCount || 0
    loadComments()
  } catch (error) {
    ElMessage.error('加载纹样失败')
  }
}

const loadComments = async () => {
  try {
    const data = await interactionApi.comments(route.params.id)
    comments.value = data
  } catch (error) {
    console.error('加载评论失败', error)
  }
}

const loadSimilarPatterns = async () => {
  if (!pattern.value) return
  
  loadingSimilar.value = true
  try {
    const allPatterns = await patternApi.list()
    const results = await searchSimilarPatterns(pattern.value, allPatterns, 0.5)
    similarPatterns.value = results.slice(0, 4)
  } catch (error) {
    console.error('加载相似纹样失败', error)
  } finally {
    loadingSimilar.value = false
  }
}

const toggleLike = async () => {
  try {
    if (isLiked.value) {
      const result = await interactionApi.like(route.params.id)
      likeCount.value = result.likeCount || likeCount.value - 1
    } else {
      const result = await interactionApi.like(route.params.id)
      likeCount.value = result.likeCount || likeCount.value + 1
    }
    isLiked.value = !isLiked.value
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const submitComment = async () => {
  if (!newComment.value.trim()) {
    ElMessage.warning('请输入评论内容')
    return
  }
  
  submittingComment.value = true
  try {
    const result = await interactionApi.comment({
      patternId: route.params.id,
      content: newComment.value,
      userName: '当前用户'
    })
    
    newComment.value = ''
    
    if (result.comment) {
      comments.value.unshift(result.comment)
    } else {
      await loadComments()
    }
    
    if (result.pattern) {
      pattern.value.commentCount = result.pattern.commentCount
    }
    
    ElMessage.success('评论成功')
  } catch (error) {
    ElMessage.error('评论失败')
  } finally {
    submittingComment.value = false
  }
}

const sharePattern = async () => {
  try {
    const result = await interactionApi.share(route.params.id)
    shareCount.value = result.shareCount || shareCount.value + 1
    
    if (result.pattern) {
      pattern.value.shareCount = result.pattern.shareCount
    }
    
    const shareUrl = `${window.location.origin}/share/${route.params.id}`
    await navigator.clipboard.writeText(shareUrl)
    ElMessage.success('分享链接已复制到剪贴板')
  } catch (error) {
    ElMessage.error('分享失败')
  }
}

const downloadPattern = () => {
  if (pattern.value?.imageData) {
    const link = document.createElement('a')
    link.download = `${pattern.value.name}.png`
    link.href = pattern.value.imageData
    link.click()
    ElMessage.success('纹样已下载')
  }
}

const viewPattern = (id) => {
  router.push(`/share/${id}`)
}

const getSimilarityBadgeColor = (similarity) => {
  const colorClass = getSimilarityColorClass(similarity)
  const colors = {
    high: '#4caf50',
    medium: '#ff9800',
    low: '#f44336'
  }
  return colors[colorClass]
}

onMounted(() => {
  loadPattern()
})
</script>

<template>
  <div class="share-page">
    <div v-if="pattern" class="share-content">
      <div class="pattern-display card">
        <div class="pattern-image">
          <img :src="pattern.imageData" :alt="pattern.name" loading="lazy">
        </div>
        <div class="pattern-info">
          <h1 class="pattern-name">{{ pattern.name }}</h1>
          <div class="pattern-meta">
            <span class="meta-item">👤 {{ pattern.authorName || '匿名用户' }}</span>
            <span class="meta-item">📅 {{ new Date(pattern.createdAt).toLocaleDateString() }}</span>
          </div>
          <div class="pattern-tags">
            <span v-for="tag in pattern.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <p v-if="pattern.description" class="pattern-desc">{{ pattern.description }}</p>
          
          <div class="action-row">
            <button class="action-btn like-btn" :class="{ active: isLiked }" @click="toggleLike">
              <span>{{ isLiked ? '❤️' : '🤍' }}</span>
              <span>{{ likeCount }}</span>
            </button>
            <button class="action-btn share-btn" @click="sharePattern">
              <span>🔗</span>
              <span>分享 {{ shareCount }}</span>
            </button>
            <button class="action-btn download-btn" @click="downloadPattern">
              <span>📥</span>
              <span>下载</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="hasSimilarPatterns || loadingSimilar" class="similar-section card">
        <div class="section-header">
          <h3>🔍 相似纹样推荐</h3>
          <button v-if="!loadingSimilar && !hasSimilarPatterns" class="btn-secondary btn-sm" @click="loadSimilarPatterns">
            查找相似
          </button>
        </div>
        <div v-if="loadingSimilar" class="loading-small">
          <div class="spinner-small"></div>
          <span>正在查找相似纹样...</span>
        </div>
        <div v-else class="similar-grid">
          <div 
            v-for="item in similarPatterns" 
            :key="item.id" 
            class="similar-item"
            @click="viewPattern(item.id)"
          >
            <div class="similar-image">
              <img :src="item.imageData" :alt="item.name">
              <div class="similarity-badge" :style="{ backgroundColor: getSimilarityBadgeColor(item.similarity / 100) }">
                {{ item.similarityPercent }}%
              </div>
            </div>
            <div class="similar-name">{{ item.name }}</div>
          </div>
        </div>
      </div>

      <div class="comments-section card">
        <div class="section-header">
          <h3>💬 评论 ({{ comments.length }})</h3>
        </div>
        <div class="comment-input">
          <textarea
            v-model="newComment"
            class="input-field textarea"
            placeholder="写下你的评论..."
            rows="3"
            :disabled="submittingComment"
          ></textarea>
          <button class="btn-primary submit-btn" @click="submitComment" :disabled="submittingComment">
            {{ submittingComment ? '提交中...' : '发表评论' }}
          </button>
        </div>
        <div class="comments-list">
          <div v-for="comment in comments" :key="comment.id" class="comment-item">
            <div class="comment-avatar">{{ comment.userName?.charAt(0) || 'U' }}</div>
            <div class="comment-content">
              <div class="comment-header">
                <span class="comment-user">{{ comment.userName || '匿名用户' }}</span>
                <span class="comment-time">{{ new Date(comment.createdAt).toLocaleString() }}</span>
              </div>
              <p class="comment-text">{{ comment.content }}</p>
            </div>
          </div>
          <div v-if="comments.length === 0 && !submittingComment" class="empty-comments">
            <span>暂无评论，快来抢沙发吧！</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-page {
  max-width: 900px;
  margin: 0 auto;
}

.share-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.pattern-display {
  padding: 30px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.pattern-image {
  position: relative;
}

.pattern-image img {
  width: 100%;
  border-radius: 12px;
  border: 2px solid var(--border-color);
}

.pattern-name {
  font-size: 28px;
  color: white;
  margin: 0 0 16px 0;
}

.pattern-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.meta-item {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.pattern-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.tag {
  background: rgba(233, 69, 96, 0.2);
  color: #ff6b6b;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
}

.pattern-desc {
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
  margin-bottom: 24px;
}

.action-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.like-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.like-btn.active {
  background: rgba(233, 69, 96, 0.2);
  color: #ff6b6b;
}

.share-btn {
  background: rgba(77, 150, 255, 0.2);
  color: #4d96ff;
}

.download-btn {
  background: rgba(107, 203, 119, 0.2);
  color: #6bcb77;
}

.action-btn:hover {
  transform: translateY(-2px);
}

.similar-section {
  padding: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  color: white;
  font-size: 18px;
  margin: 0;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.loading-small {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  color: rgba(255, 255, 255, 0.6);
}

.spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.similar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.similar-item {
  cursor: pointer;
  transition: transform 0.2s;
}

.similar-item:hover {
  transform: translateY(-4px);
}

.similar-image {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 8px;
}

.similar-image img {
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.similarity-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 10px;
  color: white;
  font-size: 11px;
  font-weight: 500;
}

.similar-name {
  color: white;
  font-size: 13px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comments-section {
  padding: 24px;
}

.comment-input {
  margin-bottom: 24px;
}

.comment-input .textarea {
  width: 100%;
  margin-bottom: 12px;
}

.submit-btn {
  float: right;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
}

.comment-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  flex-shrink: 0;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.comment-user {
  color: white;
  font-weight: 500;
  font-size: 14px;
}

.comment-time {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.comment-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
  word-wrap: break-word;
}

.empty-comments {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

@media (max-width: 768px) {
  .pattern-display {
    grid-template-columns: 1fr;
    padding: 20px;
    gap: 20px;
  }

  .pattern-name {
    font-size: 22px;
  }

  .action-row {
    justify-content: center;
  }

  .action-btn {
    flex: 1;
    justify-content: center;
    min-width: 100px;
  }

  .similar-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .similar-image img {
    height: 100px;
  }

  .comments-section {
    padding: 20px;
  }

  .comment-item {
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .similar-grid {
    grid-template-columns: 1fr;
  }
  
  .similar-image img {
    height: 150px;
  }
}
</style>
