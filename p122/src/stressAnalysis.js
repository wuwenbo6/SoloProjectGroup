import * as THREE from 'three'

export class StressAnalysis {
  constructor() {
    this.yieldStrengthWood = 40e6
    this.maxStressLimit = 1e9
    this.minArea = 1e-6
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  safeDivide(numerator, denominator, defaultValue = 0) {
    if (Math.abs(denominator) < this.minArea) {
      return defaultValue
    }
    const result = numerator / denominator
    if (!isFinite(result) || isNaN(result)) {
      return defaultValue
    }
    return result
  }

  analyze(model, material, load) {
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    
    const volume = Math.max(size.x * size.y * size.z, this.minArea)
    const crossSectionArea = Math.max(size.y * size.z, this.minArea)
    
    const maxStress = this.clamp(
      this.calculateMaxStress(load.magnitude, crossSectionArea, size),
      -this.maxStressLimit,
      this.maxStressLimit
    )
    const minStress = this.clamp(
      this.calculateMinStress(load.magnitude, crossSectionArea, size),
      -this.maxStressLimit,
      this.maxStressLimit
    )
    const vonMises = this.clamp(
      this.calculateVonMises(maxStress, minStress),
      0,
      this.maxStressLimit
    )
    
    const shearModulus = this.safeDivide(
      material.elasticModulus,
      2 * (1 + material.poissonRatio),
      material.elasticModulus * 0.38
    )
    const bendingStress = this.clamp(
      this.calculateBendingStress(load.magnitude, size.x, size.y, size.z),
      -this.maxStressLimit,
      this.maxStressLimit
    )
    
    const totalMaxStress = this.clamp(
      maxStress + bendingStress,
      -this.maxStressLimit,
      this.maxStressLimit
    )
    
    const stressMagnitude = Math.max(Math.abs(totalMaxStress), 1e3)
    const safetyFactor = this.clamp(
      this.yieldStrengthWood / stressMagnitude,
      0.01,
      100
    )
    
    return {
      maxStress: totalMaxStress,
      minStress: minStress,
      vonMises: vonMises,
      yieldStrength: this.yieldStrengthWood,
      safetyFactor: safetyFactor,
      crossSectionArea: crossSectionArea,
      volume: volume,
      shearModulus: shearModulus,
      bendingStress: bendingStress,
      axialStress: maxStress
    }
  }
  
  calculateMaxStress(force, area, size) {
    const axialStress = this.safeDivide(force, area)
    const contactStress = this.calculateContactStress(force, size)
    return axialStress + contactStress * 0.3
  }
  
  calculateMinStress(force, area, size) {
    return -this.safeDivide(force, area, 0) * 0.2
  }
  
  calculateContactStress(force, size) {
    const contactArea = Math.max(size.y * size.z * 0.25, this.minArea)
    return this.safeDivide(force, contactArea)
  }
  
  calculateVonMises(sigma1, sigma2) {
    const sigma3 = 0
    const diff1 = sigma1 - sigma2
    const diff2 = sigma2 - sigma3
    const diff3 = sigma3 - sigma1
    const value = 0.5 * (diff1 * diff1 + diff2 * diff2 + diff3 * diff3)
    if (value < 0 || !isFinite(value)) {
      return Math.abs(sigma1)
    }
    return Math.sqrt(value)
  }
  
  calculateBendingStress(force, length, height, width) {
    if (Math.abs(height) < 1e-6) {
      return 0
    }
    const moment = force * length * 0.5
    const momentOfInertia = this.safeDivide(
      width * Math.pow(height, 3),
      12,
      1e-6
    )
    const distanceFromNeutralAxis = height / 2
    return this.safeDivide(
      moment * distanceFromNeutralAxis,
      momentOfInertia,
      0
    )
  }
  
  calculateShearStress(force, area) {
    return 1.5 * this.safeDivide(force, area)
  }
  
  getStressAtPoint(point, model, material, load) {
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    
    const relPosition = new THREE.Vector3().subVectors(point, center)
    
    const crossSectionArea = Math.max(size.y * size.z, this.minArea)
    const axialStress = this.safeDivide(load.magnitude, crossSectionArea)
    
    const bendingMomentX = load.magnitude * Math.abs(relPosition.x) * 0.1
    const momentOfInertia = this.safeDivide(
      size.z * Math.pow(size.y, 3),
      12,
      1e-6
    )
    const bendingStressY = this.safeDivide(
      bendingMomentX * relPosition.y,
      momentOfInertia,
      0
    )
    
    const totalStress = axialStress + bendingStressY
    
    return this.clamp(totalStress, -this.maxStressLimit, this.maxStressLimit)
  }
  
  getPrincipalStresses(sigmaX, sigmaY, sigmaZ, tauXY, tauYZ, tauZX) {
    const I1 = sigmaX + sigmaY + sigmaZ
    const I2 = sigmaX * sigmaY + sigmaY * sigmaZ + sigmaZ * sigmaX - 
               tauXY * tauXY - tauYZ * tauYZ - tauZX * tauZX
    const I3 = sigmaX * sigmaY * sigmaZ + 2 * tauXY * tauYZ * tauZX -
               sigmaX * tauYZ * tauYZ - sigmaY * tauZX * tauZX - sigmaZ * tauXY * tauXY
    
    const a = 1
    const b = -I1
    const c = I2
    const d = -I3
    
    const f = this.safeDivide((3 * c / a) - (b * b / (a * a)), 3)
    const g = this.safeDivide(
      (2 * b * b * b / (a * a * a)) - (9 * b * c / (a * a)) + (27 * d / a),
      27
    )
    const h = (g * g / 4) + (f * f * f / 27)
    
    if (h <= 0 && isFinite(h)) {
      const temp = (g * g / 4) - h
      if (temp < 0) {
        return [sigmaX, sigmaY, sigmaZ].sort((x, y) => y - x)
      }
      const i = Math.sqrt(temp)
      const j = Math.cbrt(i)
      const cosArg = this.clamp(-g / (2 * i), -1, 1)
      const k = Math.acos(cosArg)
      const l = -j
      const m = Math.cos(k / 3)
      const n = Math.sqrt(3) * Math.sin(k / 3)
      const p = -b / (3 * a)
      
      const sigma1 = 2 * j * Math.cos(k / 3) - b / (3 * a)
      const sigma2 = l * (m + n) + p
      const sigma3 = l * (m - n) + p
      
      return [sigma1, sigma2, sigma3].sort((x, y) => y - x)
    } else {
      return [sigmaX, sigmaY, sigmaZ].sort((x, y) => y - x)
    }
  }
}
