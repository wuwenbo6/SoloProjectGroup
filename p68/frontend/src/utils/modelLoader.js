import * as THREE from 'three'

class ModelChunkLoader {
  constructor() {
    this.chunks = new Map()
    this.loadingChunks = new Map()
    this.cacheSize = 50
    this.loadingProgress = new Map()
  }

  loadChunkAsync(chunkId, loadFn) {
    return new Promise((resolve, reject) => {
      if (this.chunks.has(chunkId)) {
        resolve(this.chunks.get(chunkId))
        return
      }

      if (this.loadingChunks.has(chunkId)) {
        this.loadingChunks.get(chunkId).push({ resolve, reject })
        return
      }

      this.loadingChunks.set(chunkId, [{ resolve, reject }])
      this.loadingProgress.set(chunkId, 0)

      loadFn()
        .then(result => {
          this.cacheChunk(chunkId, result)
          this.loadingChunks.get(chunkId).forEach(req => req.resolve(result))
          this.loadingChunks.delete(chunkId)
          this.loadingProgress.delete(chunkId)
        })
        .catch(error => {
          this.loadingChunks.get(chunkId)?.forEach(req => req.reject(error))
          this.loadingChunks.delete(chunkId)
          this.loadingProgress.delete(chunkId)
        })
    })
  }

  cacheChunk(chunkId, data) {
    if (this.chunks.size >= this.cacheSize) {
      const firstKey = this.chunks.keys().next().value
      this.chunks.delete(firstKey)
    }
    this.chunks.set(chunkId, data)
  }

  getChunk(chunkId) {
    return this.chunks.get(chunkId)
  }

  hasChunk(chunkId) {
    return this.chunks.has(chunkId)
  }

  clearCache() {
    this.chunks.clear()
  }

  getProgress(chunkId) {
    return this.loadingProgress.get(chunkId) || 0
  }
}

class FurnitureModelAssembler {
  constructor() {
    this.loader = new ModelChunkLoader()
    this.parts = new Map()
  }

  generatePartGeometry(partId, dimensions, type = 'box') {
    const key = `${partId}_${type}_${dimensions.join('x')}`
    
    return this.loader.loadChunkAsync(key, async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      
      switch (type) {
        case 'box':
          return new THREE.BoxGeometry(...dimensions)
        case 'cylinder':
          return new THREE.CylinderGeometry(...dimensions)
        case 'sphere':
          return new THREE.SphereGeometry(...dimensions)
        default:
          return new THREE.BoxGeometry(...dimensions)
      }
    })
  }

  generatePartMaterial(materialId, color, metalness = 0.1, roughness = 0.8) {
    const key = `mat_${materialId}_${color}`
    
    return this.loader.loadChunkAsync(key, async () => {
      await new Promise(resolve => setTimeout(resolve, 5))
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        metalness,
        roughness
      })
    })
  }

  async assembleFurniture(partsData, onProgress) {
    const group = new THREE.Group()
    const totalParts = partsData.length
    let loadedParts = 0

    const loadPromises = partsData.map(async (part, index) => {
      const geometry = await this.generatePartGeometry(
        part.modelId || `part_${index}`,
        part.dimensions || [0.8, 0.3, 0.8],
        part.shape || 'box'
      )
      
      const material = await this.generatePartMaterial(
        `mat_${part.modelId || index}`,
        part.color || '#8B4513'
      )

      const mesh = new THREE.Mesh(geometry, material)
      
      if (part.position) {
        mesh.position.set(...part.position)
      } else {
        const row = Math.floor(index / 3)
        const col = index % 3
        mesh.position.set((col - 1) * 1.2, row * 0.5 + 0.15, 0)
      }

      if (part.rotation) {
        mesh.rotation.set(...part.rotation)
      }

      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData = {
        partId: part.modelId || `part_${index}`,
        disassembledPosition: part.disassembledPosition || 
          new THREE.Vector3(
            mesh.position.x + (index % 2 === 0 ? -2 : 2),
            mesh.position.y,
            mesh.position.z - 2 - index * 0.3
          ),
        originalPosition: mesh.position.clone(),
        stepOrder: part.stepOrder || index + 1
      }

      this.parts.set(part.modelId || `part_${index}`, mesh)
      group.add(mesh)

      loadedParts++
      if (onProgress) {
        onProgress(Math.round((loadedParts / totalParts) * 100))
      }

      return mesh
    })

    await Promise.all(loadPromises)
    return group
  }

  getPart(partId) {
    return this.parts.get(partId)
  }

  getAllParts() {
    return Array.from(this.parts.values())
  }

  clear() {
    this.parts.clear()
    this.loader.clearCache()
  }
}

class LODManager {
  constructor(scene, camera) {
    this.scene = scene
    this.camera = camera
    this.lodObjects = new Map()
  }

  addLODObject(objectId, lodLevels) {
    const lod = new THREE.LOD()
    
    lodLevels.forEach(({ distance, geometry, material }) => {
      const mesh = new THREE.Mesh(geometry, material)
      lod.addLevel(mesh, distance)
    })

    this.lodObjects.set(objectId, lod)
    this.scene.add(lod)
    return lod
  }

  update() {
    this.lodObjects.forEach(lod => {
      lod.update(this.camera)
    })
  }

  removeObject(objectId) {
    const lod = this.lodObjects.get(objectId)
    if (lod) {
      this.scene.remove(lod)
      this.lodObjects.delete(objectId)
    }
  }

  clear() {
    this.lodObjects.forEach(lod => this.scene.remove(lod))
    this.lodObjects.clear()
  }
}

export const modelChunkLoader = new ModelChunkLoader()
export const furnitureModelAssembler = new FurnitureModelAssembler()
export { LODManager, ModelChunkLoader, FurnitureModelAssembler }
