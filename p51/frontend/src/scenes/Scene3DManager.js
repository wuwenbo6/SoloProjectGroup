import { RenderEngine } from './RenderEngine'
import { ChunkedModelLoader } from './ChunkedModelLoader'
import { eventBus, EVENTS } from '../core/EventBus'
import { offlineCache } from '../core/OfflineCacheManager'
import * as THREE from 'three'

export class Scene3DManager {
    constructor(container, options = {}) {
        this.container = container
        this.options = options
        
        this.renderEngine = null
        this.modelLoader = null
        this.currentEquipment = null
        this.selectedPart = null
        this.isRestored = false
        this.isDisassembled = false
        
        this.performanceMode = options.performanceMode || 'auto'
        this.offlineEnabled = options.offlineEnabled !== false
        this.enableChunkLoading = options.enableChunkLoading !== false
        
        this.isRecording = false
        this.recordedStates = []
        
        this.init()
    }

    init() {
        this.renderEngine = new RenderEngine(this.container, {
            performanceMode: this.performanceMode,
            shadows: this.performanceMode !== 'low',
            fog: this.performanceMode === 'high'
        })

        if (this.enableChunkLoading) {
            this.modelLoader = new ChunkedModelLoader(this.renderEngine, {
                maxConcurrent: 3,
                cacheModels: true
            })
        }

        this.setupEventListeners()
        
        this.renderEngine.start()
        
        eventBus.emit(EVENTS.MODEL_LOAD_START, { manager: this })
    }

    setupEventListeners() {
        eventBus.on(EVENTS.MODEL_CHUNK_LOADED, ({ chunkId, mesh }) => {
            console.log(`Chunk loaded: ${chunkId}`)
        })

        eventBus.on(EVENTS.OFFLINE_ENABLE, () => {
            console.log('Offline mode enabled')
        })
    }

    async loadEquipment(equipment, parts = []) {
        this.currentEquipment = equipment
        
        if (this.offlineEnabled) {
            offlineCache.cacheEquipmentDetail(equipment.id, equipment)
        }

        if (parts.length === 0) {
            parts = this.generateDefaultParts(equipment)
        }

        if (this.modelLoader) {
            await this.modelLoader.loadModel({
                equipmentId: equipment.id,
                parts: parts.map((p, i) => ({
                    id: p.id || `part_${i}`,
                    ...p,
                    priority: p.priority || (i < 5 ? 100 : 50)
                }))
            })
        } else {
            this.createSimpleModel(equipment, parts)
        }

        eventBus.emit(EVENTS.MODEL_LOAD_COMPLETE, { equipment })
    }

    generateDefaultParts(equipment) {
        const parts = []
        const partCount = equipment.id % 5 + 6
        
        for (let i = 0; i < partCount; i++) {
            parts.push({
                id: `part_${i}`,
                name: `部件-${i}`,
                position: {
                    x: (i - partCount / 2) * 1.5,
                    y: 0,
                    z: Math.sin(i * 0.5) * 1
                },
                geometryType: ['box', 'cylinder', 'sphere'][i % 3],
                color: 0x3498db + i * 0x10101,
                metalness: 0.7,
                roughness: 0.3
            })
        }
        
        return parts
    }

    createSimpleModel(equipment, parts) {
        const group = new THREE.Group()
        group.name = equipment.name

        parts.forEach((part, i) => {
            const geometry = this.createGeometry(part.geometryType || 'box')
            const material = new THREE.MeshStandardMaterial({
                color: part.color || 0x4a90d9,
                metalness: part.metalness !== undefined ? part.metalness : 0.7,
                roughness: part.roughness !== undefined ? part.roughness : 0.3
            })
            
            const mesh = new THREE.Mesh(geometry, material)
            mesh.castShadow = true
            mesh.receiveShadow = true
            mesh.name = part.name
            mesh.userData = { partId: part.id, ...part }
            
            if (part.position) {
                mesh.position.set(part.position.x, part.position.y, part.position.z)
            }
            if (part.rotation) {
                mesh.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z)
            }
            
            group.add(mesh)
        })

        this.renderEngine.addObject(group)
    }

    createGeometry(type) {
        switch (type) {
            case 'cylinder':
                return new THREE.CylinderGeometry(0.5, 0.5, 2, 32)
            case 'sphere':
                return new THREE.SphereGeometry(0.8, 32, 32)
            default:
                return new THREE.BoxGeometry(1.5, 1.5, 1.5)
        }
    }

    disassemble() {
        if (this.isDisassembled) return
        
        this.isDisassembled = true
        const parts = this.getAllParts()
        
        parts.forEach((part, i) => {
            const direction = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random(),
                (Math.random() - 0.5) * 2
            ).normalize()
            
            this.animatePartPosition(part, part.position.clone().add(direction.multiplyScalar(3)))
        })
        
        eventBus.emit(EVENTS.PART_DISASSEMBLE, { parts })
    }

    assemble() {
        if (!this.isDisassembled) return
        
        this.isDisassembled = false
        const parts = this.getAllParts()
        
        parts.forEach(part => {
            if (part.userData.originalPosition) {
                this.animatePartPosition(part, part.userData.originalPosition.clone())
            }
        })
        
        eventBus.emit(EVENTS.PART_ASSEMBLE, { parts })
    }

    animatePartPosition(part, targetPosition, duration = 1000) {
        if (!part.userData.originalPosition) {
            part.userData.originalPosition = part.position.clone()
        }
        
        const startPosition = part.position.clone()
        const startTime = Date.now()
        
        const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            
            part.position.lerpVectors(startPosition, targetPosition, eased)
            
            if (progress < 1) {
                requestAnimationFrame(animate)
            }
        }
        
        animate()
    }

    getAllParts() {
        const parts = []
        this.renderEngine.scene.traverse(obj => {
            if (obj.isMesh && obj.userData.partId) {
                parts.push(obj)
            }
        })
        return parts
    }

    selectPart(partId) {
        this.deselectPart()
        
        const part = this.getPartById(partId)
        if (part) {
            this.selectedPart = part
            part.material.emissive = new THREE.Color(0xff9900)
            part.material.emissiveIntensity = 0.3
            
            eventBus.emit(EVENTS.PART_SELECT, { part, partId })
        }
    }

    deselectPart() {
        if (this.selectedPart) {
            this.selectedPart.material.emissiveIntensity = 0
            this.selectedPart = null
        }
    }

    getPartById(partId) {
        return this.getAllParts().find(p => p.userData.partId === partId)
    }

    showDamageMarks(marks = []) {
        marks.forEach((mark, i) => {
            const geometry = new THREE.SphereGeometry(0.15, 16, 16)
            const material = new THREE.MeshBasicMaterial({
                color: this.getDamageColor(mark.severity || 'medium'),
                transparent: true,
                opacity: 0.8
            })
            
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(
                mark.position?.x || (Math.random() - 0.5) * 5,
                mark.position?.y || Math.random() * 2,
                mark.position?.z || (Math.random() - 0.5) * 5
            )
            mesh.userData = { damageId: mark.id || `damage_${i}`, ...mark }
            mesh.name = 'damageMark'
            
            this.renderEngine.addObject(mesh)
        })
    }

    hideDamageMarks() {
        const toRemove = []
        this.renderEngine.scene.traverse(obj => {
            if (obj.name === 'damageMark') {
                toRemove.push(obj)
            }
        })
        toRemove.forEach(obj => this.renderEngine.removeObject(obj))
    }

    getDamageColor(severity) {
        const colors = {
            high: 0xe74c3c,
            medium: 0xf39c12,
            low: 0x2ecc71
        }
        return colors[severity] || colors.medium
    }

    showRestoration() {
        if (this.isRestored) return
        
        this.isRestored = true
        const parts = this.getAllParts()
        
        parts.forEach(part => {
            part.userData.originalMaterial = part.material.clone()
            part.material.color.setHex(0x2ecc71)
            part.material.metalness = 0.9
            part.material.roughness = 0.1
        })
        
        eventBus.emit(EVENTS.RESTORATION_SHOW)
    }

    hideRestoration() {
        if (!this.isRestored) return
        
        this.isRestored = false
        const parts = this.getAllParts()
        
        parts.forEach(part => {
            if (part.userData.originalMaterial) {
                part.material.copy(part.userData.originalMaterial)
            }
        })
        
        eventBus.emit(EVENTS.RESTORATION_HIDE)
    }

    setPerformanceMode(mode) {
        this.performanceMode = mode
        this.renderEngine.applyPerformanceSettings(mode)
        eventBus.emit(EVENTS.PERFORMANCE_MODE_CHANGE, { mode })
    }

    saveSceneState() {
        const state = {
            equipmentId: this.currentEquipment?.id,
            isDisassembled: this.isDisassembled,
            isRestored: this.isRestored,
            cameraPosition: this.renderEngine.camera.position.toArray(),
            cameraTarget: this.renderEngine.controls.target.toArray(),
            timestamp: Date.now()
        }
        
        offlineCache.cacheSceneState(state)
        return state
    }

    async restoreSceneState() {
        const state = offlineCache.getSceneState()
        if (!state) return false
        
        if (state.cameraPosition) {
            this.renderEngine.camera.position.fromArray(state.cameraPosition)
        }
        if (state.cameraTarget) {
            this.renderEngine.controls.target.fromArray(state.cameraTarget)
        }
        
        if (state.isDisassembled) {
            this.disassemble()
        }
        if (state.isRestored) {
            this.showRestoration()
        }
        
        return true
    }

    getStats() {
        const renderStats = this.renderEngine.getStats()
        const cacheStats = offlineCache.getStats()
        
        return {
            ...renderStats,
            ...cacheStats,
            currentEquipment: this.currentEquipment?.name,
            selectedPart: this.selectedPart?.name,
            isDisassembled: this.isDisassembled,
            isRestored: this.isRestored,
            performanceMode: this.performanceMode
        }
    }

    resetView() {
        this.renderEngine.resetView()
    }

    dispose() {
        this.saveSceneState()
        
        if (this.modelLoader) {
            this.modelLoader.dispose()
        }
        
        this.renderEngine.dispose()
        
        eventBus.clear()
    }

    exportSceneData() {
        return {
            equipment: this.currentEquipment,
            parts: this.getAllParts().map(p => ({
                id: p.userData.partId,
                name: p.name,
                position: p.position.toArray(),
                rotation: p.rotation.toArray()
            })),
            state: {
                isDisassembled: this.isDisassembled,
                isRestored: this.isRestored
            },
            performance: this.getStats()
        }
    }

    getDamageStatistics() {
        const marks = []
        this.renderEngine.scene.traverse(obj => {
            if (obj.name === 'damageMark') {
                marks.push(obj)
            }
        })
        
        const byLevel = {
            high: marks.filter(m => m.userData.severity === 'high').length,
            medium: marks.filter(m => m.userData.severity === 'medium').length,
            low: marks.filter(m => m.userData.severity === 'low').length
        }
        
        return {
            total: marks.length,
            byLevel,
            averageScore: marks.length > 0 ? 
                (byLevel.high * 100 + byLevel.medium * 50 + byLevel.low * 20) / marks.length : 0
        }
    }

    startRecording() {
        this.isRecording = true
        this.recordedStates = [this.exportSceneData()]
    }

    stopRecording() {
        this.isRecording = false
    }

    saveRecording() {
        const data = {
            equipment: this.currentEquipment,
            states: this.recordedStates,
            timestamp: Date.now()
        }
        return JSON.stringify(data)
    }

    playRecording(states) {
        if (!states || states.length === 0) return
        
        let currentIndex = 0
        const playNext = () => {
            if (currentIndex >= states.length) return
            
            const state = states[currentIndex]
            if (state.isDisassembled) this.disassemble()
            else this.assemble()
            
            if (state.isRestored) this.showRestoration()
            else this.hideRestoration()
            
            currentIndex++
            setTimeout(playNext, 1000)
        }
        
        playNext()
    }

    detectPerformanceMode() {
        const memory = navigator.deviceMemory || 4
        const cores = navigator.hardwareConcurrency || 2
        
        if (memory <= 4 || cores <= 2) return 'low'
        if (memory <= 8 || cores <= 4) return 'medium'
        return 'high'
    }

    applyPerformanceSettings(mode = this.performanceMode) {
        this.renderEngine.applyPerformanceSettings(mode)
        this.performanceMode = mode
    }

    setAutoRotate(enabled) {
        this.renderEngine.setAutoRotate(enabled)
    }
}