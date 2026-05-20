import * as THREE from 'three'

export class FatigueAnalysis {
  constructor() {
    this.fatigueStrengthCoeffWood = 0.6
    this.enduranceLimitRatio = 0.3
    this.fatigueExponent = 9.0
  }
  
  calculate(model, material, load, stressResults) {
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    
    const maxStress = stressResults ? stressResults.maxStress : this.estimateMaxStress(load, size)
    const minStress = stressResults ? stressResults.minStress : maxStress * 0.1
    
    const meanStress = (maxStress + minStress) / 2
    const stressAmplitude = (maxStress - minStress) / 2
    
    const R = minStress / maxStress
    
    const correctedStressAmplitude = this.applyMeanStressCorrection(
      stressAmplitude,
      meanStress,
      material.elasticModulus
    )
    
    const cyclesToFailure = this.calculateFatigueLife(
      correctedStressAmplitude,
      material.elasticModulus
    )
    
    const damage = this.calculateDamage(correctedStressAmplitude, cyclesToFailure, 1000)
    
    const fatigueStrength = this.calculateFatigueStrength(
      material.elasticModulus,
      cyclesToFailure
    )
    
    const safetyMargin = this.calculateSafetyMargin(
      correctedStressAmplitude,
      fatigueStrength
    )
    
    return {
      cycles: cyclesToFailure,
      damage: damage,
      fatigueStrengthCoeff: this.fatigueStrengthCoeffWood,
      stressAmplitude: stressAmplitude,
      meanStress: meanStress,
      stressRatio: R,
      correctedStressAmplitude: correctedStressAmplitude,
      fatigueStrength: fatigueStrength,
      safetyMargin: safetyMargin,
      enduranceLimit: this.calculateEnduranceLimit(material.elasticModulus)
    }
  }
  
  estimateMaxStress(load, size) {
    const area = size.y * size.z
    return load.magnitude / area * 2
  }
  
  applyMeanStressCorrection(stressAmplitude, meanStress, elasticModulus) {
    const ultimateStrength = elasticModulus * 0.01
    
    const goodmanCorrection = stressAmplitude / (1 - meanStress / ultimateStrength)
    const gerberCorrection = stressAmplitude / (1 - Math.pow(meanStress / ultimateStrength, 2))
    
    return Math.min(goodmanCorrection, gerberCorrection)
  }
  
  calculateFatigueLife(stressAmplitude, elasticModulus) {
    const enduranceLimit = this.calculateEnduranceLimit(elasticModulus)
    
    if (stressAmplitude <= enduranceLimit) {
      return 1e9
    }
    
    const K = elasticModulus * this.fatigueStrengthCoeffWood
    const n = this.fatigueExponent
    
    const cycles = Math.pow(K / stressAmplitude, n)
    
    return Math.min(cycles, 1e9)
  }
  
  calculateEnduranceLimit(elasticModulus) {
    return elasticModulus * this.enduranceLimitRatio
  }
  
  calculateDamage(stressAmplitude, cyclesToFailure, cyclesApplied) {
    if (cyclesToFailure >= 1e9) {
      return 0
    }
    
    return cyclesApplied / cyclesToFailure
  }
  
  calculateFatigueStrength(elasticModulus, cycles) {
    if (cycles >= 1e6) {
      return this.calculateEnduranceLimit(elasticModulus)
    }
    
    const K = elasticModulus * this.fatigueStrengthCoeffWood
    const n = this.fatigueExponent
    
    return K * Math.pow(cycles, -1 / n)
  }
  
  calculateSafetyMargin(stressAmplitude, fatigueStrength) {
    return (fatigueStrength / stressAmplitude) - 1
  }
  
  calculateSNcurve(elasticModulus, minCycles = 1e3, maxCycles = 1e8) {
    const points = []
    const steps = 20
    
    for (let i = 0; i <= steps; i++) {
      const logCycles = Math.log10(minCycles) + 
        (Math.log10(maxCycles) - Math.log10(minCycles)) * i / steps
      const cycles = Math.pow(10, logCycles)
      const stress = this.calculateFatigueStrength(elasticModulus, cycles)
      
      points.push({
        cycles: cycles,
        stress: stress
      })
    }
    
    return points
  }
  
  calculateRainflowCounting(stressHistory) {
    const reversals = []
    const counts = []
    
    for (let i = 1; i < stressHistory.length - 1; i++) {
      const prev = stressHistory[i - 1]
      const curr = stressHistory[i]
      const next = stressHistory[i + 1]
      
      if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
        reversals.push(curr)
      }
    }
    
    const stack = []
    for (const reversal of reversals) {
      stack.push(reversal)
      
      while (stack.length >= 4) {
        const X = stack[stack.length - 4]
        const Y = stack[stack.length - 3]
        const Z = stack[stack.length - 2]
        const W = stack[stack.length - 1]
        
        const rangeYZ = Math.abs(Y - Z)
        const rangeXW = Math.abs(X - W)
        
        if (rangeYZ <= rangeXW) {
          const mean = (Y + Z) / 2
          counts.push({
            range: rangeYZ,
            mean: mean,
            cycles: 0.5
          })
          
          stack.splice(stack.length - 3, 2)
        } else {
          break
        }
      }
    }
    
    for (let i = 0; i < stack.length - 1; i++) {
      const range = Math.abs(stack[i] - stack[i + 1])
      const mean = (stack[i] + stack[i + 1]) / 2
      counts.push({
        range: range,
        mean: mean,
        cycles: 0.5
      })
    }
    
    return counts
  }
  
  calculateMinerRule(damages) {
    let totalDamage = 0
    
    for (const damage of damages) {
      totalDamage += damage
    }
    
    return totalDamage
  }
  
  calculateFatigueLifeUnderVariableLoading(stressHistory, material) {
    const cycles = this.calculateRainflowCounting(stressHistory)
    
    let totalDamage = 0
    
    for (const cycle of cycles) {
      const stressAmplitude = cycle.range / 2
      const correctedStress = this.applyMeanStressCorrection(
        stressAmplitude,
        cycle.mean,
        material.elasticModulus
      )
      
      const cyclesToFailure = this.calculateFatigueLife(
        correctedStress,
        material.elasticModulus
      )
      
      totalDamage += cycle.cycles / cyclesToFailure
    }
    
    return {
      totalDamage: totalDamage,
      remainingLife: totalDamage > 0 ? 1 / totalDamage : Infinity,
      cycleCounts: cycles
    }
  }
}
