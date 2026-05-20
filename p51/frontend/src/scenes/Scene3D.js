import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class Scene3D {
  constructor(container, options = {}) {
    this.container = container
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controls = null
    this.equipmentGroup = null
    this.parts = []
    this.damageMarks = []
    this.currentMode = 'view'
    this.isDisassembled = false
    this.isRestored = false
    this.animationId = null
    this.activeAnimations = new Map()
    this.pulseAnimations = new Set()
    this.selectedPart = null
    this.damageMarkData = []
    this.currentEquipmentId = null
    
    this.isRecording = false
    this.isPlaying = false
    this.recordedSteps = []
    this.currentPlaybackStep = 0
    this.playbackTimers = []
    
    this.performanceMode = options.performanceMode || this.detectPerformanceMode()
    this.lodLevel = options.lodLevel || 2
    this.enableShadows = options.enableShadows !== false
    this.enablePostProcessing = options.enablePostProcessing !== false
    this.maxPolyCount = options.maxPolyCount || 50000
    
    this.damageLevelConfig = {
      critical: { color: 0xff0000, threshold: 80, label: '严重破损', priority: 1 },
      severe: { color: 0xff6600, threshold: 60, label: '重度破损', priority: 2 },
      moderate: { color: 0xffcc00, threshold: 40, label: '中度破损', priority: 3 },
      minor: { color: 0x66ff00, threshold: 20, label: '轻度破损', priority: 4 },
      cosmetic: { color: 0x00ffcc, threshold: 0, label: '外观瑕疵', priority: 5 }
    }
    
    this.init()
    this.animate()
  }

  init() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a1a)
    this.scene.fog = new THREE.Fog(0x0a0a1a, 10, 50)

    const { clientWidth, clientHeight } = this.container
    this.camera = new THREE.PerspectiveCamera(45, clientWidth / clientHeight, 0.1, 1000)
    this.camera.position.set(8, 6, 8)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(clientWidth, clientHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.minDistance = 3
    this.controls.maxDistance = 30
    this.controls.autoRotate = false
    this.controls.autoRotateSpeed = 1.0

    this.setupLights()
    this.setupGround()
    this.setupGrid()

    this.equipmentGroup = new THREE.Group()
    this.scene.add(this.equipmentGroup)

    window.addEventListener('resize', () => this.onResize())
    
    this.applyPerformanceSettings()
    this.optimizeMaterials()
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambientLight)

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8)
    mainLight.position.set(10, 15, 10)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.width = 2048
    mainLight.shadow.mapSize.height = 2048
    this.scene.add(mainLight)

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3)
    fillLight.position.set(-10, 5, -10)
    this.scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xff4488, 0.2)
    rimLight.position.set(0, 10, -10)
    this.scene.add(rimLight)
  }

  setupGround() {
    const groundGeometry = new THREE.PlaneGeometry(50, 50)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x16213e,
      roughness: 0.8,
      metalness: 0.2
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
  }

  setupGrid() {
    const gridHelper = new THREE.GridHelper(20, 20, 0x0f3460, 0x1a1a2e)
    this.scene.add(gridHelper)
  }

  loadEquipment(equipmentData) {
    this.clearEquipment()
    this.currentEquipmentId = equipmentData.id
    
    if (equipmentData.modelPath) {
      this.loadModel(equipmentData.modelPath)
    } else {
      this.createDemoModel(equipmentData)
    }
  }

  createDemoModel(equipmentData) {
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      roughness: 0.7,
      metalness: 0.3
    })

    const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 2), baseMaterial)
    base.position.y = 0.25
    base.castShadow = true
    base.receiveShadow = true
    base.userData = { partId: 'base', name: '底座' }
    this.equipmentGroup.add(base)
    this.parts.push(base)

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x718096,
      roughness: 0.5,
      metalness: 0.5
    })
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2, 1.5), bodyMaterial)
    body.position.y = 1.5
    body.castShadow = true
    body.receiveShadow = true
    body.userData = { partId: 'body', name: '主机身' }
    this.equipmentGroup.add(body)
    this.parts.push(body)

    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d3748,
      roughness: 0.6,
      metalness: 0.4
    })
    const top = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 1), topMaterial)
    top.position.y = 2.9
    top.castShadow = true
    top.receiveShadow = true
    top.userData = { partId: 'top', name: '上盖' }
    this.equipmentGroup.add(top)
    this.parts.push(top)

    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a202c,
      roughness: 0.8,
      metalness: 0.2
    })
    const wheelPositions = [
      [-1.5, 0.4, 0.75], [1.5, 0.4, 0.75],
      [-1.5, 0.4, -0.75], [1.5, 0.4, -0.75]
    ]
    wheelPositions.forEach((pos, i) => {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16),
        wheelMaterial
      )
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(...pos)
      wheel.castShadow = true
      wheel.userData = { partId: `wheel_${i}`, name: `轮子${i + 1}` }
      this.equipmentGroup.add(wheel)
      this.parts.push(wheel)
    })

    const pipeMaterial = new THREE.MeshStandardMaterial({
      color: 0xa0aec0,
      roughness: 0.4,
      metalness: 0.6
    })
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8),
      pipeMaterial
    )
    pipe.position.set(1.2, 2, 0)
    pipe.castShadow = true
    pipe.userData = { partId: 'pipe', name: '管道' }
    this.equipmentGroup.add(pipe)
    this.parts.push(pipe)

    this.addDamageEffectsForEquipment(equipmentData.id)
    this.fitCamera()
  }

  loadModel(modelPath) {
    console.log('Loading model:', modelPath)
    this.createDemoModel({ name: 'Demo' })
  }

  clearEquipment() {
    this.stopAllAnimations()
    
    this.parts.forEach(part => {
      if (part.geometry) part.geometry.dispose()
      if (part.material) {
        if (Array.isArray(part.material)) {
          part.material.forEach(m => m.dispose())
        } else {
          part.material.dispose()
        }
      }
      this.equipmentGroup.remove(part)
    })
    
    this.damageMarks.forEach(mark => {
      if (mark.geometry) mark.geometry.dispose()
      if (mark.material) mark.material.dispose()
      this.equipmentGroup.remove(mark)
    })
    
    this.parts = []
    this.damageMarks = []
    this.damageMarkData = []
    this.isDisassembled = false
    this.isRestored = false
    this.selectedPart = null
  }

  stopAllAnimations() {
    this.activeAnimations.clear()
    this.pulseAnimations.clear()
  }

  disassemble() {
    if (this.isDisassembled) return
    
    const disassemblePositions = [
      { z: 3 }, { z: -3 }, { y: 2.5 },
      { x: -3 }, { x: 3 }, { x: -2, z: -2 }, { x: 2, z: 2 }
    ]

    this.parts.forEach((part, i) => {
      const targetPos = disassemblePositions[i % disassemblePositions.length]
      const startPos = part.position.clone()
      const endPos = startPos.clone().add(
        new THREE.Vector3(
          targetPos.x || 0,
          targetPos.y || 0,
          targetPos.z || 0
        )
      )
      
      if (!part.userData.originalPosition) {
        part.userData.originalPosition = startPos.clone()
      }
      
      this.registerAnimation(part, 'position', startPos, endPos, 1000)
    })
    
    this.isDisassembled = true
  }

  assemble() {
    if (!this.isDisassembled) return

    this.parts.forEach(part => {
      if (part.userData.originalPosition) {
        this.registerAnimation(
          part, 
          'position', 
          part.position.clone(), 
          part.userData.originalPosition, 
          1000
        )
      }
    })

    this.isDisassembled = false
  }

  registerAnimation(target, property, start, end, duration) {
    const animationKey = `${target.uuid}_${property}`
    this.activeAnimations.set(animationKey, {
      target,
      property,
      start,
      end,
      duration,
      startTime: performance.now()
    })
  }

  updateAnimations() {
    const now = performance.now()
    const toRemove = []

    this.activeAnimations.forEach((anim, key) => {
      const elapsed = now - anim.startTime
      const progress = Math.min(elapsed / anim.duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      if (anim.property === 'position') {
        anim.target.position.lerpVectors(anim.start, anim.end, eased)
      } else if (anim.property === 'material') {
        if (progress >= 1) {
          anim.target.material = anim.end
        }
      }

      if (progress >= 1) {
        toRemove.push(key)
      }
    })

    toRemove.forEach(key => this.activeAnimations.delete(key))
  }

  showDamageMarks() {
    this.damageMarks.forEach(mark => {
      mark.visible = true
      this.pulseAnimations.add(mark.uuid)
    })
  }

  hideDamageMarks() {
    this.damageMarks.forEach(mark => {
      mark.visible = false
      this.pulseAnimations.delete(mark.uuid)
    })
  }

  updatePulseAnimations() {
    const time = performance.now() * 0.002
    this.damageMarks.forEach(mark => {
      if (this.pulseAnimations.has(mark.uuid) && mark.visible) {
        const scale = 1 + Math.sin(time) * 0.2
        mark.scale.setScalar(scale)
      }
    })
  }

  setDamageMarkData(data) {
    this.damageMarkData = data
  }

  getDamageMarkPosition(damageId) {
    const damage = this.damageMarkData.find(d => d.id === damageId)
    if (damage) {
      const mark = this.damageMarks.find(m => m.userData.markId === damageId)
      return mark ? mark.position.clone() : null
    }
    return null
  }

  showRestoration() {
    if (this.isRestored) return

    this.parts.forEach(part => {
      if (!part.userData.originalMaterial) {
        part.userData.originalMaterial = part.material
      }

      const restoredMaterial = new THREE.MeshStandardMaterial({
        color: 0x4ecca3,
        roughness: 0.3,
        metalness: 0.7,
        emissive: 0x1a4030,
        emissiveIntensity: 0.2,
        map: part.material.map,
        normalMap: part.material.normalMap,
        roughnessMap: part.material.roughnessMap,
        metalnessMap: part.material.metalnessMap
      })

      this.registerAnimation(part, 'material', null, restoredMaterial, 1500)
    })

    this.isRestored = true
  }

  hideRestoration() {
    if (!this.isRestored) return

    this.parts.forEach(part => {
      if (part.userData.originalMaterial) {
        this.registerAnimation(
          part, 
          'material', 
          null, 
          part.userData.originalMaterial, 
          1500
        )
      }
    })

    this.isRestored = false
  }

  selectPart(partId) {
    if (this.selectedPart) {
      this.selectedPart.material.emissiveIntensity = 0
    }

    const part = this.parts.find(p => p.userData.partId === partId)
    if (part) {
      part.material.emissive = new THREE.Color(0xe94560)
      part.material.emissiveIntensity = 0.3
      this.selectedPart = part
      this.focusOnPart(part)
    }
  }

  focusOnPart(part) {
    const box = new THREE.Box3().setFromObject(part)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = this.camera.fov * (Math.PI / 180)
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
    cameraZ *= 2

    const startPos = this.camera.position.clone()
    const endPos = new THREE.Vector3(
      center.x + cameraZ * 0.5,
      center.y + cameraZ * 0.3,
      center.z + cameraZ
    )

    this.registerAnimation(this.camera, 'position', startPos, endPos, 500)
    this.registerAnimation(this.controls.target, 'position', 
      this.controls.target.clone(), center, 500)
  }

  fitCamera() {
    const box = new THREE.Box3().setFromObject(this.equipmentGroup)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = this.camera.fov * (Math.PI / 180)
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
    cameraZ *= 2
    
    this.camera.position.set(center.x + cameraZ, center.y + cameraZ * 0.6, center.z + cameraZ)
    this.controls.target.copy(center)
    this.controls.update()
  }

  setAutoRotate(enabled) {
    this.controls.autoRotate = enabled
  }

  resetView() {
    this.fitCamera()
    this.assemble()
    this.hideDamageMarks()
    this.hideRestoration()
    this.setAutoRotate(false)
    this.currentMode = 'view'
  }

  onResize() {
    const { clientWidth, clientHeight } = this.container
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(clientWidth, clientHeight)
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate())
    this.updateAnimations()
    this.updatePulseAnimations()
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }
    this.stopAllAnimations()
    this.clearEquipment()
    this.renderer.dispose()
    this.controls.dispose()
    if (this.container && this.renderer.domElement.parentNode) {
      this.container.removeChild(this.renderer.domElement)
    }
  }

  getDamagePositionsForEquipment(equipmentId) {
    const positionsMap = {
      1: [
        { pos: [-0.8, 2.5, 0.5], type: 'rust', severity: 'high', id: 'd1' },
        { pos: [0.5, 1.2, 0.3], type: 'crack', severity: 'medium', id: 'd2' },
        { pos: [-1.2, 0.6, -0.6], type: 'wear', severity: 'low', id: 'd3' }
      ],
      2: [
        { pos: [0, 3.2, 0], type: 'break', severity: 'high', id: 'd1' },
        { pos: [0.8, 1.5, 0.4], type: 'corrosion', severity: 'medium', id: 'd2' }
      ],
      3: [
        { pos: [0, 2.8, 0.8], type: 'aging', severity: 'high', id: 'd1' },
        { pos: [-0.6, 1.0, 0.2], type: 'wear', severity: 'medium', id: 'd2' }
      ]
    }
    return positionsMap[equipmentId] || positionsMap[1]
  }

  addDamageEffectsForEquipment(equipmentId) {
    const positions = this.getDamagePositionsForEquipment(equipmentId)
    
    positions.forEach(damage => {
      const damageLevel = this.getDamageLevel(damage.severity)
      const markGeometry = new THREE.SphereGeometry(0.15, this.getSimplifiedSegments(), this.getSimplifiedSegments())
      const markMaterial = new THREE.MeshBasicMaterial({
        color: this.damageLevelConfig[damageLevel].color,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
      })
      const mark = new THREE.Mesh(markGeometry, markMaterial)
      mark.position.set(...damage.pos)
      mark.visible = false
      mark.userData = { markId: damage.id, level: damageLevel, ...damage }
      this.equipmentGroup.add(mark)
      this.damageMarks.push(mark)
    })
  }

  getDamageLevel(severity) {
    const severityMap = {
      'high': 'critical',
      'medium': 'moderate',
      'low': 'minor'
    }
    return severityMap[severity] || 'cosmetic'
  }

  calculateDamageScore(damage) {
    const typeScores = {
      rust: 70,
      crack: 85,
      wear: 40,
      break: 95,
      corrosion: 65,
      aging: 55
    }
    return typeScores[damage.type] || 50
  }

  getSimplifiedSegments() {
    if (this.performanceMode === 'low') return 4
    if (this.performanceMode === 'medium') return 8
    return 16
  }

  showDamageMarksByLevel(level) {
    this.damageMarks.forEach(mark => {
      mark.visible = !level || mark.userData.level === level
      if (mark.visible) {
        this.pulseAnimations.add(mark.uuid)
      }
    })
  }

  getDamageStatistics() {
    const stats = {
      total: this.damageMarks.length,
      byLevel: {},
      averageScore: 0
    }
    
    let totalScore = 0
    this.damageMarks.forEach(mark => {
      const level = mark.userData.level
      stats.byLevel[level] = (stats.byLevel[level] || 0) + 1
      totalScore += this.calculateDamageScore(mark.userData)
    })
    
    stats.averageScore = this.damageMarks.length > 0 ? 
      Math.round(totalScore / this.damageMarks.length) : 0
    return stats
  }

  startRecording() {
    if (this.isRecording) return
    this.isRecording = true
    this.recordedSteps = []
    this.recordStep('start')
  }

  stopRecording() {
    this.isRecording = false
    this.recordStep('end')
    return this.recordedSteps
  }

  recordStep(action, actionType, extraData = {}) {
    if (!this.isRecording) return
    
    const step = {
      timestamp: performance.now(),
      type: actionType,
      cameraPosition: this.camera.position.clone(),
      cameraTarget: this.controls.target.clone(),
      isDisassembled: this.isDisassembled,
      isRestored: this.isRestored,
      damageMarksVisible: this.damageMarks.some(m => m.visible),
      ...extraData
    }
    
    this.recordedSteps.push(step)
  }

  playRecording(steps = null) {
    if (this.isPlaying) this.stopPlayback()
    
    const playbackSteps = steps || this.recordedSteps
    if (playbackSteps.length < 2) return
    
    this.isPlaying = true
    this.currentPlaybackStep = 0
    
    const playNextStep = () => {
      if (this.currentPlaybackStep >= playbackSteps.length - 1) {
        this.stopPlayback()
        return
      }
      
      const currentStep = playbackSteps[this.currentPlaybackStep]
      const nextStep = playbackSteps[this.currentPlaybackStep + 1]
      const duration = nextStep.timestamp - currentStep.timestamp
      
      this.animateToStep(currentStep, nextStep, duration)
      this.currentPlaybackStep++
    }
    
    playNextStep()
  }

  animateToStep(fromStep, toStep, duration) {
    const startTime = performance.now()
    
    const animate = () => {
      if (!this.isPlaying) return
      
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      
      this.camera.position.lerpVectors(fromStep.cameraPosition, toStep.cameraPosition, eased)
      this.controls.target.lerpVectors(fromStep.cameraTarget, toStep.cameraTarget, eased)
      this.controls.update()
      
      if (fromStep.isDisassembled !== toStep.isDisassembled && progress > 0.5) {
        toStep.isDisassembled ? this.disassemble() : this.assemble()
      }
      
      if (fromStep.isRestored !== toStep.isRestored && progress > 0.5) {
        toStep.isRestored ? this.showRestoration() : this.hideRestoration()
      }
      
      if (fromStep.damageMarksVisible !== toStep.damageMarksVisible && progress > 0.5) {
        toStep.damageMarksVisible ? this.showDamageMarks() : this.hideDamageMarks()
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setTimeout(() => {
          if (this.isPlaying) {
          const nextIndex = this.recordedSteps.indexOf(toStep) + 1
          if (nextIndex < this.recordedSteps.length) {
            this.animateToStep(toStep, this.recordedSteps[nextIndex], 
              this.recordedSteps[nextIndex].timestamp - toStep.timestamp)
          } else {
            this.stopPlayback()
          }
        }
        }, 300)
      }
    }
    
    animate()
  }

  stopPlayback() {
    this.isPlaying = false
    this.currentPlaybackStep = 0
  }

  saveRecording() {
    return JSON.stringify(this.recordedSteps)
  }

  loadRecording(data) {
    try {
      this.recordedSteps = JSON.parse(data).map(step => ({
        ...step,
        cameraPosition: new THREE.Vector3(step.cameraPosition.x, step.cameraPosition.y, step.cameraPosition.z),
        cameraTarget: new THREE.Vector3(step.cameraTarget.x, step.cameraTarget.y, step.cameraTarget.z)
      }))
      return true
    } catch (e) {
      console.error('加载录制数据失败:', e)
      return false
    }
  }

  detectPerformanceMode() {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    
    if (!gl) return 'low'
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : ''
    
    if (renderer.toLowerCase().includes('intel') || renderer.toLowerCase().includes('mobile')) {
      return 'low'
    }
    
    const memory = navigator.deviceMemory || 4
    const cores = navigator.hardwareConcurrency || 2
    
    if (memory <= 4 || cores <= 2) return 'low'
    if (memory <= 8 || cores <= 4) return 'medium'
    return 'high'
  }

  applyPerformanceSettings() {
    const pixelRatios = { low: 0.75, medium: 1, high: window.devicePixelRatio }
    this.renderer.setPixelRatio(pixelRatios[this.performanceMode])
    
    this.renderer.shadowMap.enabled = this.performanceMode !== 'low'
    this.renderer.shadowMap.type = this.performanceMode === 'low' ? 
      THREE.BasicShadowMap : THREE.PCFSoftShadowMap
    
    this.scene.traverse((object) => {
      if (object.isLight && object.castShadow && object.shadow) {
        const shadowMapSizes = { low: 512, medium: 1024, high: 2048 }
        const size = shadowMapSizes[this.performanceMode]
        object.shadow.mapSize.set(size, size)
        object.shadow.needsUpdate = true
      }
    })
  }

  createOptimizedGeometry(geometry, simplifyLevel = 0.5) {
    if (this.performanceMode === 'low') {
      const positionAttribute = geometry.getAttribute('position')
      if (positionAttribute && positionAttribute.count > 1000) {
        geometry.setDrawRange(0, Math.floor(positionAttribute.count * simplifyLevel))
      }
    }
    return geometry
  }

  createLOD(originalMesh, distances = [10, 25, 50]) {
    const lod = new THREE.LOD()
    
    distances.forEach((distance, index) => {
      const mesh = originalMesh.clone()
      if (index > 0 && mesh.material) {
        mesh.material = mesh.material.clone()
        mesh.material.flatShading = true
      }
      lod.addLevel(mesh, distance)
    })
    
    return lod
  }

  disposeUnusedResources() {
    this.parts.forEach(part => {
      if (part.geometry) part.geometry.dispose()
      if (part.material) {
        if (Array.isArray(part.material)) {
          part.material.forEach(m => m.dispose())
        } else {
            part.material.dispose()
        }
      }
    })
    
    this.damageMarks.forEach(mark => {
      if (mark.geometry) mark.geometry.dispose()
      if (mark.material) mark.material.dispose()
    })
  }

  enableFog(enabled = true) {
    if (enabled && this.performanceMode !== 'low') {
      this.scene.fog = new THREE.Fog(0x0a0a1a, 30, 100)
    } else {
      this.scene.fog = null
    }
  }

  setMaxAnisotropy(value = 1) {
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy()
    const actualValue = Math.min(value, maxAnisotropy)
    
    this.scene.traverse((object) => {
      if (object.isMesh && object.material && object.material.map) {
        object.material.map.anisotropy = actualValue
      }
    })
  }

  optimizeMaterials() {
    this.scene.traverse((object) => {
      if (object.isMesh && object.material) {
        if (this.performanceMode === 'low') {
          object.material.flatShading = true
          if (object.material.map) {
            object.material.map.minFilter = THREE.LinearFilter
            object.material.map.magFilter = THREE.LinearFilter
          }
        }
      }
    })
  }
}
