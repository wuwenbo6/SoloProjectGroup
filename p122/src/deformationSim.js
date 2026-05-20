import * as THREE from 'three'

export class DeformationSim {
  constructor(scene) {
    this.scene = scene
    this.deformedMesh = null
    this.originalPositions = null
    this.animationId = null
    this.deformationScale = 50
    this.maxDisplacement = 0.1
    this.displacementField = null
  }
  
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }
  
  smoothStep(edge0, edge1, x) {
    const t = this.clamp((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
  }
  
  simulate(model, material, load) {
    this.cleanup()
    
    model.traverse((child) => {
      if (child.isMesh && child.geometry) {
        this.createDeformationVisualization(child, material, load)
      }
    })
    
    this.animateDeformation()
  }
  
  createDeformationVisualization(mesh, material, load) {
    const geometry = mesh.geometry.clone()
    const positions = geometry.attributes.position.array
    
    this.originalPositions = new Float32Array(positions)
    
    this.precomputeDisplacementField(mesh, load)
    
    if (geometry.index) {
      geometry = geometry.toNonIndexed()
    }
    
    const deformationMaterial = new THREE.MeshPhongMaterial({
      color: 0xff6b6b,
      transparent: true,
      opacity: 0.7,
      wireframe: false,
      side: THREE.DoubleSide,
      flatShading: false
    })
    
    this.deformedMesh = new THREE.Mesh(geometry, deformationMaterial)
    this.deformedMesh.position.copy(mesh.position)
    this.deformedMesh.rotation.copy(mesh.rotation)
    this.deformedMesh.scale.copy(mesh.scale)
    
    this.scene.add(this.deformedMesh)
    
    this.createDeformationArrows(mesh, load)
  }
  
  precomputeDisplacementField(mesh, load) {
    const positions = this.originalPositions
    const vertexCount = positions.length / 3
    this.displacementField = new Float32Array(positions.length)
    
    const box = new THREE.Box3().setFromObject(mesh)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    
    for (let i = 0; i < vertexCount; i++) {
      const idx = i * 3
      const x = positions[idx]
      const y = positions[idx + 1]
      const z = positions[idx + 2]
      
      const localPos = new THREE.Vector3(x, y, z)
      const worldPos = localPos.clone()
      mesh.localToWorld(worldPos)
      
      const displacement = this.calculateContinuousDisplacement(
        worldPos, center, size, load
      )
      
      this.displacementField[idx] = displacement.x
      this.displacementField[idx + 1] = displacement.y
      this.displacementField[idx + 2] = displacement.z
    }
    
    this.smoothDisplacementField(vertexCount)
  }
  
  smoothDisplacementField(vertexCount) {
    const smoothed = new Float32Array(this.displacementField.length)
    
    const windowSize = 3
    for (let i = 0; i < vertexCount; i++) {
      let sumX = 0, sumY = 0, sumZ = 0
      let count = 0
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(vertexCount - 1, i + windowSize); j++) {
        const idx = j * 3
        sumX += this.displacementField[idx]
        sumY += this.displacementField[idx + 1]
        sumZ += this.displacementField[idx + 2]
        count++
      }
      
      const idx = i * 3
      smoothed[idx] = sumX / count
      smoothed[idx + 1] = sumY / count
      smoothed[idx + 2] = sumZ / count
    }
    
    this.displacementField = smoothed
  }
  
  createDeformationArrows(mesh, load) {
    const geometry = mesh.geometry
    const positions = geometry.attributes.position.array
    const arrowGroup = new THREE.Group()
    
    const step = Math.max(1, Math.floor(positions.length / 9 / 50))
    
    for (let i = 0; i < positions.length; i += 9 * step) {
      const x = positions[i]
      const y = positions[i + 1]
      const z = positions[i + 2]
      
      const worldPos = new THREE.Vector3(x, y, z)
      mesh.localToWorld(worldPos)
      
      const displacement = this.calculateDisplacement(worldPos, mesh, load)
      
      const dispLength = displacement.length()
      if (dispLength > 0.0001 && isFinite(dispLength)) {
        const arrowDir = displacement.clone().normalize()
        if (arrowDir.length() > 0.1) {
          const arrowLength = this.clamp(dispLength * this.deformationScale * 2, 0.001, 0.5)
          const arrowColor = this.getStressColor(dispLength)
          
          const arrowHelper = new THREE.ArrowHelper(
            arrowDir,
            worldPos,
            arrowLength,
            arrowColor,
            0.03,
            0.02
          )
          
          arrowGroup.add(arrowHelper)
        }
      }
    }
    
    this.arrowGroup = arrowGroup
    this.scene.add(arrowGroup)
  }
  
  calculateContinuousDisplacement(worldPos, center, size, load) {
    const displacement = new THREE.Vector3()
    
    const relX = size.x > 0.001 ? (worldPos.x - center.x) / (size.x / 2) : 0
    const relY = size.y > 0.001 ? (worldPos.y - center.y) / (size.y / 2) : 0
    const relZ = size.z > 0.001 ? (worldPos.z - center.z) / (size.z / 2) : 0
    
    const clampedRelX = this.clamp(relX, -1, 1)
    const clampedRelY = this.clamp(relY, -1, 1)
    
    const smoothX = this.smoothStep(-1, 1, (clampedRelX + 1) / 2)
    const smoothY = this.smoothStep(-1, 1, (clampedRelY + 1) / 2)
    
    const forceFactor = this.clamp(load.magnitude * 0.000001, 0, 1)
    
    displacement.y = load.direction.y * Math.abs(clampedRelX) * forceFactor * 0.05
    displacement.x = load.direction.x * smoothY * smoothY * forceFactor * 0.02
    displacement.z = load.direction.z * clampedRelX * clampedRelY * forceFactor * 0.01
    
    const magnitude = displacement.length()
    if (magnitude > this.maxDisplacement) {
      displacement.multiplyScalar(this.maxDisplacement / magnitude)
    }
    
    return displacement
  }
  
  calculateDisplacement(point, model, load) {
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    
    return this.calculateContinuousDisplacement(point, center, size, load)
  }
  
  animateDeformation() {
    if (!this.deformedMesh || !this.displacementField) return
    
    const positions = this.deformedMesh.geometry.attributes.position.array
    const startTime = Date.now()
    const duration = 2000
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = this.easeInOutQuad(progress)
      
      const vertexCount = Math.min(
        positions.length / 3,
        this.displacementField.length / 3
      )
      
      for (let i = 0; i < vertexCount; i++) {
        const idx = i * 3
        const origX = this.originalPositions[idx]
        const origY = this.originalPositions[idx + 1]
        const origZ = this.originalPositions[idx + 2]
        
        const dispX = this.displacementField[idx]
        const dispY = this.displacementField[idx + 1]
        const dispZ = this.displacementField[idx + 2]
        
        if (isFinite(dispX) && isFinite(dispY) && isFinite(dispZ)) {
          positions[idx] = origX + dispX * this.deformationScale * easedProgress
          positions[idx + 1] = origY + dispY * this.deformationScale * easedProgress
          positions[idx + 2] = origZ + dispZ * this.deformationScale * easedProgress
        } else {
          positions[idx] = origX
          positions[idx + 1] = origY
          positions[idx + 2] = origZ
        }
      }
      
      this.deformedMesh.geometry.attributes.position.needsUpdate = true
      
      try {
        this.deformedMesh.geometry.computeVertexNormals()
      } catch (e) {
        console.warn('Normal computation skipped')
      }
      
      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate)
      }
    }
    
    animate()
  }
  
  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }
  
  getStressColor(magnitude) {
    const normalized = this.clamp(magnitude * 1000, 0, 1)
    
    const r = Math.floor(normalized * 255)
    const g = Math.floor((1 - normalized) * 200)
    const b = Math.floor((1 - normalized) * 100)
    
    return (r << 16) | (g << 8) | b
  }
  
  cleanup() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    
    if (this.deformedMesh) {
      this.scene.remove(this.deformedMesh)
      if (this.deformedMesh.geometry) {
        this.deformedMesh.geometry.dispose()
      }
      if (this.deformedMesh.material) {
        this.deformedMesh.material.dispose()
      }
      this.deformedMesh = null
    }
    
    if (this.arrowGroup) {
      this.arrowGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
      this.scene.remove(this.arrowGroup)
      this.arrowGroup = null
    }
    
    this.originalPositions = null
    this.displacementField = null
  }
  
  setDeformationScale(scale) {
    this.deformationScale = this.clamp(scale, 0.1, 100)
  }
}
