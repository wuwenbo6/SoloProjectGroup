<template>
  <img
    ref="imgRef"
    :src="loaded ? src : placeholder"
    :alt="alt"
    class="lazy-image"
    :class="{ loading: !loaded }"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  src: string
  alt?: string
  placeholder?: string
}>()

const imgRef = ref<HTMLImageElement>()
const loaded = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadImage()
          observer?.disconnect()
        }
      })
    }, {
      rootMargin: '100px'
    })

    if (imgRef.value) {
      observer.observe(imgRef.value)
    }
  } else {
    loadImage()
  }
})

const loadImage = () => {
  const img = new Image()
  img.onload = () => {
    loaded.value = true
  }
  img.src = props.src
}

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<style scoped lang="scss">
.lazy-image {
  transition: opacity 0.3s ease;
  opacity: 1;

  &.loading {
    opacity: 0.6;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>
