import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

class ProgressiveModelLoader {
  constructor() {
    this.loader = new GLTFLoader()
    this.dracoLoader = new DRACOLoader()
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
    this.loader.setDRACOLoader(this.dracoLoader)

    this.loadingModels = new Map()
    this.loadedChunks = new Map()
    this.priorityQueue = []
    this.maxConcurrentLoads = 3
    this.currentLoads = 0
  }

  async loadModel(url, options = {}) {
    const {
      onProgress,
      onChunkLoad,
      onComplete,
      onError,
      loadChunks = true,
      chunkSize = 50000,
      priority = 0
    } = options

    const modelId = this.generateId(url)

    if (this.loadedChunks.has(modelId)) {
      return this.loadedChunks.get(modelId)
    }

    const loadTask = {
      id: modelId,
      url,
      priority,
      onProgress,
      onChunkLoad,
      onComplete,
      onError,
      chunkSize,
      loaded: 0,
      total: 0,
      chunks: []
    }

    this.priorityQueue.push(loadTask)
    this.priorityQueue.sort((a, b) => b.priority - a.priority)

    this.processQueue()

    return new Promise((resolve, reject) => {
      this.loadingModels.set(modelId, { resolve, reject, task: loadTask })
    })
  }

  processQueue() {
    if (this.currentLoads >= this.maxConcurrentLoads) return
    if (this.priorityQueue.length === 0) return

    const task = this.priorityQueue.shift()
    this.currentLoads++

    this.executeLoad(task)
  }

  async executeLoad(task) {
    try {
      const gltf = await this.loader.loadAsync(task.url, (progress) => {
        task.loaded = progress.loaded
        task.total = progress.total

        if (task.onProgress) {
          task.onProgress({
            loaded: progress.loaded,
            total: progress.total,
            percent: Math.round((progress.loaded / progress.total) * 100)
          })
        }
      })

      const scene = gltf.scene
      const chunks = this.splitIntoChunks(scene, task.chunkSize)

      task.chunks = chunks

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        await this.processChunk(chunk, i, task)
      }

      this.loadedChunks.set(task.id, scene)

      const resolveInfo = this.loadingModels.get(task.id)
      if (resolveInfo) {
        resolveInfo.resolve(scene)
        if (task.onComplete) {
          task.onComplete(scene)
        }
      }

    } catch (error) {
      const resolveInfo = this.loadingModels.get(task.id)
      if (resolveInfo) {
        resolveInfo.reject(error)
        if (task.onError) {
          task.onError(error)
        }
      }
    } finally {
      this.currentLoads--
      this.processQueue()
    }
  }

  async processChunk(chunk, index, task) {
    if (chunk.material) {
      chunk.material.needsUpdate = true
    }

    if (chunk.geometry) {
      chunk.geometry.computeBoundingBox()
      chunk.geometry.computeBoundingSphere()
      chunk.geometry.computeVertexNormals()
    }

    await new Promise(resolve => setTimeout(resolve, 10))

    if (task.onChunkLoad) {
      task.onChunkLoad({
        index,
        total: task.chunks.length,
        object: chunk,
        percent: Math.round(((index + 1) / task.chunks.length) * 100)
      })
    }
  }

  splitIntoChunks(object, maxVerticesPerChunk) {
    const chunks = []
    const meshQueue = []

    object.traverse((child) => {
      if (child.isMesh) {
        meshQueue.push(child)
      }
    })

    let currentVertexCount = 0
    let currentGroup = new THREE.Group()

    meshQueue.forEach((mesh, index) => {
      const vertexCount = mesh.geometry?.attributes?.position?.count || 0

      if (currentVertexCount + vertexCount > maxVerticesPerChunk && currentVertexCount > 0) {
        chunks.push(currentGroup)
        currentGroup = new THREE.Group()
        currentVertexCount = 0
      }

      const clonedMesh = mesh.clone()
      currentGroup.add(clonedMesh)
      currentVertexCount += vertexCount

      if (index === meshQueue.length - 1 && currentVertexCount > 0) {
        chunks.push(currentGroup)
      }
    })

    return chunks.length > 0 ? chunks : [object]
  }

  cancelLoad(modelId) {
    const index = this.priorityQueue.findIndex(t => t.id === modelId)
    if (index !== -1) {
      this.priorityQueue.splice(index, 1)
    }
    this.loadingModels.delete(modelId)
  }

  clearCache() {
    this.loadedChunks.clear()
  }

  generateId(url) {
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)
  }

  setMaxConcurrentLoads(count) {
    this.maxConcurrentLoads = count
  }
}

export const modelLoader = new ProgressiveModelLoader()

export function createLowPolyPlaceholder(originalModel) {
  const placeholder = new THREE.Group()

  if (originalModel) {
    const box = new THREE.Box3().setFromObject(originalModel)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z)
    const material = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    })

    const placeholderMesh = new THREE.Mesh(geometry, material)
    placeholderMesh.position.copy(center)
    placeholder.add(placeholderMesh)
  }

  return placeholder
}

export function createLOD(model, distances = [5, 15, 30]) {
  const lod = new THREE.LOD()

  const levels = [
    { detail: 1.0, distance: distances[0] },
    { detail: 0.5, distance: distances[1] },
    { detail: 0.25, distance: distances[2] }
  ]

  levels.forEach(({ detail, distance }) => {
    const levelModel = model.clone()

    levelModel.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geometry = child.geometry.clone()
        if (detail < 1.0) {
          const positionAttr = geometry.attributes.position
          if (positionAttr && positionAttr.count > 100) {
            const simplifyRatio = detail
            const targetCount = Math.floor(positionAttr.count * simplifyRatio)
          }
        }
        child.geometry = geometry
      }
    })

    lod.addLevel(levelModel, distance)
  })

  return lod
}

export default modelLoader
