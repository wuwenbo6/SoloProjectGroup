import * as THREE from 'three'
import { eventBus, EVENTS } from '../core/EventBus'

export class ChunkedModelLoader {
    constructor(renderEngine, options = {}) {
        this.renderEngine = renderEngine
        this.options = {
            chunkSize: options.chunkSize || 10,
            maxConcurrent: options.maxConcurrent || 3,
            enableLod: options.enableLod !== false,
            cacheModels: options.cacheModels !== false,
            ...options
        }
        
        this.loadingQueue = []
        this.activeLoads = 0
        this.loadedChunks = new Map()
        this.chunkCache = new Map()
        this.loadingPromises = new Map()
        
        this.modelRoot = new THREE.Group()
        this.modelRoot.name = 'ModelRoot'
        this.renderEngine.addObject(this.modelRoot)
        
        this.setupObserver()
    }

    setupObserver() {
        if (typeof IntersectionObserver !== 'undefined') {
            this.observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        const chunkId = entry.target.dataset.chunkId
                        if (entry.isIntersecting) {
                            this.loadChunk(chunkId)
                        } else if (this.options.enableLod) {
                            this.simplifyChunk(chunkId)
                        }
                    })
                },
                { threshold: 0.1 }
            )
        }
    }

    loadModel(config) {
        eventBus.emit(EVENTS.MODEL_LOAD_START, { config })
        
        const { equipmentId, parts = [], onProgress } = config
        
        this.currentEquipmentId = equipmentId
        this.loadingQueue = []
        this.totalChunks = parts.length
        this.loadedCount = 0
        
        parts.forEach((part, index) => {
            const chunkId = `${equipmentId}_${part.id || index}`
            this.loadingQueue.push({
                chunkId,
                part,
                index,
                priority: part.priority || 50,
                visible: part.visible !== false
            })
        })
        
        this.loadingQueue.sort((a, b) => b.priority - a.priority)
        
        this.processQueue()
        
        return new Promise((resolve, reject) => {
            this.onComplete = resolve
            this.onError = reject
        })
    }

    processQueue() {
        while (this.activeLoads < this.options.maxConcurrent && this.loadingQueue.length > 0) {
            const chunk = this.loadingQueue.shift()
            this.loadChunkData(chunk)
        }
    }

    async loadChunkData(chunkInfo) {
        this.activeLoads++
        
        const { chunkId, part, visible } = chunkInfo
        
        try {
            if (this.chunkCache.has(chunkId)) {
                const cachedMesh = this.chunkCache.get(chunkId)
                this.addChunkToScene(chunkId, cachedMesh, visible)
                this.finishChunkLoad(chunkId)
                return
            }
            
            const mesh = await this.generateChunkMesh(part)
            
            if (this.options.cacheModels) {
                this.chunkCache.set(chunkId, mesh.clone())
            }
            
            this.addChunkToScene(chunkId, mesh, visible)
            this.finishChunkLoad(chunkId)
            
        } catch (error) {
            console.error(`Failed to load chunk ${chunkId}:`, error)
            eventBus.emit(EVENTS.MODEL_LOAD_ERROR, { chunkId, error })
            this.finishChunkLoad(chunkId)
        }
    }

    async generateChunkMesh(part) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const mesh = this.createPartMesh(part)
                resolve(mesh)
            }, 50 + Math.random() * 150)
        })
    }

    createPartMesh(part) {
        const geometryType = part.geometryType || 'box'
        let geometry
        
        switch (geometryType) {
            case 'box':
                geometry = new THREE.BoxGeometry(
                    part.width || 2,
                    part.height || 2,
                    part.depth || 2
                )
                break
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(
                    part.radiusTop || 1,
                    part.radiusBottom || 1,
                    part.height || 2,
                    part.radialSegments || 32
                )
                break
            case 'sphere':
                geometry = new THREE.SphereGeometry(
                    part.radius || 1,
                    part.widthSegments || 32,
                    part.heightSegments || 32
                )
                break
            case 'torus':
                geometry = new THREE.TorusGeometry(
                    part.radius || 2,
                    part.tube || 0.5,
                    part.radialSegments || 16,
                    part.tubularSegments || 100
                )
                break
            default:
                geometry = new THREE.BoxGeometry(2, 2, 2)
        }
        
        const material = new THREE.MeshStandardMaterial({
            color: part.color || 0x4a90d9,
            metalness: part.metalness !== undefined ? part.metalness : 0.7,
            roughness: part.roughness !== undefined ? part.roughness : 0.3,
            transparent: part.transparent || false,
            opacity: part.opacity !== undefined ? part.opacity : 1
        })
        
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.name = part.name || `Part_${part.id}`
        mesh.userData = { partId: part.id, ...part }
        
        if (part.position) {
            mesh.position.set(part.position.x || 0, part.position.y || 0, part.position.z || 0)
        }
        if (part.rotation) {
            mesh.rotation.set(part.rotation.x || 0, part.rotation.y || 0, part.rotation.z || 0)
        }
        if (part.scale) {
            mesh.scale.set(part.scale.x || 1, part.scale.y || 1, part.scale.z || 1)
        }
        
        return mesh
    }

    addChunkToScene(chunkId, mesh, visible = true) {
        mesh.visible = visible
        mesh.userData.chunkId = chunkId
        this.modelRoot.add(mesh)
        this.loadedChunks.set(chunkId, mesh)
        
        eventBus.emit(EVENTS.MODEL_CHUNK_LOADED, { chunkId, mesh, visible })
    }

    finishChunkLoad(chunkId) {
        this.activeLoads--
        this.loadedCount++
        
        const progress = this.totalChunks > 0 ? 
            Math.round((this.loadedCount / this.totalChunks) * 100) : 100
        
        eventBus.emit(EVENTS.MODEL_LOAD_PROGRESS, {
            chunkId,
            progress,
            loaded: this.loadedCount,
            total: this.totalChunks
        })
        
        if (this.loadingQueue.length === 0 && this.activeLoads === 0) {
            eventBus.emit(EVENTS.MODEL_LOAD_COMPLETE, {
                totalChunks: this.totalChunks,
                equipmentId: this.currentEquipmentId
            })
            if (this.onComplete) {
                this.onComplete({ success: true, loadedChunks: this.loadedChunks.size })
            }
        } else {
            this.processQueue()
        }
    }

    loadChunk(chunkId) {
        const mesh = this.loadedChunks.get(chunkId)
        if (mesh) {
            mesh.visible = true
        }
    }

    hideChunk(chunkId) {
        const mesh = this.loadedChunks.get(chunkId)
        if (mesh) {
            mesh.visible = false
        }
    }

    simplifyChunk(chunkId) {
        const mesh = this.loadedChunks.get(chunkId)
        if (mesh && mesh.material) {
            mesh.material.flatShading = true
            mesh.material.needsUpdate = true
        }
    }

    unloadChunk(chunkId) {
        const mesh = this.loadedChunks.get(chunkId)
        if (mesh) {
            this.modelRoot.remove(mesh)
            if (mesh.geometry) mesh.geometry.dispose()
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose())
                } else {
                    mesh.material.dispose()
                }
            }
            this.loadedChunks.delete(chunkId)
            eventBus.emit(EVENTS.MODEL_UNLOAD, { chunkId })
        }
    }

    getPartById(partId) {
        for (const [chunkId, mesh] of this.loadedChunks) {
            if (mesh.userData.partId === partId) {
                return mesh
            }
        }
        return null
    }

    getAllParts() {
        return Array.from(this.loadedChunks.values())
    }

    getLoadedChunkCount() {
        return this.loadedChunks.size
    }

    isChunkLoaded(chunkId) {
        return this.loadedChunks.has(chunkId)
    }

    clearCache() {
        this.chunkCache.clear()
    }

    unloadAll() {
        const chunkIds = Array.from(this.loadedChunks.keys())
        chunkIds.forEach(chunkId => this.unloadChunk(chunkId))
        this.loadingQueue = []
        this.activeLoads = 0
    }

    dispose() {
        this.unloadAll()
        this.clearCache()
        if (this.observer) {
            this.observer.disconnect()
        }
        if (this.modelRoot.parent) {
            this.modelRoot.parent.remove(this.modelRoot)
        }
    }
}